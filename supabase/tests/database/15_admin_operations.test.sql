-- Milestone 16 — admin inventory view and customer lookup (admin only).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'zq-ada-ops@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'zq-bayo-ops@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'zq-admin-ops@example.com');
update public.profiles set role = 'ADMIN', full_name = 'Zq Admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set full_name = 'Zq Ada Opsfixture', phone = '0809990001' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set full_name = 'Zq Bayo Opsfixture' where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.products (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'Loaf', 'ops-loaf');
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now());
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity, low_stock_threshold) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Loaf', 5000, 10, 8);

-- Customer A has two orders (SAM-950002 is the latest); B has none.
insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at, created_at) values
  ('62000000-0000-0000-0000-000000000001', 'SAM-950001', '00000000-0000-0000-0000-0000000000a1', '2030-01-03', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 5000, now(), now() - interval '2 days'),
  ('62000000-0000-0000-0000-000000000002', 'SAM-950002', '00000000-0000-0000-0000-0000000000a1', '2030-01-03', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 5000, now(), now());
insert into public.payments (id, user_id, reference, amount, status, checkout_snapshot) values
  ('72000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'ops-ref-1', 5000, 'PENDING', '{}');

-- Capacity 10 + 3 added. Active: 2 pending (unexpired), 4 confirmed.
-- Not counted: 1 expired-by-time hold, 1 released confirmed.
insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by) values
  ('30000000-0000-0000-0000-000000000001', 3, 'Extra batch', '00000000-0000-0000-0000-0000000000ad');
insert into public.inventory_reservations (weekly_menu_product_id, order_id, payment_id, quantity, reservation_type, status, expires_at, released_at) values
  ('30000000-0000-0000-0000-000000000001', null, '72000000-0000-0000-0000-000000000001', 2, 'PAYMENT_TEMPORARY', 'ACTIVE', now() + interval '10 minutes', null),
  ('30000000-0000-0000-0000-000000000001', null, '72000000-0000-0000-0000-000000000001', 1, 'PAYMENT_TEMPORARY', 'ACTIVE', now() - interval '1 minute', null),
  ('30000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', null, 4, 'ORDER_CONFIRMED', 'ACTIVE', null, null),
  ('30000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002', null, 1, 'ORDER_CONFIRMED', 'RELEASED', null, now());

-- ---------- authorization ----------
set local role anon;
select throws_ok($$select * from public.get_menu_inventory('20000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon: no inventory');
select throws_ok($$select * from public.admin_list_customers()$$, '42501', null, 'anon: no customer list');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select * from public.get_menu_inventory('20000000-0000-0000-0000-000000000001')$$, '42501', 'FORBIDDEN', 'customers: no inventory');
select throws_ok($$select * from public.admin_list_customers()$$, '42501', 'FORBIDDEN', 'customers: no customer list');
select throws_ok($$select * from public.admin_get_customer('00000000-0000-0000-0000-0000000000b1')$$, '42501', 'FORBIDDEN',
  'customers cannot look up other customers');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 5, 'sneaky')$$, '42501', 'FORBIDDEN',
  'customers cannot add stock');

-- ---------- inventory view ----------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select results_eq(
  $$select name, weekly_quantity, added_quantity, reserved_pending, reserved_confirmed, available_quantity, low_stock_threshold, availability_status
      from public.get_menu_inventory('20000000-0000-0000-0000-000000000001')$$,
  $$values ('Loaf', 10, 3, 2, 4, 7, 8, 'LOW_STOCK')$$,
  'capacity + additions − active reservations; expired and released holds ignored');

select is(public.add_inventory('30000000-0000-0000-0000-000000000001', 5, 'Second oven run'), 12,
  'adding stock returns the resulting availability');
select results_eq(
  $$select added_quantity, available_quantity, availability_status from public.get_menu_inventory('20000000-0000-0000-0000-000000000001')$$,
  $$values (8, 12, 'AVAILABLE')$$, 'inventory view reflects the addition');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 0, 'zero')$$, 'P0001', 'INVALID_QUANTITY',
  'only positive additions');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', -2, 'reduce')$$, 'P0001', 'INVALID_QUANTITY',
  'no stock reduction');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 1, '  ')$$, 'P0001', 'INVALID_REASON',
  'a reason is required');

-- ---------- customers ----------
select results_eq(
  $$select full_name, email, phone, order_count, last_order_number from public.admin_list_customers('opsfixture') order by full_name$$,
  $$values ('Zq Ada Opsfixture', 'zq-ada-ops@example.com', '0809990001', 2, 'SAM-950002'),
           ('Zq Bayo Opsfixture', 'zq-bayo-ops@example.com', null::text, 0, null::text)$$,
  'lists customers with order count and most recent order');
select results_eq($$select full_name from public.admin_list_customers('ZQ-BAYO-OPS@')$$, $$values ('Zq Bayo Opsfixture')$$,
  'search by email, case-insensitive');
select results_eq($$select full_name from public.admin_list_customers('0809990001')$$, $$values ('Zq Ada Opsfixture')$$,
  'search by phone');
select is((select count(*)::int from public.admin_list_customers('zq-admin-ops')), 0, 'admins are not listed as customers');
select is((select count(*)::int from public.admin_list_customers('zq%ops')), 0, 'search treats % literally');
select results_eq($$select email from public.admin_get_customer('00000000-0000-0000-0000-0000000000a1')$$,
  $$values ('zq-ada-ops@example.com')$$, 'admin opens a customer');
select is((select count(*)::int from public.admin_get_customer('00000000-0000-0000-0000-0000000000ad')), 0,
  'an admin account is not a customer record');

select * from finish();
rollback;
