-- Milestone 6 — availability calculation and public exposure.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- ---------- classification ----------
select is(availability_status(0, 3), 'SOLD_OUT', '0 left → SOLD_OUT');
select is(availability_status(2, 3), 'LOW_STOCK', 'at or below threshold → LOW_STOCK');
select is(availability_status(3, 3), 'LOW_STOCK', 'equal to threshold → LOW_STOCK');
select is(availability_status(4, 3), 'AVAILABLE', 'above threshold → AVAILABLE');
select is(availability_status(1, 0), 'AVAILABLE', 'threshold 0 never shows low stock');

-- ---------- fixtures ----------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@example.com');
insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Sourdough', 'avail-sourdough'),
  ('10000000-0000-0000-0000-000000000002', 'Brioche', 'avail-brioche');
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', public.menu_week_start_for(public.lagos_today()),
   public.menu_week_start_for(public.lagos_today()) + 4, 'PUBLISHED', now()),
  ('20000000-0000-0000-0000-000000000002', public.menu_week_start_for(public.lagos_today()) + 7,
   public.menu_week_start_for(public.lagos_today()) + 11, 'DRAFT', null);
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity, low_stock_threshold) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 10, 3),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Brioche', 5000, 5, 0);
insert into public.payments (id, user_id, reference, amount, checkout_snapshot) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'avail-ref', 1, '{}');
insert into public.orders (id, user_id, delivery_date, recipient_name, phone, email, delivery_address,
  delivery_city, delivery_state, subtotal, paid_at) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '2026-10-08', 'A', '0800',
   'a@example.com', 'Road', 'Abuja', 'FCT', 1, now());

select is(available_quantity('30000000-0000-0000-0000-000000000001'), 10, 'starts at weekly quantity');

-- Confirmed order reservation counts.
insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type)
values ('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 4, 'ORDER_CONFIRMED');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 6, 'confirmed reservation reduces availability');

-- Active, unexpired temporary reservation counts.
insert into public.inventory_reservations (weekly_menu_product_id, payment_id, quantity, reservation_type, expires_at)
values ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 2, 'PAYMENT_TEMPORARY', now() + interval '10 minutes');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 4, 'unexpired temporary reservation counts');

-- Expired temporary reservation (not yet swept) does not count.
insert into public.inventory_reservations (weekly_menu_product_id, payment_id, quantity, reservation_type, expires_at)
values ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 3, 'PAYMENT_TEMPORARY', now() - interval '1 minute');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 4, 'expired temporary reservation does not count');

-- Released / converted reservations do not count.
insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type, status, released_at)
values ('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 5, 'ORDER_CONFIRMED', 'RELEASED', now());
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 4, 'released reservation does not count');

-- Admin stock increase adds capacity.
insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
values ('30000000-0000-0000-0000-000000000001', 5, 'Extra batch', '00000000-0000-0000-0000-0000000000a1');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 9, 'stock increase adds capacity');

-- Never negative.
insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type)
values ('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 50, 'ORDER_CONFIRMED');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 0, 'availability never goes below zero');

-- ---------- public function ----------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select results_eq(
  $$select weekly_menu_product_id, available_quantity, availability_status
      from public.get_published_menu_availability()
     where weekly_menu_product_id::text like '30000000-%'$$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid, 0, 'SOLD_OUT')$$,
  'anon gets availability for published products only (draft excluded)');
select throws_ok(
  $$select public.available_quantity('30000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'anon cannot query availability of arbitrary (draft) products');
select throws_ok('select * from public.inventory_reservations', '42501', null,
  'anon still cannot read reservations');

-- Ended menu disappears from public availability immediately.
set local role postgres;
update public.weekly_menus set week_start = week_start - 14, week_end = week_end - 14
 where id = '20000000-0000-0000-0000-000000000001';
set local role anon;
select is(
  (select count(*)::int from public.get_published_menu_availability() where weekly_menu_product_id::text like '30000000-%'),
  0, 'ended menu returns no availability');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(
  (select count(*)::int from public.get_published_menu_availability() where weekly_menu_product_id::text like '30000000-%'),
  0, 'customers get the same public view');
select throws_ok(
  $$select public.available_quantity('30000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'customers cannot query availability of arbitrary (draft) products');

select * from finish();
rollback;
