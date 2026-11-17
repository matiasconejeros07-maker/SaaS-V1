-- =============================================================
-- Endurecimiento tras revisión de código
-- =============================================================

-- 1) Enlaces reservados que chocan con rutas de la app (/cocina, /pedido).
alter table public.stores add constraint stores_slug_reserved_routes
  check (slug not in ('cocina', 'pedido', 'pedidos', 'caja', 'mesas', 'tienda', 'cuenta', 'login', 'signup'));

-- 2) Mensajes claros al crear tienda (antes salían errores técnicos en inglés).
create or replace function public.create_store(
  p_name text,
  p_slug text,
  p_whatsapp text,
  p_business_type text default null,
  p_pickup boolean default true,
  p_delivery boolean default false,
  p_delivery_fee integer default 0,
  p_hours jsonb default null
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
  if coalesce(p_whatsapp, '') !~ '^569[0-9]{8}$' then
    raise exception 'Ingresa un celular chileno válido (9 dígitos que empiezan con 9).' using errcode = 'P0001';
  end if;
  if not (p_pickup or p_delivery) then
    raise exception 'Activa retiro, delivery o ambos.' using errcode = 'P0001';
  end if;

  begin
    insert into public.stores (name, slug, whatsapp, business_type, pickup_enabled, delivery_enabled, delivery_fee)
    values (btrim(p_name), lower(btrim(p_slug)), p_whatsapp, p_business_type, p_pickup, p_delivery, greatest(coalesce(p_delivery_fee, 0), 0))
    returning * into v_store;
  exception
    when unique_violation then
      raise exception 'Ese enlace ya está en uso. Prueba con otro.' using errcode = 'P0001';
    when check_violation then
      if char_length(btrim(coalesce(p_name, ''))) < 2 then
        raise exception 'El nombre debe tener entre 2 y 80 caracteres.' using errcode = 'P0001';
      end if;
      raise exception 'Ese enlace no está disponible. Usa letras, números y guiones, y evita palabras reservadas.' using errcode = 'P0001';
  end;

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
end $$;

-- 3) Guardar el horario de forma atómica (antes: borrar y luego insertar desde el navegador;
--    si la segunda parte fallaba, la tienda quedaba sin horario).
create or replace function public.set_opening_hours(p_store uuid, p_hours jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_h jsonb;
begin
  if not public.is_member(p_store, array['owner','admin']::public.member_role[]) then
    raise exception 'No tienes permiso para cambiar el horario.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_hours) <> 'array' then raise exception 'Horario no válido.' using errcode = 'P0001'; end if;
  delete from public.opening_hours where store_id = p_store;
  for v_h in select * from jsonb_array_elements(p_hours) loop
    if (v_h->>'opens')::time >= (v_h->>'closes')::time then
      raise exception 'La hora de cierre debe ser posterior a la de apertura.' using errcode = 'P0001';
    end if;
    insert into public.opening_hours (store_id, weekday, opens, closes)
    values (p_store, (v_h->>'weekday')::smallint, (v_h->>'opens')::time, (v_h->>'closes')::time);
  end loop;
end $$;
revoke all on function public.set_opening_hours from public, anon;
grant execute on function public.set_opening_hours to authenticated;

-- 4) El personal (rol staff) solo puede marcar agotado/disponible y ajustar stock;
--    precios, nombres y categorías quedan para dueña y administradores.
create or replace function public.products_staff_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then return new; end if;
  if auth.uid() is not null and not public.is_member(new.store_id, array['owner','admin']::public.member_role[]) then
    if (new.name, new.description, new.price, new.unit, new.category_id, new.image_url, new.dine_in_only,
        new.track_stock, new.sku, new.barcode, new.position, new.store_id)
       is distinct from
       (old.name, old.description, old.price, old.unit, old.category_id, old.image_url, old.dine_in_only,
        old.track_stock, old.sku, old.barcode, old.position, old.store_id) then
      raise exception 'Solo la dueña o un administrador pueden editar productos.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger products_staff_guard before update on public.products
for each row execute function public.products_staff_guard();

-- 5) Campos de caja y origen del pedido tampoco se editan desde el navegador
--    (evita mover ventas entre cajas y alterar la cuadratura).
create or replace function public.orders_immutable_fields()
returns trigger language plpgsql as $$
begin
  -- table_id y cash_session_id solo pueden quedar en null cuando lo hace la propia base de datos
  -- al borrar la mesa o la caja (acción ON DELETE SET NULL, que corre dentro de otro trigger).
  if (new.store_id, new.number, new.subtotal, new.delivery_fee, new.total, new.customer_name,
      new.customer_phone, new.fulfillment, new.public_token, new.created_at, new.channel,
      case when pg_trigger_depth() > 1 then coalesce(new.table_id, old.table_id) else new.table_id end,
      case when pg_trigger_depth() > 1 then coalesce(new.cash_session_id, old.cash_session_id) else new.cash_session_id end,
      new.cash_received, new.paid_at)
     is distinct from
     (old.store_id, old.number, old.subtotal, old.delivery_fee, old.total, old.customer_name,
      old.customer_phone, old.fulfillment, old.public_token, old.created_at, old.channel, old.table_id,
      old.cash_session_id, old.cash_received, old.paid_at)
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and coalesce(current_setting('app.allow_order_edit', true), '') <> 'on' then
    raise exception 'Los montos, el cliente y los datos de caja de un pedido no se pueden editar.';
  end if;
  return new;
end $$;

-- settle_table modifica campos de caja: lo habilita explícitamente.
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

  perform set_config('app.allow_order_edit', 'on', true);
  update public.orders o set payment_status = 'paid', payment_method = p_payment_method, paid_at = now(), cash_session_id = v_session,
         cash_received = case when p_payment_method = 'cash' then o.total end
  where o.table_id = p_table and o.payment_status = 'pending' and o.status <> 'cancelled';
  perform set_config('app.allow_order_edit', 'off', true);
  update public.orders o set status = 'completed' where o.table_id = p_table and o.status = 'ready';

  return query select v_count, v_total,
    case when p_payment_method = 'cash' and p_cash_received is not null then p_cash_received - v_total else 0 end;
end $$;

-- 6) Cobrar un pedido web o de retiro en la caja (efectivo al entregar, etc.).
create or replace function public.mark_order_paid(p_order uuid, p_payment_method public.payment_method)
returns void
language plpgsql security definer set search_path = public
as $$
declare v public.orders; v_session uuid;
begin
  select * into v from public.orders where id = p_order for update;
  if not found or not public.is_member(v.store_id) then raise exception 'Pedido no encontrado.' using errcode = 'P0002'; end if;
  if v.payment_status = 'paid' then return; end if;
  if v.status = 'cancelled' then raise exception 'El pedido está anulado.' using errcode = 'P0001'; end if;
  select id into v_session from public.cash_sessions where store_id = v.store_id and closed_at is null;
  perform set_config('app.allow_order_edit', 'on', true);
  update public.orders set payment_status = 'paid', payment_method = p_payment_method, paid_at = now(), cash_session_id = v_session,
         cash_received = case when p_payment_method = 'cash' then v.total end
  where id = p_order;
  perform set_config('app.allow_order_edit', 'off', true);
end $$;
revoke all on function public.mark_order_paid from public, anon;
grant execute on function public.mark_order_paid to authenticated;

-- 7) Un producto con control de stock en 0 se considera agotado automáticamente.
create or replace function public.products_auto_soldout()
returns trigger language plpgsql as $$
begin
  if new.track_stock and new.stock <= 0 then
    new.is_available := false;
  elsif tg_op = 'UPDATE' and new.track_stock and old.stock <= 0 and new.stock > 0
        and not old.is_available and new.is_available = old.is_available then
    new.is_available := true;  -- vuelve a estar disponible al reponer stock
  end if;
  return new;
end $$;
create trigger products_auto_soldout before insert or update of stock, track_stock on public.products
for each row execute function public.products_auto_soldout();

-- 8) La dueña no puede quitarse a sí misma ni a otra dueña.
drop policy if exists members_owner_write on public.store_members;
create policy members_owner_insert on public.store_members for insert
  with check (public.is_member(store_id, array['owner']::public.member_role[]) and role <> 'owner');
create policy members_owner_update on public.store_members for update
  using (public.is_member(store_id, array['owner']::public.member_role[]) and role <> 'owner')
  with check (public.is_member(store_id, array['owner']::public.member_role[]) and role <> 'owner');
create policy members_owner_delete on public.store_members for delete
  using (public.is_member(store_id, array['owner']::public.member_role[]) and role <> 'owner');

-- 9) Ventas de los últimos días para el gráfico del panel (en la zona horaria de la tienda).
create or replace function public.daily_sales(p_store uuid, p_days integer default 14)
returns table (day date, orders integer, total integer)
language sql stable security definer set search_path = public
as $$
  with s as (select timezone from public.stores where id = p_store and public.is_member(id)),
  days as (
    select generate_series((now() at time zone (select timezone from s))::date - (p_days - 1),
                           (now() at time zone (select timezone from s))::date, interval '1 day')::date as day
  )
  select d.day, count(o.id)::int, coalesce(sum(o.total), 0)::int
  from days d
  left join public.orders o on o.store_id = p_store and o.status <> 'cancelled'
    and (o.created_at at time zone (select timezone from s))::date = d.day
  where exists (select 1 from s)
  group by d.day order by d.day;
$$;
grant execute on function public.daily_sales to authenticated;
