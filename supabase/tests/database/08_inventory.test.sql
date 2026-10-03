-- Milestone 9 — inventory transactions (single-session behaviour).
-- True concurrency is covered by tests/integration/inventory-concurrency.test.ts.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(51);

-- ---------- fixtures ----------
update public.weekly_menus set status = 'EXPIRED', expired_at = now(), published_at = coalesce(published_at, now())
 where status in ('PUBLISHED', 'DRAFT');
update public.system_settings set value = '"23:59"' where key = 'ORDER_CUTOFF_TIME';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN', full_name = 'Admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set full_name = 'Customer A' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Sourdough', 'inv-sourdough'),
  ('10000000-0000-0000-0000-000000000002', 'Old Bake', 'inv-old');
insert into public.weekly_menus (id, week_start, week_end, status, published_at, expired_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now(), null),
  ('20000000-0000-0000-0000-000000000009', menu_week_start_for(lagos_today()) - 7, menu_week_start_for(lagos_today()) - 3, 'EXPIRED', now(), now());
set local session_replication_role = replica; -- history fixture on an expired menu
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity, low_stock_threshold) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 3, 1),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'Old Bake', 1000, 5, 0);
set local session_replication_role = origin;

insert into public.addresses (id, user_id, label, recipient_name, phone, address_line, city, state, is_default) values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Home', 'Ada', '0803', '1 Road', 'Abuja', 'FCT', true),
  ('40000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Home', 'Bola', '0803', '2 Road', 'Abuja', 'FCT', true);
insert into public.carts (id, user_id) values
  ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');
insert into public.cart_items (cart_id, weekly_menu_product_id, quantity) values
  ('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000001', 2);

create temp table ctx (k text primary key, v jsonb) on commit drop;
grant all on ctx to authenticated;
create temp table delivery (d date) on commit drop;
insert into delivery select max(d) from eligible_delivery_dates() d;
grant select on delivery to authenticated;

-- ---------- settings ----------
select is(reservation_timeout_minutes(), 15, 'temporary reservations last 15 minutes (owner decision)');

-- ---------- anon ----------
set local role anon;
select throws_ok($$select public.reserve_checkout_inventory(current_date, gen_random_uuid(), null)$$,
  '42501', null, 'anon cannot reserve');

-- ---------- customer A reserves 2 of 3 ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select throws_ok($$select public.reserve_checkout_inventory(menu_week_start_for(lagos_today()) - 1,
    '40000000-0000-0000-0000-0000000000a1', null)$$,
  'P0001', 'DELIVERY_DATE_INVALID', 'Monday delivery is rejected');
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000b1', null)$$,
  'P0002', 'ADDRESS_NOT_FOUND', 'cannot use another customer''s address');
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000a1', repeat('x', 501))$$,
  'P0001', 'NOTES_TOO_LONG', 'notes over 500 characters are rejected');

insert into ctx select 'a1', public.reserve_checkout_inventory((select d from delivery),
  '40000000-0000-0000-0000-0000000000a1', '  Ring the bell  ');
select is((select (v ->> 'amount')::numeric from ctx where k = 'a1'), 13000::numeric,
  'amount is derived from server prices (2 × ₦6,500)');
select is((select v ->> 'currency' from ctx where k = 'a1'), 'NGN', 'currency is NGN');
select matches((select v ->> 'reference' from ctx where k = 'a1'), '^SAMY-[0-9A-F]{32}$', 'unique server reference');
select ok((select v ? 'payment_id' and not (v ? 'secret') from ctx where k = 'a1'), 'returns payment context without secrets');

set local role postgres;
select results_eq(
  $$select status::text, amount, user_id from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')$$,
  $$values ('PENDING', 13000.00::numeric, '00000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'a PENDING payment exists (no order yet)');
select is(
  (select checkout_snapshot #>> '{address,recipient_name}' from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  'Ada', 'snapshot holds the delivery address');
select is(
  (select checkout_snapshot ->> 'special_notes' from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  'Ring the bell', 'snapshot holds trimmed notes');
select is(
  (select jsonb_array_length(checkout_snapshot -> 'lines') from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  1, 'snapshot holds the priced lines');
select results_eq(
  $$select reservation_type::text, status::text, quantity,
           expires_at between now() + interval '14 minutes' and now() + interval '16 minutes'
      from public.inventory_reservations where payment_id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')$$,
  $$values ('PAYMENT_TEMPORARY', 'ACTIVE', 2, true)$$,
  'temporary reservation created for 15 minutes');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 1, 'availability drops to 1');
select is(availability_status(available_quantity('30000000-0000-0000-0000-000000000001'), 1), 'LOW_STOCK',
  'low-stock state at the threshold');
select is((select count(*)::int from public.orders), (select count(*)::int from public.orders),
  'no order is created by reserving');

-- ---------- customer B: exact remaining stock, then sold out ----------
insert into public.cart_items (cart_id, weekly_menu_product_id, quantity) values
  ('50000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 2);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000b1', null)$$,
  'P0001', 'OUT_OF_STOCK', 'insufficient stock: 2 requested, 1 available');
select throws_ok($$select public.release_inventory_reservation((select (v ->> 'payment_id')::uuid from ctx where k = 'a1'))$$,
  'P0002', 'NOT_FOUND', 'B cannot release A''s reservation');

set local role postgres;
update public.cart_items set quantity = 1 where cart_id = '50000000-0000-0000-0000-0000000000b1';
set local role authenticated;
insert into ctx select 'b1', public.reserve_checkout_inventory((select d from delivery),
  '40000000-0000-0000-0000-0000000000b1', null);
set local role postgres;
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 0, 'exact stock purchase leaves 0');
select is(availability_status(available_quantity('30000000-0000-0000-0000-000000000001'), 1), 'SOLD_OUT',
  'sold-out transition');

-- ---------- A retries: previous hold is released, but restored if the retry fails ----------
set local role postgres;
update public.cart_items set quantity = 3 where cart_id = '50000000-0000-0000-0000-0000000000a1';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000a1', null)$$,
  'P0001', 'OUT_OF_STOCK', 'retry for 3 fails (only 2 free after releasing A''s own hold)');
set local role postgres;
select is(
  (select status::text from public.inventory_reservations where payment_id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  'ACTIVE', 'a failed retry rolls back: A''s original hold is intact');

update public.cart_items set quantity = 2 where cart_id = '50000000-0000-0000-0000-0000000000a1';
set local role authenticated;
insert into ctx select 'a2', public.reserve_checkout_inventory((select d from delivery),
  '40000000-0000-0000-0000-0000000000a1', null);
set local role postgres;
select is(
  (select status::text from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  'FAILED', 'a successful retry supersedes the earlier unpaid attempt');
select is(
  (select status::text from public.inventory_reservations where payment_id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a1')),
  'RELEASED', 'and releases its hold');
select is((select count(*)::int from public.payments where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'PENDING'),
  1, 'the customer has exactly one pending payment');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 0, 'stock is never held twice');

-- ---------- release ----------
set local role authenticated;
select is(public.release_inventory_reservation((select (v ->> 'payment_id')::uuid from ctx where k = 'a2')), 1,
  'owner releases their pending payment');
set local role postgres;
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 2, 'reservation release restores availability');
select is(
  (select status::text from public.payments where id = (select (v ->> 'payment_id')::uuid from ctx where k = 'a2')),
  'FAILED', 'released payment is FAILED (no completed order)');
select is(public.release_inventory_reservation((select (v ->> 'payment_id')::uuid from ctx where k = 'a2')), 0,
  'releasing twice is harmless');

-- ---------- expiry ----------
update public.inventory_reservations set expires_at = now() - interval '1 second'
 where payment_id = (select (v ->> 'payment_id')::uuid from ctx where k = 'b1');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 3, 'an expired hold stops counting immediately');
select is(expire_temporary_reservations(), 1, 'expiry job marks it EXPIRED');
select is(
  (select status::text from public.inventory_reservations where payment_id = (select (v ->> 'payment_id')::uuid from ctx where k = 'b1')),
  'EXPIRED', 'reservation is EXPIRED');
select is(expire_temporary_reservations(), 0, 'expiry is idempotent');

-- ---------- off-menu / empty cart ----------
insert into public.cart_items (cart_id, weekly_menu_product_id, quantity) values
  ('50000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000009', 1)
  on conflict do nothing;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000b1', null)$$,
  'P0001', 'PRODUCT_UNAVAILABLE', 'products from another menu cannot be reserved');
set local role postgres;
delete from public.cart_items where cart_id = '50000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select throws_ok($$select public.reserve_checkout_inventory((select d from delivery),
    '40000000-0000-0000-0000-0000000000b1', null)$$,
  'P0001', 'CART_EMPTY', 'an empty cart cannot be reserved');

-- ---------- add_inventory ----------
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 5, 'free cake')$$,
  '42501', null, 'customers cannot increase stock');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 0, 'none')$$,
  'P0001', 'INVALID_QUANTITY', 'zero is rejected');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', -2, 'reduce')$$,
  'P0001', 'INVALID_QUANTITY', 'stock cannot be reduced');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000001', 2, '  ')$$,
  'P0001', 'INVALID_REASON', 'a reason is required');
select throws_ok($$select public.add_inventory('30000000-0000-0000-0000-000000000009', 2, 'late')$$,
  'P0001', 'MENU_EXPIRED', 'expired menus cannot be restocked');
select is(public.add_inventory('30000000-0000-0000-0000-000000000001', 5, 'Extra batch'), 8,
  'inventory increase: 3 + 5 = 8 available');
set local role postgres;
select results_eq(
  $$select quantity, reason, created_by from public.inventory_adjustments
     where weekly_menu_product_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values (5, 'Extra batch', '00000000-0000-0000-0000-0000000000ad'::uuid)$$,
  'adjustment records quantity, reason and admin');
select results_eq(
  $$select (metadata ->> 'available_before')::int, (metadata ->> 'available_after')::int from public.audit_logs
     where action = 'INVENTORY_INCREASED' and entity_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values (3, 8)$$,
  'stock increase is audited with resulting availability');
select is((select weekly_quantity from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000001'),
  3, 'original weekly quantity is preserved');

-- ---------- timeout setting ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok('select public.set_reservation_timeout(30)', '42501', null, 'customers cannot change the timeout');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok('select public.set_reservation_timeout(2)', 'P0001', 'INVALID_TIMEOUT', 'too-short timeout rejected');
select lives_ok('select public.set_reservation_timeout(20)', 'admin changes the timeout');
select is(reservation_timeout_minutes(), 20, 'timeout updated');

set local role postgres;
select is((select count(*)::int from cron.job where jobname = 'expire-temporary-reservations'), 1,
  'reservation expiry job is scheduled');

select * from finish();
rollback;
