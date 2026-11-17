-- =============================================================
-- Núcleo multi-tienda
-- Cada fila de negocio pertenece a una tienda (store_id).
-- Acceso controlado con Row Level Security:
--   * El público (anon) solo lee tiendas publicadas y su catálogo.
--   * Los pedidos se crean únicamente con place_order(), que
--     recalcula precios en el servidor (el navegador no fija precios).
--   * Los miembros de una tienda gestionan solo su tienda.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.member_role as enum ('owner', 'admin', 'staff');
create type public.order_status as enum ('new', 'preparing', 'ready', 'completed', 'cancelled');
create type public.order_channel as enum ('web', 'table', 'pos');
create type public.fulfillment as enum ('pickup', 'delivery', 'dine_in');
create type public.payment_method as enum ('cash', 'transfer', 'debit', 'credit', 'mercadopago');
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'failed');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');

-- ---------- Tiendas ----------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$')
    check (slug not in ('panel','ingresar','registro','salir','api','admin','auth','app','www','soporte','ayuda','precios','legal','tiendas','static','_next')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^569[0-9]{8}$'),
  business_type text,
  region text,
  commune text,
  address text check (char_length(address) <= 200),
  lat double precision,
  lng double precision,
  description text check (char_length(description) <= 500),
  logo_url text,
  cover_url text,
  timezone text not null default 'America/Santiago',
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  min_order integer not null default 0 check (min_order >= 0),
  accepts_cash boolean not null default true,
  accepts_transfer boolean not null default true,
  accepts_mercadopago boolean not null default false,
  transfer_details text check (char_length(transfer_details) <= 500),
  is_published boolean not null default true,
  modules jsonb not null default '{"tables": false, "kitchen": false, "pos": false, "inventory": false}'::jsonb,
  order_seq integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_or_delivery check (pickup_enabled or delivery_enabled)
);

create table public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index on public.store_members (user_id);

-- Un rango por día. weekday: 0 = domingo ... 6 = sábado (igual que JS getDay()).
create table public.opening_hours (
  store_id uuid not null references public.stores(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  primary key (store_id, weekday),
  check (opens < closes)
);

-- ---------- Catálogo ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
create index on public.categories (store_id, position);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 500),
  price integer not null check (price >= 0),
  unit text not null default 'unit' check (unit in ('unit', 'kg')),
  image_url text,
  is_available boolean not null default true,
  dine_in_only boolean not null default false,
  track_stock boolean not null default false,
  stock numeric(12,3) not null default 0,
  sku text,
  barcode text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (store_id, category_id, position);
create unique index products_barcode_per_store on public.products (store_id, barcode) where barcode is not null;

-- ---------- Mesas (carta QR) ----------
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now(),
  unique (store_id, label)
);

-- ---------- Pedidos ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  number integer not null,
  status public.order_status not null default 'new',
  channel public.order_channel not null default 'web',
  fulfillment public.fulfillment not null,
  table_id uuid references public.tables(id) on delete set null,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  customer_phone text check (customer_phone ~ '^569[0-9]{8}$'),
  address text check (char_length(address) <= 200),
  lat double precision,
  lng double precision,
  note text check (char_length(note) <= 300),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (store_id, number),
  check (fulfillment <> 'delivery' or address is not null)
);
create index on public.orders (store_id, status, created_at desc);
create index on public.orders (store_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  unit text not null default 'unit',
  unit_price integer not null check (unit_price >= 0),
  quantity numeric(10,3) not null check (quantity > 0),
  line_total integer not null check (line_total >= 0)
);
create index on public.order_items (order_id);

-- ---------- Suscripción de la tienda a la plataforma ----------
-- Solo el servidor (service role / webhook de Mercado Pago) escribe aquí.
create table public.subscriptions (
  store_id uuid primary key references public.stores(id) on delete cascade,
  plan text not null default 'pro',
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  current_period_end timestamptz,
  mp_preapproval_id text unique,
  updated_at timestamptz not null default now()
);

-- =============================================================
-- Funciones auxiliares
-- =============================================================

create or replace function public.is_member(p_store uuid, p_roles public.member_role[] default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger stores_touch before update on public.stores for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ¿Está abierta la tienda ahora? Usa la zona horaria de la tienda.
create or replace function public.is_store_open(p_store uuid, p_at timestamptz default now())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.opening_hours h on h.store_id = s.id
    where s.id = p_store
      and h.weekday = extract(dow from (p_at at time zone s.timezone))::int
      and (p_at at time zone s.timezone)::time >= h.opens
      and (p_at at time zone s.timezone)::time <  h.closes
  );
$$;

-- Crea una tienda con su dueño, horario por defecto y prueba de 30 días.
create or replace function public.create_store(
  p_name text,
  p_slug text,
  p_whatsapp text,
  p_business_type text default null,
  p_pickup boolean default true,
  p_delivery boolean default false,
  p_delivery_fee integer default 0,
  p_hours jsonb default null  -- [{"weekday":1,"opens":"09:00","closes":"19:00"}, ...]
)
returns public.stores
language plpgsql security definer set search_path = public
as $$
declare
  v_store public.stores;
  v_h jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear una tienda.' using errcode = '28000';
  end if;
  if (select count(*) from public.store_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'Alcanzaste el máximo de 5 tiendas por cuenta.' using errcode = 'P0001';
  end if;

  insert into public.stores (name, slug, whatsapp, business_type, pickup_enabled, delivery_enabled, delivery_fee)
  values (btrim(p_name), lower(btrim(p_slug)), p_whatsapp, p_business_type, p_pickup, p_delivery, coalesce(p_delivery_fee, 0))
  returning * into v_store;

  insert into public.store_members (store_id, user_id, role) values (v_store.id, auth.uid(), 'owner');
  insert into public.subscriptions (store_id) values (v_store.id);

  if p_hours is null or jsonb_array_length(p_hours) = 0 then
    insert into public.opening_hours (store_id, weekday, opens, closes)
    select v_store.id, d, '09:00', '19:00' from generate_series(1, 5) d;
  else
    for v_h in select * from jsonb_array_elements(p_hours) loop
      insert into public.opening_hours (store_id, weekday, opens, closes)
      values (v_store.id, (v_h->>'weekday')::smallint, (v_h->>'opens')::time, (v_h->>'closes')::time);
    end loop;
  end if;

  return v_store;
exception
  when unique_violation then
    raise exception 'Ese enlace ya está en uso. Prueba con otro.' using errcode = '23505';
end $$;

-- Crea un pedido desde la tienda pública o una mesa QR.
-- Los precios, el costo de despacho y el total se calculan aquí.
create or replace function public.place_order(
  p_slug text,
  p_items jsonb,            -- [{"product_id": "...", "quantity": 2}]
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
  v_item jsonb;
  v_prod public.products;
  v_qty numeric;
  v_subtotal integer := 0;
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu pedido está vacío.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Un pedido puede tener hasta 50 productos distintos.' using errcode = 'P0001';
  end if;

  -- Freno simple contra pedidos repetidos desde el mismo teléfono.
  if p_customer_phone is not null and (
    select count(*) from public.orders o
    where o.store_id = s.id and o.customer_phone = p_customer_phone and o.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Recibimos varios pedidos seguidos desde este número. Espera unos minutos.' using errcode = 'P0001';
  end if;

  -- Número correlativo por tienda (bloquea la fila de la tienda).
  update public.stores set order_seq = order_seq + 1 where id = s.id returning order_seq into v_number;

  insert into public.orders (store_id, number, channel, fulfillment, table_id, customer_name, customer_phone,
                             address, lat, lng, note, payment_method, subtotal, delivery_fee, total)
  values (s.id, v_number, v_channel, p_fulfillment, v_table.id, btrim(p_customer_name), p_customer_phone,
          nullif(btrim(p_address), ''), p_lat, p_lng, nullif(btrim(p_note), ''), p_payment_method, 0, 0, 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from public.products p
    where p.id = (v_item->>'product_id')::uuid and p.store_id = s.id
    for update;
    if not found then
      raise exception 'Un producto del carrito ya no existe. Actualiza la página.' using errcode = 'P0001';
    end if;
    if not v_prod.is_available then
      raise exception '"%" está agotado.', v_prod.name using errcode = 'P0001';
    end if;
    if v_prod.dine_in_only and p_fulfillment <> 'dine_in' then
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
    values (v_order.id, s.id, v_prod.id, v_prod.name, v_prod.unit, v_prod.price, v_qty, round(v_prod.price * v_qty));
    v_subtotal := v_subtotal + round(v_prod.price * v_qty)::integer;
  end loop;

  if v_subtotal < s.min_order then
    raise exception 'El pedido mínimo es de $%.', replace(to_char(s.min_order, 'FM999,999,999'), ',', '.') using errcode = 'P0001';
  end if;

  if p_fulfillment = 'delivery' then v_fee := s.delivery_fee; end if;

  perform set_config('app.allow_order_edit', 'on', true);
  update public.orders o set subtotal = v_subtotal, delivery_fee = v_fee, total = v_subtotal + v_fee
  where o.id = v_order.id;
  perform set_config('app.allow_order_edit', 'off', true);

  return query select v_order.id, v_number, v_subtotal + v_fee, v_order.public_token;
end $$;

-- Seguimiento del pedido por el cliente (con el token secreto del enlace).
create or replace function public.get_order_status(p_token text)
returns table (number integer, status public.order_status, total integer, store_name text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select o.number, o.status, o.total, s.name, o.created_at
  from public.orders o join public.stores s on s.id = o.store_id
  where o.public_token = p_token;
$$;

-- Transiciones válidas de estado y marcas de tiempo.
create or replace function public.order_status_guard()
returns trigger language plpgsql as $$
begin
  if new.status = old.status then return new; end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'Un pedido % no se puede modificar.', case old.status when 'completed' then 'entregado' else 'anulado' end;
  end if;
  if not (
    (old.status = 'new' and new.status in ('preparing', 'cancelled')) or
    (old.status = 'preparing' and new.status in ('ready', 'cancelled')) or
    (old.status = 'ready' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Cambio de estado no permitido: % → %.', old.status, new.status;
  end if;
  case new.status
    when 'preparing' then new.accepted_at := now();
    when 'ready' then new.ready_at := now();
    when 'completed' then new.completed_at := now();
    when 'cancelled' then new.cancelled_at := now();
    else null;
  end case;
  return new;
end $$;
create trigger orders_status_guard before update of status on public.orders
for each row execute function public.order_status_guard();

-- Los miembros solo pueden cambiar estado, pago y nota interna; nunca montos ni cliente.
create or replace function public.orders_immutable_fields()
returns trigger language plpgsql as $$
begin
  if (new.store_id, new.number, new.subtotal, new.delivery_fee, new.total, new.customer_name,
      new.customer_phone, new.fulfillment, new.public_token, new.created_at)
     is distinct from
     (old.store_id, old.number, old.subtotal, old.delivery_fee, old.total, old.customer_name,
      old.customer_phone, old.fulfillment, old.public_token, old.created_at)
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and coalesce(current_setting('app.allow_order_edit', true), '') <> 'on' then
    raise exception 'Los montos y datos del cliente de un pedido no se pueden editar.';
  end if;
  return new;
end $$;
create trigger orders_immutable before update on public.orders
for each row execute function public.orders_immutable_fields();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.opening_hours enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscriptions enable row level security;

-- Tiendas
create policy stores_public_read on public.stores for select
  using (is_published or public.is_member(id));
create policy stores_admin_update on public.stores for update
  using (public.is_member(id, array['owner','admin']::public.member_role[]))
  with check (public.is_member(id, array['owner','admin']::public.member_role[]));

-- Las columnas sensibles de la tienda no se editan desde el cliente.
revoke update on public.stores from anon, authenticated;
grant update (name, whatsapp, business_type, region, commune, address, lat, lng, description, logo_url, cover_url,
              pickup_enabled, delivery_enabled, delivery_fee, min_order, accepts_cash, accepts_transfer,
              transfer_details, is_published, modules)
  on public.stores to authenticated;

-- Miembros
create policy members_read on public.store_members for select
  using (user_id = auth.uid() or public.is_member(store_id));
create policy members_owner_write on public.store_members for all
  using (public.is_member(store_id, array['owner']::public.member_role[]))
  with check (public.is_member(store_id, array['owner']::public.member_role[]) and role <> 'owner');

-- Horario, categorías y productos: lectura pública si la tienda está publicada.
create policy hours_read on public.opening_hours for select
  using (exists (select 1 from public.stores s where s.id = store_id and (s.is_published or public.is_member(s.id))));
create policy hours_write on public.opening_hours for all
  using (public.is_member(store_id, array['owner','admin']::public.member_role[]))
  with check (public.is_member(store_id, array['owner','admin']::public.member_role[]));

create policy categories_read on public.categories for select
  using (exists (select 1 from public.stores s where s.id = store_id and (s.is_published or public.is_member(s.id))));
create policy categories_write on public.categories for all
  using (public.is_member(store_id, array['owner','admin']::public.member_role[]))
  with check (public.is_member(store_id, array['owner','admin']::public.member_role[]));

create policy products_read on public.products for select
  using (exists (select 1 from public.stores s where s.id = store_id and (s.is_published or public.is_member(s.id))));
create policy products_write on public.products for all
  using (public.is_member(store_id, array['owner','admin']::public.member_role[]))
  with check (public.is_member(store_id, array['owner','admin']::public.member_role[]));
-- El personal puede marcar productos como agotados.
create policy products_staff_toggle on public.products for update
  using (public.is_member(store_id))
  with check (public.is_member(store_id));

-- Mesas: solo miembros (el público usa el token vía place_order).
create policy tables_members on public.tables for all
  using (public.is_member(store_id, array['owner','admin']::public.member_role[]))
  with check (public.is_member(store_id, array['owner','admin']::public.member_role[]));
create policy tables_staff_read on public.tables for select using (public.is_member(store_id));

-- Pedidos: miembros leen y actualizan; nadie inserta directo (usar place_order).
create policy orders_members_read on public.orders for select using (public.is_member(store_id));
create policy orders_members_update on public.orders for update
  using (public.is_member(store_id)) with check (public.is_member(store_id));
create policy order_items_members_read on public.order_items for select using (public.is_member(store_id));

-- Suscripciones: solo lectura para miembros.
create policy subscriptions_members_read on public.subscriptions for select using (public.is_member(store_id));

-- Permisos de funciones
revoke all on function public.create_store from public;
grant execute on function public.create_store to authenticated;
revoke all on function public.place_order from public;
grant execute on function public.place_order to anon, authenticated;
grant execute on function public.get_order_status to anon, authenticated;
grant execute on function public.is_store_open to anon, authenticated;

-- Pedidos en tiempo real para el tablero (solo existe en Supabase).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
