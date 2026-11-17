\set ON_ERROR_STOP 1
-- Usuarios de prueba
insert into auth.users values ('11111111-1111-1111-1111-111111111111','duena@test.cl'), ('22222222-2222-2222-2222-222222222222','otro@test.cl');

-- 1) La dueña crea su tienda (abierta todos los días todo el día para la prueba)
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select slug, whatsapp from public.create_store('Café Brote','cafe-brote','56912345678','cafe',true,true,1500,
  (select jsonb_agg(jsonb_build_object('weekday',d,'opens','00:00','closes','23:59:59')) from generate_series(0,6) d));
insert into public.categories (store_id, name) select id, 'Café' from public.stores where slug='cafe-brote';
insert into public.products (store_id, category_id, name, price) select s.id, c.id, 'Flat white', 3200 from public.stores s join public.categories c on c.store_id=s.id;
insert into public.products (store_id, name, price, unit, track_stock, stock) select id, 'Pan amasado', 2400, 'kg', true, 2 from public.stores where slug='cafe-brote';
reset role;

-- 2) Otro usuario NO ve pedidos ni puede editar la tienda ajena
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.stores set name='Hackeado' where slug='cafe-brote';
select 'T2 nombre intacto' as t, name = 'Café Brote' as ok from public.stores where slug='cafe-brote';
do $$ begin
  begin insert into public.orders(store_id,number,fulfillment,customer_name,payment_method,subtotal,total)
        select id, 1, 'pickup','x','cash',0,0 from public.stores; raise exception 'FALLA: insert directo permitido';
  exception when insufficient_privilege then raise notice 'T2 insert directo bloqueado: ok'; end;
end $$;
reset role;

-- 3) Cliente anónimo hace un pedido; el precio lo calcula el servidor
set role anon; reset request.jwt.claim.sub;
select 'T3 pedido' as t, order_number, total from public.place_order('cafe-brote',
  (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 2)) from public.products where name='Flat white'),
  'Valentina', '56987654321', 'delivery', 'transfer', 'Manuel Montt 845');
-- precio esperado: 2*3200 + 1500 = 7900
select 'T3 anon no lee pedidos' as t, count(*) = 0 as ok from public.orders;

-- 4) Venta por kilo con stock
select 'T4 kg' as t, total from public.place_order('cafe-brote',
  (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1.5)) from public.products where name='Pan amasado'),
  'Tomás', '56976543210', 'pickup', 'cash');
do $$ begin
  perform public.place_order('cafe-brote',
    (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1)) from public.products where name='Pan amasado'),
    'Tomás', '56976543210', 'pickup', 'cash');
  raise exception 'FALLA: vendió sin stock';
exception when others then raise notice 'T4 sin stock bloqueado: %', sqlerrm; end $$;
do $$ begin
  perform public.place_order('cafe-brote',
    (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1.5)) from public.products where name='Flat white'),
    'X', '56976543210', 'pickup', 'cash');
  raise exception 'FALLA: aceptó 1,5 unidades';
exception when others then raise notice 'T4 fracción en unidad bloqueada: %', sqlerrm; end $$;
do $$ begin
  perform public.place_order('cafe-brote',
    (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1)) from public.products where name='Flat white'),
    'X', '+56 9 1', 'pickup', 'cash');
  raise exception 'FALLA: aceptó teléfono malo';
exception when others then raise notice 'T4 teléfono inválido bloqueado: %', sqlerrm; end $$;
reset role;

-- 5) La dueña ve sus pedidos y avanza el estado; no puede cambiar montos
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'T5 pedidos visibles' as t, count(*) from public.orders;
update public.orders set status='preparing' where number=1001;
select 'T5 estado' as t, status, accepted_at is not null as marcado from public.orders where number=1001;
do $$ begin
  update public.orders set total = 1 where number=1001; raise exception 'FALLA: cambió el total';
exception when others then raise notice 'T5 total inmutable: %', sqlerrm; end $$;
do $$ begin
  update public.orders set status='new' where number=1001; raise exception 'FALLA: retrocedió estado';
exception when others then raise notice 'T5 retroceso bloqueado: %', sqlerrm; end $$;
select 'T5 stock pan' as t, stock from public.products where name='Pan amasado';
reset role;

-- 6) Tienda con prueba vencida no recibe pedidos
update public.subscriptions set status='past_due';
set role anon;
do $$ begin
  perform public.place_order('cafe-brote',
    (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1)) from public.products where name='Flat white'),
    'X', '56976543210', 'pickup', 'cash');
  raise exception 'FALLA: aceptó pedido con suscripción vencida';
exception when others then raise notice 'T6 suscripción vencida bloquea: %', sqlerrm; end $$;
reset role;
