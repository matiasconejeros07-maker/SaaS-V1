\set ON_ERROR_STOP 1
insert into auth.users values ('33333333-3333-3333-3333-333333333333','staff@test.cl');
insert into public.store_members (store_id, user_id, role) select id, '33333333-3333-3333-3333-333333333333', 'staff' from public.stores where slug='cafe-brote';

-- H1) Slug reservado y nombre corto dan mensajes en español
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin perform public.create_store('Cocina Linda','cocina','56912345678'); raise exception 'FALLA: aceptó slug cocina';
exception when others then raise notice 'H1 slug reservado: %', sqlerrm; end $$;
do $$ begin perform public.create_store('X','x-tienda','56912345678'); raise exception 'FALLA: aceptó nombre corto';
exception when others then raise notice 'H1 nombre corto: %', sqlerrm; end $$;
reset role;

-- H2) Staff no puede cambiar precios, sí marcar agotado
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin update public.products set price = 1 where name='Flat white'; raise exception 'FALLA: staff cambió precio';
exception when others then raise notice 'H2 staff precio bloqueado: %', sqlerrm; end $$;
update public.products set is_available = false where name='Flat white';
select 'H2 staff agotado' as t, is_available = false as ok from public.products where name='Flat white';
update public.products set is_available = true where name='Flat white';
reset role;

-- H3) Nadie mueve ventas entre cajas desde el navegador
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin update public.orders set cash_session_id = null where cash_session_id is not null; raise exception 'FALLA: movió venta de caja';
exception when others then raise notice 'H3 caja inmutable: %', sqlerrm; end $$;

-- H3b) Borrar una mesa con pedidos antiguos sí funciona (el pedido queda sin mesa)
delete from public.tables where label = 'Mesa 4';
select 'H3b mesa borrada' as t, count(*) = 0 as ok from public.tables where label = 'Mesa 4';
do $$ begin update public.orders set table_id = gen_random_uuid() where number = 1001; raise exception 'FALLA: cambió la mesa';
exception when others then raise notice 'H3b mesa no se reasigna: %', sqlerrm; end $$;

-- H4) Horario atómico: si un día es inválido no se pierde el horario anterior
select count(*) as dias_antes from public.opening_hours \gset
do $$ begin perform public.set_opening_hours((select id from public.stores where slug='cafe-brote'),
  '[{"weekday":1,"opens":"09:00","closes":"18:00"},{"weekday":2,"opens":"20:00","closes":"10:00"}]');
  raise exception 'FALLA: aceptó horario inválido';
exception when others then raise notice 'H4 horario inválido: %', sqlerrm; end $$;
select 'H4 horario intacto' as t, count(*) = :dias_antes as ok from public.opening_hours;

-- H5) Stock en 0 se agota solo y vuelve al reponer
update public.products set track_stock = true, stock = 0 where name='Flat white';
select 'H5 agotado auto' as t, is_available = false as ok from public.products where name='Flat white';
update public.products set stock = 5 where name='Flat white';
select 'H5 disponible al reponer' as t, is_available as ok from public.products where name='Flat white';
update public.products set track_stock = false where name='Flat white';

-- H6) Cobrar un pedido web en caja
select public.open_cash_session((select id from public.stores where slug='cafe-brote'), 0) is not null as abierta \gset
select public.mark_order_paid((select id from public.orders where number=1001), 'cash');
select 'H6 pagado' as t, payment_status, cash_session_id is not null as en_caja from public.orders where number=1001;

-- H7) Gráfico de ventas: 14 días
select 'H7 dias' as t, count(*) from public.daily_sales((select id from public.stores where slug='cafe-brote'), 14);
reset role;

-- H8) La dueña no se puede quitar a sí misma
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from public.store_members where user_id = '11111111-1111-1111-1111-111111111111';
select 'H8 dueña sigue' as t, count(*) = 1 as ok from public.store_members where role = 'owner' and store_id = (select id from public.stores where slug='cafe-brote');
reset role;
