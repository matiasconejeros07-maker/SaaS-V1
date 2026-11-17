\set ON_ERROR_STOP 1
-- Requiere los datos de 10_core_test.sql (tienda cafe-brote de la usuaria 1111…)
update public.subscriptions set status = 'active';
update public.products set stock = 10 where name = 'Pan amasado';

set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.stores set modules = '{"tables": true, "kitchen": true, "pos": true, "inventory": false}' where slug = 'cafe-brote';
insert into public.tables (store_id, label) select id, 'Mesa 4' from public.stores where slug = 'cafe-brote';

-- R1) Cobrar sin caja abierta falla
do $$ begin
  perform public.pos_sale((select id from public.stores where slug='cafe-brote'),
    (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1)) from public.products where name='Flat white'));
  raise exception 'FALLA: cobró sin caja';
exception when others then raise notice 'R1 sin caja: %', sqlerrm; end $$;

-- R2) Abrir caja con $20.000 y vender en efectivo con vuelto
select 'R2 caja' as t, opening_amount from public.open_cash_session((select id from public.stores where slug='cafe-brote'), 20000);
select 'R2 venta' as t, total, change from public.pos_sale((select id from public.stores where slug='cafe-brote'),
  (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 2)) from public.products where name='Flat white'),
  'cash', true, false, null, null, null, 10000);
-- 2×3200=6400, vuelto 3600
do $$ begin
  perform public.open_cash_session((select id from public.stores where slug='cafe-brote'), 0);
  raise exception 'FALLA: abrió dos cajas';
exception when others then raise notice 'R2 segunda caja bloqueada: %', sqlerrm; end $$;

-- R3) Comanda de mesa a cocina, sin cobrar
select 'R3 comanda' as t, total from public.pos_sale((select id from public.stores where slug='cafe-brote'),
  (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 0.5)) from public.products where name='Pan amasado'),
  'cash', false, true, (select id from public.tables where label='Mesa 4'));
select 'R3 estado' as t, status, channel, fulfillment, payment_status, customer_name from public.orders where customer_name='Mesa 4';

-- R4) Pedido del cliente por QR de la mesa (anónimo)
reset role;
select token as mesa_token from public.tables where label = 'Mesa 4' \gset
set role anon; reset request.jwt.claim.sub;
select 'R4 qr' as t, label from public.get_table_public(:'mesa_token');
select 'R4 pedido qr' as t, total from public.place_order('cafe-brote',
  (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 1)) from public.products where name='Flat white'),
  '', null, 'pickup', 'cash', null, null, null, null, :'mesa_token');
reset role;

-- R5) Cocina marca listo una comanda y se cobra la mesa con débito
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.orders set status='preparing' where customer_name='Mesa 4' and status='new';
update public.orders set status='ready' where customer_name='Mesa 4' and status='preparing';
select 'R5 cobro mesa' as t, orders, total from public.settle_table((select id from public.tables where label='Mesa 4'), 'debit');
select 'R5 pendientes mesa' as t, count(*) from public.orders where table_id=(select id from public.tables where label='Mesa 4') and payment_status='pending';
select 'R5 entregadas' as t, count(*) from public.orders where table_id=(select id from public.tables where label='Mesa 4') and status='completed';

-- R6) Resumen y cierre de caja: esperado = 20.000 + 6.400 en efectivo
select 'R6 resumen' as t, payment_method, orders, total from public.cash_session_summary((select id from public.cash_sessions where closed_at is null));
select 'R6 cierre' as t, expected_cash, counted_amount, counted_amount - expected_cash as diferencia
  from public.close_cash_session((select id from public.cash_sessions where closed_at is null), 26000, 'faltan 400');
reset role;

-- R7) Otro usuario no puede usar la caja de esta tienda
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform public.open_cash_session((select id from public.stores where slug='cafe-brote'), 0);
  raise exception 'FALLA: abrió caja ajena';
exception when others then raise notice 'R7 caja ajena bloqueada: %', sqlerrm; end $$;
select 'R7 no ve sesiones' as t, count(*) = 0 as ok from public.cash_sessions;
reset role;
