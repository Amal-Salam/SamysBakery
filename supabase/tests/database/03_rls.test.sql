-- Milestone 3 — RLS: allowed and denied access for anon, customers and admins.
-- Spec: docs/Database_Security_&_Transaction_Specs.md §4–9, §34; AGENTS.md §49.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(69);

-- ---------- fixtures (as postgres) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'On published menu', 'published-product'),
  ('10000000-0000-0000-0000-000000000002', 'Only on draft menu', 'draft-product'),
  ('10000000-0000-0000-0000-000000000003', 'Not on any menu', 'library-only');

insert into public.product_images (product_id, storage_path) values
  ('10000000-0000-0000-0000-000000000001', 'products/published.jpg'),
  ('10000000-0000-0000-0000-000000000002', 'products/draft.jpg');

-- Dates are relative to today in Lagos so the published menu is always current.
insert into public.weekly_menus (id, week_start, week_end, status, published_at, expired_at) values
  ('20000000-0000-0000-0000-000000000001', public.menu_week_start_for(public.lagos_today()),
   public.menu_week_start_for(public.lagos_today()) + 4, 'PUBLISHED', now(), null),
  ('20000000-0000-0000-0000-000000000002', public.menu_week_start_for(public.lagos_today()) + 7,
   public.menu_week_start_for(public.lagos_today()) + 11, 'DRAFT', null, null),
  ('20000000-0000-0000-0000-000000000003', public.menu_week_start_for(public.lagos_today()) - 7,
   public.menu_week_start_for(public.lagos_today()) - 3, 'EXPIRED', now(), now());

-- Historical fixture rows: load with triggers paused (expired menus are frozen).
set local session_replication_role = replica;
insert into public.weekly_menu_products
  (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Published', 5000, 10),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', 'Draft', 5000, 10),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003', 'Expired', 5000, 10);
set local session_replication_role = origin;

insert into public.addresses (id, user_id, label, recipient_name, phone, address_line, city, state) values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Home', 'A', '0800', 'A Road', 'Abuja', 'FCT'),
  ('40000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Home', 'B', '0800', 'B Road', 'Abuja', 'FCT');

insert into public.carts (id, user_id) values
  ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');
insert into public.cart_items (cart_id, weekly_menu_product_id, quantity) values
  ('50000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 1);

insert into public.orders (id, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at) values
  ('60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'A', '0800', 'a@example.com', 'A Road', 'Abuja', 'FCT', 5000, now()),
  ('60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', '2026-10-08',
   'B', '0800', 'b@example.com', 'B Road', 'Abuja', 'FCT', 5000, now());
insert into public.order_items (order_id, weekly_menu_product_id, product_name, unit_price, quantity, line_total) values
  ('60000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000001', 'Published', 5000, 1, 5000),
  ('60000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'Published', 5000, 1, 5000);
insert into public.payments (id, order_id, user_id, reference, amount, status, paid_at, checkout_snapshot) values
  ('70000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a1', 'ref-a', 5000, 'PAID', now(), '{}'),
  ('70000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b1', 'ref-b', 5000, 'PAID', now(), '{}');
insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type) values
  ('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 1, 'ORDER_CONFIRMED');
insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by) values
  ('30000000-0000-0000-0000-000000000001', 2, 'Extra batch', '00000000-0000-0000-0000-0000000000ad');
insert into public.refunds (order_id, payment_id, amount, created_by) values
  ('60000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-0000000000b1', 5000,
   '00000000-0000-0000-0000-0000000000ad');
insert into public.audit_logs (actor_user_id, action, entity_type) values
  ('00000000-0000-0000-0000-0000000000ad', 'MENU_PUBLISHED', 'weekly_menu');
insert into public.system_settings (key, value) values ('ORDER_CUTOFF_TIME', '"12:00"') on conflict (key) do nothing;

-- =====================================================================
-- Anonymous visitor
-- =====================================================================
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select results_eq('select id from public.weekly_menus',
  $$values ('20000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: sees only the published menu (not draft/expired)');
select results_eq('select id from public.weekly_menu_products',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: sees only published weekly-menu products');
select results_eq('select id from public.products',
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: cannot see library-only or draft-only products');
select is((select count(*)::int from public.product_images), 1,
  'anon: sees only images of published products');
select ok((select count(*)::int from public.categories where slug in ('cakes', 'bread', 'pastries')) = 3, 'anon: can read categories');

select throws_ok('select * from public.profiles', '42501', null, 'anon: profiles denied');
select throws_ok('select * from public.addresses', '42501', null, 'anon: addresses denied');
select throws_ok('select * from public.carts', '42501', null, 'anon: carts denied');
select throws_ok('select * from public.orders', '42501', null, 'anon: orders denied');
select throws_ok('select * from public.order_items', '42501', null, 'anon: order items denied');
select throws_ok('select * from public.payments', '42501', null, 'anon: payments denied');
select throws_ok('select * from public.refunds', '42501', null, 'anon: refunds denied');
select throws_ok('select * from public.inventory_reservations', '42501', null, 'anon: reservations denied');
select throws_ok('select * from public.inventory_adjustments', '42501', null, 'anon: adjustments denied');
select throws_ok('select * from public.audit_logs', '42501', null, 'anon: audit logs denied');
select throws_ok('select * from public.system_settings', '42501', null, 'anon: settings denied');
select throws_ok($$insert into public.products (name, slug) values ('x', 'x')$$,
  '42501', null, 'anon: cannot write the catalogue');

-- =====================================================================
-- Customer A
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

-- Orders, items, payments: own only.
select results_eq('select id from public.orders',
  $$values ('60000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'customer A: reads only own orders');
select is((select count(*)::int from public.orders where id = '60000000-0000-0000-0000-0000000000b1'), 0,
  'customer A: cannot read customer B''s order by id');
select is((select count(*)::int from public.order_items), 1, 'customer A: reads only own order items');
select results_eq('select id from public.payments',
  $$values ('70000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'customer A: reads only own payments');

-- Addresses: own CRUD, nothing on B's.
select results_eq('select id from public.addresses',
  $$values ('40000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'customer A: reads only own addresses');
select lives_ok(
  $$insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state)
    values ('00000000-0000-0000-0000-0000000000a1', 'Work', 'A', '0800', 'A Office', 'Abuja', 'FCT')$$,
  'customer A: can add own address');
select throws_ok(
  $$insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state)
    values ('00000000-0000-0000-0000-0000000000b1', 'Evil', 'X', '0800', 'X', 'Abuja', 'FCT')$$,
  '42501', null, 'customer A: cannot create an address for B');
update public.addresses set address_line = 'hijacked' where id = '40000000-0000-0000-0000-0000000000b1';
delete from public.addresses where id = '40000000-0000-0000-0000-0000000000b1';
select throws_ok(
  $$update public.addresses set user_id = '00000000-0000-0000-0000-0000000000b1'
    where id = '40000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'customer A: cannot reassign an address to B');

-- Cart: own only, published products only.
select results_eq('select id from public.carts',
  $$values ('50000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'customer A: reads only own cart');
select is((select count(*)::int from public.cart_items), 0, 'customer A: cannot see B''s cart items');
select lives_ok(
  $$insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
    values ('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000001', 2)$$,
  'customer A: can add a published product to own cart');
select throws_ok(
  $$insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
    values ('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000002', 1)$$,
  '42501', null, 'customer A: cannot add a draft-menu product to cart');
select throws_ok(
  $$insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
    values ('50000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 1)$$,
  '42501', null, 'customer A: cannot add to B''s cart');
update public.cart_items set quantity = 99 where cart_id = '50000000-0000-0000-0000-0000000000b1';

-- Catalogue: published only, no writes.
select is((select count(*)::int from public.weekly_menus), 1, 'customer A: sees only the published menu');
select is((select count(*)::int from public.products), 1, 'customer A: sees only published products');
select throws_ok($$insert into public.products (name, slug) values ('x', 'x-customer')$$,
  '42501', null, 'customer A: cannot create products');
update public.weekly_menu_products set price = 1 where id = '30000000-0000-0000-0000-000000000001';

-- Orders/payments/inventory/refunds/audit: no client writes.
select throws_ok(
  $$insert into public.orders (user_id, delivery_date, recipient_name, phone, email,
      delivery_address, delivery_city, delivery_state, subtotal, paid_at)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-10-08', 'A', '0800', 'a@example.com',
      'A Road', 'Abuja', 'FCT', 1, now())$$,
  '42501', null, 'customer A: cannot create orders');
select throws_ok(
  $$update public.orders set order_status = 'DELIVERED', delivered_at = now()
    where id = '60000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'customer A: cannot change own order status');
select throws_ok(
  $$update public.payments set status = 'PAID' where id = '70000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'customer A: cannot modify payment status');
select throws_ok(
  $$insert into public.payments (user_id, reference, amount, checkout_snapshot)
    values ('00000000-0000-0000-0000-0000000000a1', 'ref-forged', 1, '{}')$$,
  '42501', null, 'customer A: cannot create payments');
select throws_ok(
  $$insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type)
    values ('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 1, 'ORDER_CONFIRMED')$$,
  '42501', null, 'customer A: cannot create reservations');
select throws_ok(
  $$insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
    values ('30000000-0000-0000-0000-000000000001', 100, 'free cake', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'customer A: cannot modify inventory');
select throws_ok(
  $$insert into public.refunds (order_id, payment_id, amount, created_by)
    values ('60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a1', 5000,
      '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'customer A: cannot create refunds');
select throws_ok(
  $$insert into public.audit_logs (action, entity_type) values ('FAKE', 'x')$$,
  '42501', null, 'customer A: cannot write audit logs');
select is((select count(*)::int from public.inventory_reservations), 0, 'customer A: cannot read reservations');
select is((select count(*)::int from public.inventory_adjustments), 0, 'customer A: cannot read adjustments');
select is((select count(*)::int from public.refunds), 0, 'customer A: cannot read refunds');
select is((select count(*)::int from public.audit_logs), 0, 'customer A: cannot read audit logs');
select is((select count(*)::int from public.system_settings), 0, 'customer A: cannot read settings');
select is((select count(*)::int from public.profiles), 1, 'customer A: cannot read other profiles');

-- =====================================================================
-- Verify customer A's silent no-op attempts changed nothing (as postgres)
-- =====================================================================
set local role postgres;
select is(
  (select address_line from public.addresses where id = '40000000-0000-0000-0000-0000000000b1'),
  'B Road', 'customer A could not modify or delete B''s address');
select is(
  (select quantity from public.cart_items where cart_id = '50000000-0000-0000-0000-0000000000b1'),
  1, 'customer A could not modify B''s cart');
select is(
  (select price from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000001'),
  5000.00::numeric, 'customer A could not change a weekly price');

-- =====================================================================
-- Admin
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select is((select count(*)::int from public.orders where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')), 2, 'admin: reads all customers'' orders');
select is((select count(*)::int from public.order_items where order_id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000b1')), 2, 'admin: reads all order items');
select is((select count(*)::int from public.payments where reference in ('ref-a', 'ref-b')), 2, 'admin: reads all payments');
select is((select count(*)::int from public.addresses where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')), 3, 'admin: reads all addresses');
select is((select count(*)::int from public.weekly_menus where id::text like '20000000-%'), 3, 'admin: reads draft and expired menus');
select is((select count(*)::int from public.products where id::text like '10000000-%'), 3, 'admin: reads the whole Product Library (incl. off-menu products)');
select is((select count(*)::int from public.inventory_reservations where order_id = '60000000-0000-0000-0000-0000000000a1'), 1, 'admin: reads reservations');
select is((select count(*)::int from public.inventory_adjustments where created_by = '00000000-0000-0000-0000-0000000000ad'), 1, 'admin: reads adjustments');
select is((select count(*)::int from public.refunds where order_id = '60000000-0000-0000-0000-0000000000b1'), 1, 'admin: reads refunds');
select is((select count(*)::int from public.audit_logs where actor_user_id = '00000000-0000-0000-0000-0000000000ad'), 1, 'admin: reads audit logs');
select is((select count(*)::int from public.system_settings where key = 'ORDER_CUTOFF_TIME'), 1, 'admin: reads settings');

select lives_ok(
  $$insert into public.products (name, slug) values ('New Loaf', 'new-loaf')$$,
  'admin: can create a product');
select lives_ok(
  $$update public.products set description = 'Updated' where id = '10000000-0000-0000-0000-000000000003'$$,
  'admin: can edit a product');
select lives_ok(
  $$insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Lib', 3000, 5)$$,
  'admin: can add a product to the draft menu');

-- Audited operations are not writable directly, even by admins.
select throws_ok(
  $$update public.products set deleted_at = now() where id = '10000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'admin: product deletion only via the audited operation');
select throws_ok(
  $$update public.weekly_menus set status = 'EXPIRED', expired_at = now()
    where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'admin: menu status only via the audited operation');
select throws_ok(
  $$update public.orders set order_status = 'RECEIVED' where id = '60000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'admin: order status only via the audited operation');
select throws_ok(
  $$insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
    values ('30000000-0000-0000-0000-000000000001', 1, 'x', '00000000-0000-0000-0000-0000000000ad')$$,
  '42501', null, 'admin: stock increases only via the audited operation');
select throws_ok(
  $$update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'admin: cannot grant roles through the client');

select * from finish();
rollback;
