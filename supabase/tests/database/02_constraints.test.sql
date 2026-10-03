-- Milestone 2 — constraints, snapshots, append-only history, order numbers.
begin;
-- Hosted CLI runs connect as cli_login_postgres; run as postgres (as locally).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(46);

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Sourdough', 'sourdough'),
  ('10000000-0000-0000-0000-000000000002', 'Chocolate Cake', 'chocolate-cake');

-- 2026-10-06 is a Tuesday.
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', '2026-10-06', '2026-10-10', 'PUBLISHED', now());

insert into public.weekly_menu_products
  (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 10);

-- ---------- profiles ----------
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'CUSTOMER', 'new auth user gets a CUSTOMER profile');

-- ---------- addresses ----------
insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state, is_default)
values ('00000000-0000-0000-0000-00000000000a', 'Home', 'A', '0800', '1 Road', 'Abuja', 'FCT', true);
select throws_ok(
  $$insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state, is_default)
    values ('00000000-0000-0000-0000-00000000000a', 'Work', 'A', '0800', '2 Road', 'Abuja', 'FCT', true)$$,
  '23505', null, 'only one default address per customer');
select lives_ok(
  $$insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state)
    values ('00000000-0000-0000-0000-00000000000a', 'Work', 'A', '0800', '2 Road', 'Abuja', 'FCT')$$,
  'multiple non-default addresses allowed');

-- ---------- products & categories ----------
select throws_ok(
  $$insert into public.products (name, slug) values ('Dup', 'sourdough')$$,
  '23505', null, 'product slug is unique');
select throws_ok(
  $$insert into public.products (name, slug) values ('Bad', 'Bad Slug!')$$,
  '23514', null, 'product slug format enforced');
update public.products set category_id = (select id from public.categories where slug = 'bread')
  where id = '10000000-0000-0000-0000-000000000001';
delete from public.categories where slug = 'bread';
select is(
  (select category_id from public.products where id = '10000000-0000-0000-0000-000000000001'),
  null, 'deleting a category leaves its products uncategorized');
select throws_ok(
  $$delete from public.products where id = '10000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'a product used on a weekly menu cannot be hard-deleted');

-- ---------- weekly menus ----------
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end) values ('2026-10-07', '2026-10-11')$$,
  '23514', null, 'menu must start on a Tuesday');
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end) values ('2026-10-13', '2026-10-18')$$,
  '23514', null, 'menu must end on the Saturday of the same week');
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end, status, published_at)
    values ('2026-10-13', '2026-10-17', 'PUBLISHED', now())$$,
  '23505', null, 'only one PUBLISHED menu');
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end, status) values ('2026-10-13', '2026-10-17', 'PUBLISHED')$$,
  '23514', null, 'published menu requires published_at');
select lives_ok(
  $$insert into public.weekly_menus (id, week_start, week_end) values
    ('20000000-0000-0000-0000-000000000002', '2026-10-13', '2026-10-17')$$,
  'a draft can exist alongside the published menu');
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end) values ('2026-10-20', '2026-10-24')$$,
  '23505', null, 'only one DRAFT menu');
select throws_ok(
  $$insert into public.weekly_menus (week_start, week_end) values ('2026-10-06', '2026-10-10')$$,
  '23505', null, 'one menu per week');

-- ---------- weekly menu products ----------
select throws_ok(
  $$insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Again', 100, 1)$$,
  '23505', null, 'no duplicate product within a weekly menu');
select throws_ok(
  $$insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Cake', 0, 1)$$,
  '23514', null, 'price must be positive');
select throws_ok(
  $$insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Cake', 100, -1)$$,
  '23514', null, 'weekly quantity cannot be negative');

-- ---------- carts ----------
insert into public.carts (id, user_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.carts (user_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  '23505', null, 'one cart per customer');
insert into public.cart_items (cart_id, weekly_menu_product_id, quantity) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2);
select throws_ok(
  $$insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
    values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1)$$,
  '23505', null, 'one cart line per weekly-menu product');
select throws_ok(
  $$update public.cart_items set quantity = 0$$,
  '23514', null, 'cart quantity must be positive');

-- ---------- payments ----------
insert into public.payments (id, user_id, reference, amount, checkout_snapshot) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   'ref-1', 13000, '{"items": []}');
select is(
  (select status::text from public.payments where reference = 'ref-1'),
  'PENDING', 'payments start PENDING with no order');
select throws_ok(
  $$insert into public.payments (user_id, reference, amount, checkout_snapshot)
    values ('00000000-0000-0000-0000-00000000000a', 'ref-1', 100, '{}')$$,
  '23505', null, 'payment reference is unique');
select throws_ok(
  $$insert into public.payments (user_id, reference, amount, currency, checkout_snapshot)
    values ('00000000-0000-0000-0000-00000000000a', 'ref-usd', 100, 'USD', '{}')$$,
  '23514', null, 'currency must be NGN');
select throws_ok(
  $$insert into public.payments (user_id, reference, amount, provider, checkout_snapshot)
    values ('00000000-0000-0000-0000-00000000000a', 'ref-fw', 100, 'FLUTTERWAVE', '{}')$$,
  '23514', null, 'Paystack is the only provider');
select throws_ok(
  $$update public.payments set status = 'PAID' where reference = 'ref-1'$$,
  '23514', null, 'PAID payment requires paid_at');

-- ---------- inventory ----------
select throws_ok(
  $$insert into public.inventory_reservations (weekly_menu_product_id, quantity, reservation_type, expires_at)
    values ('30000000-0000-0000-0000-000000000001', 1, 'PAYMENT_TEMPORARY', now())$$,
  '23514', null, 'temporary reservation must reference a payment');
select throws_ok(
  $$insert into public.inventory_reservations (weekly_menu_product_id, payment_id, quantity, reservation_type)
    values ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'PAYMENT_TEMPORARY')$$,
  '23514', null, 'temporary reservation must have expires_at');
select lives_ok(
  $$insert into public.inventory_reservations (weekly_menu_product_id, payment_id, quantity, reservation_type, expires_at)
    values ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 2, 'PAYMENT_TEMPORARY', now() + interval '1 hour')$$,
  'valid temporary reservation accepted');
select throws_ok(
  $$insert into public.inventory_reservations (weekly_menu_product_id, quantity, reservation_type)
    values ('30000000-0000-0000-0000-000000000001', 1, 'ORDER_CONFIRMED')$$,
  '23514', null, 'confirmed reservation must reference an order');
select throws_ok(
  $$insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
    values ('30000000-0000-0000-0000-000000000001', -3, 'oops', '00000000-0000-0000-0000-00000000000a')$$,
  '23514', null, 'inventory adjustments are positive only');
insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
  values ('30000000-0000-0000-0000-000000000001', 5, 'Extra batch', '00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.inventory_adjustments set quantity = 50$$,
  '23001', null, 'inventory adjustments cannot be edited');

-- ---------- orders ----------
insert into public.orders (id, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at)
values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
  '2026-10-08', 'A', '0800', 'a@example.com', '1 Road', 'Abuja', 'FCT', 13000, now());
insert into public.orders (id, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at)
values ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b',
  '2026-10-09', 'B', '0800', 'b@example.com', '2 Road', 'Abuja', 'FCT', 6500, now());

select matches(
  (select order_number from public.orders where id = '60000000-0000-0000-0000-000000000001'),
  '^SAM-[0-9]{4,}$', 'order number has SAM-#### format');
select ok(
  (select substr(b.order_number, 5)::int > substr(a.order_number, 5)::int
   from public.orders a, public.orders b
   where a.id = '60000000-0000-0000-0000-000000000001' and b.id = '60000000-0000-0000-0000-000000000002'),
  'order numbers come from an increasing sequence');
select throws_ok(
  $$insert into public.orders (user_id, delivery_date, recipient_name, phone, email,
      delivery_address, delivery_city, delivery_state, subtotal, paid_at)
    values ('00000000-0000-0000-0000-00000000000a', '2026-10-11', 'A', '0800', 'a@example.com',
      '1 Road', 'Abuja', 'FCT', 100, now())$$,
  '23514', null, 'Sunday delivery rejected');
select throws_ok(
  $$insert into public.orders (user_id, delivery_date, recipient_name, phone, email,
      delivery_address, delivery_city, delivery_state, subtotal, paid_at)
    values ('00000000-0000-0000-0000-00000000000a', '2026-10-12', 'A', '0800', 'a@example.com',
      '1 Road', 'Abuja', 'FCT', 100, now())$$,
  '23514', null, 'Monday delivery rejected');
select throws_ok(
  $$insert into public.orders (user_id, delivery_date, recipient_name, phone, email,
      delivery_address, delivery_city, delivery_state, subtotal, paid_at, payment_status)
    values ('00000000-0000-0000-0000-00000000000a', '2026-10-08', 'A', '0800', 'a@example.com',
      '1 Road', 'Abuja', 'FCT', 100, now(), 'PENDING')$$,
  '23514', null, 'orders cannot exist with an unpaid payment status');
select throws_ok(
  $$insert into public.orders (user_id, delivery_date, recipient_name, phone, email,
      delivery_address, delivery_city, delivery_state, subtotal, paid_at, special_notes)
    values ('00000000-0000-0000-0000-00000000000a', '2026-10-08', 'A', '0800', 'a@example.com',
      '1 Road', 'Abuja', 'FCT', 100, now(), repeat('x', 501))$$,
  '23514', null, 'special notes limited to 500 characters');
select throws_ok(
  $$update public.orders set order_status = 'CANCELLED' where id = '60000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cancelled order requires cancelled_at');
select throws_ok(
  $$update public.payments set order_id = '60000000-0000-0000-0000-000000000001', status = 'PAID', paid_at = now()
      where reference = 'ref-1';
    insert into public.payments (order_id, user_id, reference, amount, checkout_snapshot, status, paid_at)
      values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'ref-2', 100, '{}', 'PAID', now())$$,
  '23505', null, 'one payment per order');

-- ---------- order items (historical snapshots) ----------
insert into public.order_items (id, order_id, weekly_menu_product_id, product_name, unit_price, quantity, line_total)
values ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 2, 13000);
select throws_ok(
  $$insert into public.order_items (order_id, product_name, unit_price, quantity, line_total)
    values ('60000000-0000-0000-0000-000000000001', 'Bad', 6500, 2, 1)$$,
  '23514', null, 'line_total must equal unit_price x quantity');
select throws_ok(
  $$update public.order_items set unit_price = 1, line_total = 2 where id = '70000000-0000-0000-0000-000000000001'$$,
  '23001', null, 'order item snapshots cannot be changed');
select throws_ok(
  $$delete from public.order_items where id = '70000000-0000-0000-0000-000000000001'$$,
  '23001', null, 'order items cannot be deleted');
update public.products set name = 'Renamed Sourdough' where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select product_name from public.order_items where id = '70000000-0000-0000-0000-000000000001'),
  'Sourdough', 'Product Library edits do not change historical order items');
select throws_ok(
  $$delete from public.orders where id = '60000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'orders with items cannot be deleted');

-- ---------- audit log ----------
insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
values (null, 'MENU_PUBLISHED', 'weekly_menu', '20000000-0000-0000-0000-000000000001', '{"week": "2026-10-06"}');
select throws_ok(
  $$update public.audit_logs set action = 'TAMPERED'$$,
  '23001', null, 'audit logs cannot be edited');
select throws_ok(
  $$delete from public.audit_logs$$,
  '23001', null, 'audit logs cannot be deleted');

select * from finish();
rollback;
