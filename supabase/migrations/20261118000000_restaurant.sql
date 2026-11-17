-- =============================================================
-- Módulo restaurante: caja (sesiones), ventas POS, comandas de
-- mesa y cobro de mesa. Todo pasa por funciones del servidor que
-- calculan precios y validan permisos.
-- =============================================================

-- ---------- Sesiones de caja ----------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  opening_amount integer not null default 0 check (opening_amount >= 0),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  expected_cash integer,
  counted_amount integer check (counted_amount >= 0),
  notes text check (char_length(notes) <= 500)
);
-- Una sola caja abierta por tienda.
create unique index cash_sessions_one_open on public.cash_sessions (store_id) where closed_at is null;
create index on public.cash_sessions (store_id, opened_at desc);

alter table public.cash_sessions enable row level security;
create policy cash_sessions_members_read on public.cash_sessions for select using (public.is_member(store_id));

alter table public.orders
  add column cash_session_id uuid references public.cash_sessions(id) on delete set null,
  add column cash_received integer check (cash_received >= 0),
  add column paid_at timestamptz;
create index on public.orders (cash_session_id);
create index on public.orders (table_id) where table_id is not null;

-- ---------- Ítems de un pedido (compartido por web y caja) ----------
-- Inserta los ítems con el precio vigente, valida disponibilidad y stock,
-- descuenta stock y devuelve el subtotal. Solo la usan otras funciones.
create or replace function public._order_add_items(p_order uuid, p_store uuid, p_items jsonb, p_dine_in boolean)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_prod public.products;
  v_qty numeric;
  v_subtotal integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Un pedido puede tener hasta 50 productos distintos.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from public.products p
    where p.id = (v_item->>'product_id')::uuid and p.store_id = p_store
    for update;
    if not found then
      raise exception 'Un producto del pedido ya no existe. Actualiza la página.' using errcode = 'P0001';
    end if;
    if not v_prod.is_available then
      raise exception '"%" está agotado.', v_prod.name using errcode = 'P0001';
    end if;
    if v_prod.dine_in_only and not p_dine_in then
      raise exception '"%" solo se vende para consumir en el local.', v_prod.name using errcode = 'P0001';
    end if;

    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 999 then
      raise exception 'Cantidad no válida para "%".', v_prod.name using errcode = 'P0001';
    end if;
    if v_prod.unit = 'unit' and v_qty <> trunc(v_qty) then
      raise exception '"%" se vende por unidad.', v_prod.name using errcode = 'P0001';
    end if;
    if v_prod.track_stock then
      if v_prod.stock < v_qty then
        raise exception 'Solo quedan % de "%".', rtrim(rtrim(v_prod.stock::text, '0'), '.'), v_prod.name using errcode = 'P0001';
      end if;
      update public.products set stock = stock - v_qty where id = v_prod.id;
    end if;

    insert into public.order_items (order_id, store_id, product_id, name, unit, unit_price, quantity, line_total)
    values (p_order, p_store, v_prod.id, v_prod.name, v_prod.unit, v_prod.price, v_qty, round(v_prod.price * v_qty));
    v_subtotal := v_subtotal + round(v_prod.price * v_qty)::integer;
  end loop;
  return v_subtotal;
end $$;
revoke all on function public._order_add_items from public, anon, authenticated;

-- place_order ahora usa el helper (misma firma y comportamiento).
create or replace function public.place_order(
  p_slug text,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment public.fulfillment,
  p_payment_method public.payment_method,
  p_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_note text default null,
  p_table_token text default null
)
returns table (order_id uuid, order_number integer, total integer, public_token text)
language plpgsql security definer set search_path = public
as $$
declare
  s public.stores;
  v_table public.tables;
  v_order public.orders;
  v_subtotal integer;
  v_fee integer := 0;
  v_number integer;
  v_channel public.order_channel := 'web';
begin
  select * into s from public.stores where slug = lower(p_slug) and is_published;
  if not found then
    raise exception 'La tienda no existe o no está publicada.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.subscriptions sub
    where sub.store_id = s.id
      and (sub.status = 'active' or (sub.status = 'trialing' and sub.trial_ends_at > now()))
  ) then
    raise exception 'Esta tienda no está recibiendo pedidos en este momento.' using errcode = 'P0001';
  end if;

  if p_table_token is not null then
    select * into v_table from public.tables t where t.token = p_table_token and t.store_id = s.id;
    if not found then raise exception 'El código QR de la mesa no es válido.' using errcode = 'P0001'; end if;
    if not coalesce((s.modules->>'tables')::boolean, false) then
      raise exception 'Esta tienda no tiene activado el pedido en mesa.' using errcode = 'P0001';
    end if;
    v_channel := 'table';
    p_fulfillment := 'dine_in';
  end if;

  if not public.is_store_open(s.id) then
    raise exception 'La tienda está cerrada. Revisa su horario de atención.' using errcode = 'P0001';
  end if;
  if p_fulfillment = 'delivery' and not s.delivery_enabled then
    raise exception 'Esta tienda no ofrece despacho.' using errcode = 'P0001';
  end if;
  if p_fulfillment = 'pickup' and not s.pickup_enabled then
    raise exception 'Esta tienda no ofrece retiro en local.' using errcode = 'P0001';
  end if;
  if p_fulfillment = 'dine_in' and v_table.id is null then
    raise exception 'Para pedir en mesa escanea el QR de tu mesa.' using errcode = 'P0001';
  end if;
  if p_fulfillment = 'delivery' and coalesce(btrim(p_address), '') = '' then
    raise exception 'Escribe la dirección de entrega.' using errcode = 'P0001';
  end if;
  if p_fulfillment <> 'dine_in' and (p_customer_phone is null or p_customer_phone !~ '^569[0-9]{8}$') then
    raise exception 'Ingresa un celular chileno válido (9 dígitos que empiezan con 9).' using errcode = 'P0001';
  end if;
  if (p_payment_method = 'cash' and not s.accepts_cash)
     or (p_payment_method = 'transfer' and not s.accepts_transfer)
     or (p_payment_method = 'mercadopago' and not s.accepts_mercadopago)
     or p_payment_method in ('debit', 'credit') then
    raise exception 'Ese medio de pago no está disponible en esta tienda.' using errcode = 'P0001';
  end if;
  if p_customer_phone is not null and (
    select count(*) from public.orders o
    where o.store_id = s.id and o.customer_phone = p_customer_phone and o.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Recibimos varios pedidos seguidos desde este número. Espera unos minutos.' using errcode = 'P0001';
  end if;

  update public.stores set order_seq = order_seq + 1 where id = s.id returning order_seq into v_number;

  insert into public.orders (store_id, number, channel, fulfillment, table_id, customer_name, customer_phone,
                             address, lat, lng, note, payment_method, subtotal, delivery_fee, total)
  values (s.id, v_number, v_channel, p_fulfillment, v_table.id,
          coalesce(nullif(btrim(p_customer_name), ''), v_table.label), p_customer_phone,
          nullif(btrim(p_address), ''), p_lat, p_lng, nullif(btrim(p_note), ''), p_payment_method, 0, 0, 0)
  returning * into v_order;

  v_subtotal := public._order_add_items(v_order.id, s.id, p_items, p_fulfillment = 'dine_in');

  if v_subtotal < s.min_order and p_fulfillment <> 'dine_in' then
    raise exception 'El pedido mínimo es de $%.', replace(to_char(s.min_order, 'FM999,999,999'), ',', '.') using errcode = 'P0001';
  end if;
  if p_fulfillment = 'delivery' then v_fee := s.delivery_fee; end if;

  perform set_config('app.allow_order_edit', 'on', true);
  update public.orders o set subtotal = v_subtotal, delivery_fee = v_fee, total = v_subtotal + v_fee where o.id = v_order.id;
  perform set_config('app.allow_order_edit', 'off', true);

  return query select v_order.id, v_number, v_subtotal + v_fee, v_order.public_token;
end $$;

-- ---------- Caja ----------
create or replace function public.open_cash_session(p_store uuid, p_opening_amount integer default 0)
returns public.cash_sessions
language plpgsql security definer set search_path = public
as $$
declare v public.cash_sessions;
begin
  if not public.is_member(p_store) then raise exception 'No tienes acceso a esta tienda.' using errcode = '42501'; end if;
  if coalesce(p_opening_amount, 0) < 0 then raise exception 'El monto inicial no puede ser negativo.' using errcode = 'P0001'; end if;
  insert into public.cash_sessions (store_id, opened_by, opening_amount) values (p_store, auth.uid(), coalesce(p_opening_amount, 0))
  returning * into v;
  return v;
exception when unique_violation then
  raise exception 'Ya hay una caja abierta. Ciérrala antes de abrir otra.' using errcode = 'P0001';
end $$;

-- Totales de una sesión por medio de pago (solo pedidos pagados y no anulados).
create or replace function public.cash_session_summary(p_session uuid)
returns table (payment_method public.payment_method, orders integer, total integer)
language sql stable security definer set search_path = public
as $$
  select o.payment_method, count(*)::int, coalesce(sum(o.total), 0)::int
  from public.orders o
  join public.cash_sessions c on c.id = o.cash_session_id
  where o.cash_session_id = p_session and o.payment_status = 'paid' and o.status <> 'cancelled'
    and public.is_member(c.store_id)
  group by o.payment_method
  order by 3 desc;
$$;

create or replace function public.close_cash_session(p_session uuid, p_counted_amount integer, p_notes text default null)
returns public.cash_sessions
language plpgsql security definer set search_path = public
as $$
declare v public.cash_sessions; v_cash integer;
begin
  select * into v from public.cash_sessions where id = p_session for update;
  if not found or not public.is_member(v.store_id) then raise exception 'Caja no encontrada.' using errcode = 'P0002'; end if;
  if v.closed_at is not null then raise exception 'Esta caja ya está cerrada.' using errcode = 'P0001'; end if;
  if p_counted_amount is null or p_counted_amount < 0 then raise exception 'Ingresa el efectivo contado.' using errcode = 'P0001'; end if;
  select coalesce(sum(total), 0) into v_cash from public.orders
  where cash_session_id = p_session and payment_method = 'cash' and payment_status = 'paid' and status <> 'cancelled';
  update public.cash_sessions set closed_at = now(), closed_by = auth.uid(), counted_amount = p_counted_amount,
         expected_cash = v.opening_amount + v_cash, notes = nullif(btrim(p_notes), '')
  where id = p_session returning * into v;
  return v;
end $$;

-- ---------- Venta en caja o comanda de mesa ----------
-- p_send_to_kitchen = true: la comanda entra a cocina (estado "new").
-- p_paid = true: se cobra ahora y queda asociada a la caja abierta.
create or replace function public.pos_sale(
  p_store uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'cash',
  p_paid boolean default true,
  p_send_to_kitchen boolean default false,
  p_table_id uuid default null,
  p_customer_name text default null,
  p_note text default null,
  p_cash_received integer default null
)
returns table (order_id uuid, order_number integer, total integer, change integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_table public.tables;
  v_session uuid;
  v_order public.orders;
  v_number integer;
  v_subtotal integer;
begin
  if not public.is_member(p_store) then raise exception 'No tienes acceso a esta tienda.' using errcode = '42501'; end if;
  if p_payment_method = 'mercadopago' then raise exception 'Mercado Pago aún no está disponible en caja.' using errcode = 'P0001'; end if;
  if not p_paid and not p_send_to_kitchen then
    raise exception 'Una venta sin cobrar debe enviarse a cocina.' using errcode = 'P0001';
  end if;

  if p_table_id is not null then
    select * into v_table from public.tables where id = p_table_id and store_id = p_store;
    if not found then raise exception 'La mesa no existe.' using errcode = 'P0001'; end if;
  end if;

  if p_paid then
    select id into v_session from public.cash_sessions where store_id = p_store and closed_at is null;
    if v_session is null then raise exception 'Abre la caja antes de cobrar.' using errcode = 'P0001'; end if;
  end if;

  update public.stores set order_seq = order_seq + 1 where id = p_store returning order_seq into v_number;

  insert into public.orders (store_id, number, status, channel, fulfillment, table_id, customer_name, note,
                             payment_method, payment_status, paid_at, cash_session_id, subtotal, total, completed_at)
  values (p_store, v_number,
          case when p_send_to_kitchen then 'new'::public.order_status else 'completed'::public.order_status end,
          case when v_table.id is not null then 'table'::public.order_channel else 'pos'::public.order_channel end,
          case when v_table.id is not null then 'dine_in'::public.fulfillment else 'pickup'::public.fulfillment end,
          v_table.id,
          coalesce(nullif(btrim(p_customer_name), ''), v_table.label, 'Venta en caja'),
          nullif(btrim(p_note), ''),
          p_payment_method,
          case when p_paid then 'paid'::public.payment_status else 'pending'::public.payment_status end,
          case when p_paid then now() end,
          v_session, 0, 0,
          case when p_send_to_kitchen then null else now() end)
  returning * into v_order;

  v_subtotal := public._order_add_items(v_order.id, p_store, p_items, true);

  if p_paid and p_payment_method = 'cash' and p_cash_received is not null and p_cash_received < v_subtotal then
    raise exception 'El efectivo recibido es menor que el total.' using errcode = 'P0001';
  end if;

  perform set_config('app.allow_order_edit', 'on', true);
  update public.orders o set subtotal = v_subtotal, total = v_subtotal,
         cash_received = case when p_paid and p_payment_method = 'cash' then coalesce(p_cash_received, v_subtotal) end
  where o.id = v_order.id;
  perform set_config('app.allow_order_edit', 'off', true);

  return query select v_order.id, v_number, v_subtotal,
    case when p_paid and p_payment_method = 'cash' and p_cash_received is not null then p_cash_received - v_subtotal else 0 end;
end $$;

-- ---------- Cobrar una mesa ----------
-- Marca como pagados todos los pedidos pendientes de la mesa y entrega los que estaban listos.
create or replace function public.settle_table(p_table uuid, p_payment_method public.payment_method, p_cash_received integer default null)
returns table (orders integer, total integer, change integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_table public.tables;
  v_session uuid;
  v_total integer;
  v_count integer;
begin
  select * into v_table from public.tables where id = p_table;
  if not found or not public.is_member(v_table.store_id) then raise exception 'La mesa no existe.' using errcode = 'P0002'; end if;
  if p_payment_method = 'mercadopago' then raise exception 'Mercado Pago aún no está disponible en caja.' using errcode = 'P0001'; end if;
  select id into v_session from public.cash_sessions where store_id = v_table.store_id and closed_at is null;
  if v_session is null then raise exception 'Abre la caja antes de cobrar.' using errcode = 'P0001'; end if;

  select count(*), coalesce(sum(o.total), 0) into v_count, v_total from public.orders o
  where o.table_id = p_table and o.payment_status = 'pending' and o.status <> 'cancelled';
  if v_count = 0 then raise exception 'Esta mesa no tiene nada por cobrar.' using errcode = 'P0001'; end if;
  if p_payment_method = 'cash' and p_cash_received is not null and p_cash_received < v_total then
    raise exception 'El efectivo recibido es menor que el total.' using errcode = 'P0001';
  end if;

  update public.orders o set payment_status = 'paid', payment_method = p_payment_method, paid_at = now(), cash_session_id = v_session
  where o.table_id = p_table and o.payment_status = 'pending' and o.status <> 'cancelled';
  update public.orders o set status = 'completed'
  where o.table_id = p_table and o.status = 'ready';

  return query select v_count, v_total,
    case when p_payment_method = 'cash' and p_cash_received is not null then p_cash_received - v_total else 0 end;
end $$;

-- ---------- Mesa pública (para mostrar "Mesa 4" en la carta) ----------
create or replace function public.get_table_public(p_token text)
returns table (label text, store_slug text)
language sql stable security definer set search_path = public
as $$
  select t.label, s.slug from public.tables t join public.stores s on s.id = t.store_id
  where t.token = p_token and s.is_published and coalesce((s.modules->>'tables')::boolean, false);
$$;

revoke all on function public.open_cash_session, public.close_cash_session, public.cash_session_summary,
  public.pos_sale, public.settle_table from public, anon;
grant execute on function public.open_cash_session, public.close_cash_session, public.cash_session_summary,
  public.pos_sale, public.settle_table to authenticated;
grant execute on function public.get_table_public to anon, authenticated;

-- Las sesiones de caja también se actualizan en vivo.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.cash_sessions;
  end if;
end $$;
