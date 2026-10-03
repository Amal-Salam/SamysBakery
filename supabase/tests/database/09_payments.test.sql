-- Milestone 10 — confirm_payment_order(), failure, late payments, rate limiting.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(48);

-- ---------- fixtures ----------
update public.weekly_menus set status = 'EXPIRED', expired_at = now(), published_at = coalesce(published_at, now())
 where status in ('PUBLISHED', 'DRAFT');
update public.system_settings set value = '"23:59"' where key = 'ORDER_CUTOFF_TIME';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com');
update public.profiles set full_name = 'Ada' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Sourdough', 'pay-sourdough'),
  ('10000000-0000-0000-0000-000000000002', 'Last Cake', 'pay-last-cake');
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now());
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 20),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Last Cake', 9000, 1);
insert into public.addresses (id, user_id, label, recipient_name, phone, address_line, city, state, is_default) values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Home', 'Ada', '0803', '1 Road', 'Abuja', 'FCT', true),
  ('40000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Home', 'Bola', '0803', '2 Road', 'Abuja', 'FCT', true);
insert into public.carts (id, user_id) values
  ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');

create temp table ctx (k text primary key, v jsonb) on commit drop;
grant all on ctx to authenticated;
create temp table delivery (d date) on commit drop;
insert into delivery select max(d) from eligible_delivery_dates() d;
grant select on delivery to authenticated;

-- Helper: customer A puts `qty` of a product in the cart and reserves (as A).
create function pg_temp.reserve_as(customer uuid, address uuid, product uuid, qty int, label text)
returns void language plpgsql as $$
begin
  set local role postgres;
  delete from public.cart_items where cart_id = (select id from public.carts where user_id = customer);
  insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
  values ((select id from public.carts where user_id = customer), product, qty);
  perform set_config('request.jwt.claims', json_build_object('sub', customer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into ctx values (label, public.reserve_checkout_inventory((select d from delivery), address, null));
  set local role postgres;
end;
$$;

create function pg_temp.ref(label text) returns text language sql as $$ select v ->> 'reference' from ctx where k = label $$;
create function pg_temp.pid(label text) returns uuid language sql as $$ select (v ->> 'payment_id')::uuid from ctx where k = label $$;
create function pg_temp.kobo(label text) returns bigint language sql as $$ select round((v ->> 'amount')::numeric * 100)::bigint from ctx where k = label $$;

-- ---------- permissions ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.confirm_payment_order('SAMY-X', 1, 'NGN', now(), 't')$$, '42501', null,
  'customers cannot confirm payments');
select throws_ok($$select public.fail_payment('SAMY-X', 'failed')$$, '42501', null, 'customers cannot fail payments');
select throws_ok($$select public.record_refund_request(gen_random_uuid(), 'r', 's')$$, '42501', null,
  'customers cannot record refunds');
set local role anon;
select throws_ok($$select public.confirm_payment_order('SAMY-X', 1, 'NGN', now(), 't')$$, '42501', null,
  'anon cannot confirm payments');
set local role postgres;

select is(confirm_payment_order('SAMY-UNKNOWN', 1, 'NGN', now(), 't') ->> 'outcome', 'UNKNOWN_REFERENCE',
  'unknown reference is ignored');

-- ---------- successful payment ----------
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 2, 'ok');
select is(pg_temp.kobo('ok'), 1300000::bigint, 'reserved amount is 2 × ₦6,500');

insert into ctx select 'ok_result', confirm_payment_order(pg_temp.ref('ok'), 1300000, 'NGN', now(), 'trx_1');
select is((select v ->> 'outcome' from ctx where k = 'ok_result'), 'CREATED', 'verified payment creates the order');
select matches((select v ->> 'order_number' from ctx where k = 'ok_result'), '^SAM-[0-9]{4,}$', 'order number assigned');

select results_eq(
  $$select user_id, subtotal, payment_status::text, order_status::text, recipient_name, delivery_date
      from public.orders where id = (select (v ->> 'order_id')::uuid from ctx where k = 'ok_result')$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, 13000.00::numeric, 'PAID', 'PAID', 'Ada', (select d from delivery))$$,
  'order holds the customer, server subtotal, PAID status and delivery snapshot');
select results_eq(
  $$select product_name, unit_price, quantity, line_total from public.order_items
     where order_id = (select (v ->> 'order_id')::uuid from ctx where k = 'ok_result')$$,
  $$values ('Sourdough', 6500.00::numeric, 2, 13000.00::numeric)$$,
  'order items are purchase-time snapshots');
select results_eq(
  $$select status::text, order_id is not null, paid_at is not null, provider_transaction_id
      from public.payments where id = pg_temp.pid('ok')$$,
  $$values ('PAID', true, true, 'trx_1')$$,
  'payment is PAID and linked to the order');
select is(
  (select status::text from public.inventory_reservations where payment_id = pg_temp.pid('ok')),
  'CONVERTED', 'temporary reservation converted');
select results_eq(
  $$select reservation_type::text, status::text, quantity from public.inventory_reservations
     where order_id = (select (v ->> 'order_id')::uuid from ctx where k = 'ok_result') and reservation_type = 'ORDER_CONFIRMED'$$,
  $$values ('ORDER_CONFIRMED', 'ACTIVE', 2)$$,
  'confirmed order reservation created');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 18, 'stock stays held by the order (20 − 2)');
select isnt((select locked_at from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000001'), null,
  'first order locks the weekly product');
select is((select count(*)::int from public.cart_items where cart_id = '50000000-0000-0000-0000-0000000000a1'), 0,
  'purchased items leave the cart');
select is((select count(*)::int from public.audit_logs
            where action = 'ORDER_CREATED' and entity_id = (select (v ->> 'order_id')::uuid from ctx where k = 'ok_result')),
  1, 'order creation is audited');

-- ---------- idempotency ----------
select is(confirm_payment_order(pg_temp.ref('ok'), 1300000, 'NGN', now(), 'trx_1') ->> 'outcome', 'ALREADY_PROCESSED',
  'duplicate webhook / retry is recognised');
select is(confirm_payment_order(pg_temp.ref('ok'), 1300000, 'NGN', now(), 'trx_1') ->> 'order_number',
  (select v ->> 'order_number' from ctx where k = 'ok_result'), 'and returns the same order');
select is((select count(*)::int from public.orders where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'no duplicate order');
select is((select count(*)::int from public.inventory_reservations where payment_id = pg_temp.pid('ok')
            or order_id = (select (v ->> 'order_id')::uuid from ctx where k = 'ok_result')), 2,
  'no duplicate reservation');
select is(fail_payment(pg_temp.ref('ok'), 'failed')::text, '', 'a late failure event cannot undo a paid order');
select is((select status::text from public.payments where id = pg_temp.pid('ok')), 'PAID', 'payment stays PAID');

-- ---------- amount / currency mismatch ----------
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'amt');
select is(confirm_payment_order(pg_temp.ref('amt'), 100, 'NGN', now(), 'trx_2') ->> 'outcome', 'AMOUNT_MISMATCH',
  'amount mismatch is refused');
select results_eq($$select status::text, order_id from public.payments where id = pg_temp.pid('amt')$$,
  $$values ('FAILED', null::uuid)$$, 'no order; payment FAILED');
select is((select status::text from public.inventory_reservations where payment_id = pg_temp.pid('amt')), 'RELEASED',
  'mismatched payment releases its hold');

select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'cur');
select is(confirm_payment_order(pg_temp.ref('cur'), pg_temp.kobo('cur'), 'USD', now(), 'trx_3') ->> 'outcome',
  'CURRENCY_MISMATCH', 'currency mismatch is refused');
select is((select count(*)::int from public.audit_logs where action in ('PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_CURRENCY_MISMATCH')
            and entity_id in (pg_temp.pid('amt'), pg_temp.pid('cur'))), 2, 'mismatches are logged for investigation');

-- ---------- failed / abandoned ----------
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 3, 'fail');
select lives_ok($$select fail_payment(pg_temp.ref('fail'), 'abandoned')$$, 'abandoned payment is marked failed');
select results_eq($$select status::text, order_id from public.payments where id = pg_temp.pid('fail')$$,
  $$values ('FAILED', null::uuid)$$, 'no completed order for a failed payment');
select is((select status::text from public.inventory_reservations where payment_id = pg_temp.pid('fail')), 'RELEASED',
  'failed payment releases its temporary reservation');

-- ---------- late payment (owner decision: refuse and refund) ----------
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'late');
insert into ctx select 'late_result',
  confirm_payment_order(pg_temp.ref('late'), pg_temp.kobo('late'), 'NGN', now() + interval '20 minutes', 'trx_4');
select is((select v ->> 'outcome' from ctx where k = 'late_result'), 'REFUND_REQUIRED',
  'paid after the 15-minute hold → refused');
select results_eq($$select status::text, order_id from public.payments where id = pg_temp.pid('late')$$,
  $$values ('PAID', null::uuid)$$, 'money was taken but no order exists');
select results_eq(
  $$select status::text, reason, amount, order_id from public.refunds where payment_id = pg_temp.pid('late')$$,
  $$values ('NOT_REFUNDED', 'LATE_PAYMENT', 6500.00::numeric, null::uuid)$$,
  'a refund is recorded as requested, not completed');
select is((select status::text from public.inventory_reservations where payment_id = pg_temp.pid('late')), 'RELEASED',
  'late payment holds no stock');
select is(confirm_payment_order(pg_temp.ref('late'), pg_temp.kobo('late'), 'NGN', now() + interval '20 minutes', 'trx_4') ->> 'outcome',
  'REFUND_ALREADY_REQUESTED', 'late payment processed twice → one refund');
select lives_ok($$select record_refund_request((select (v ->> 'refund_id')::uuid from ctx where k = 'late_result'), 'rf_1', 'pending')$$,
  'Paystack refund request recorded');
select results_eq($$select paystack_refund_id, provider_status, status::text from public.refunds where payment_id = pg_temp.pid('late')$$,
  $$values ('rf_1', 'pending', 'NOT_REFUNDED')$$, 'refund still not marked complete');

-- Superseded attempt: an older reference paid after a newer attempt started.
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'old');
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'new');
select is(confirm_payment_order(pg_temp.ref('old'), pg_temp.kobo('old'), 'NGN', now(), 'trx_5') ->> 'outcome',
  'REFUND_REQUIRED', 'superseded attempt paid later → refused and refunded');
select is(confirm_payment_order(pg_temp.ref('new'), pg_temp.kobo('new'), 'NGN', now(), 'trx_6') ->> 'outcome',
  'CREATED', 'the newer attempt becomes the order');

-- ---------- paid in time, processed after the hold timed out ----------
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000001', 1, 'slow');
update public.inventory_reservations set expires_at = now() - interval '1 minute' where payment_id = pg_temp.pid('slow');
select is(confirm_payment_order(pg_temp.ref('slow'), pg_temp.kobo('slow'), 'NGN', now() - interval '2 minutes', 'trx_7') ->> 'outcome',
  'CREATED', 'paid in time + stock still free → order created (stock re-secured)');

-- Last unit taken by someone else while the slow payment was processing.
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1',
                          '30000000-0000-0000-0000-000000000002', 1, 'a_cake');
update public.inventory_reservations set expires_at = now() - interval '1 minute' where payment_id = pg_temp.pid('a_cake');
select pg_temp.reserve_as('00000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-0000000000b1',
                          '30000000-0000-0000-0000-000000000002', 1, 'b_cake');
select is(confirm_payment_order(pg_temp.ref('a_cake'), pg_temp.kobo('a_cake'), 'NGN', now() - interval '2 minutes', 'trx_8') ->> 'outcome',
  'REFUND_REQUIRED', 'paid in time but the last unit is gone → refunded, never oversold');
select is(confirm_payment_order(pg_temp.ref('b_cake'), pg_temp.kobo('b_cake'), 'NGN', now(), 'trx_9') ->> 'outcome',
  'CREATED', 'the customer holding the stock gets the order');
select is(available_quantity('30000000-0000-0000-0000-000000000002'), 0, 'the last cake is sold exactly once');

-- ---------- rate limiting ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select is(public.consume_rate_limit('payment_init', 2, 900), true, 'first attempt allowed');
select is(public.consume_rate_limit('payment_init', 2, 900), true, 'second attempt allowed');
select is(public.consume_rate_limit('payment_init', 2, 900), false, 'third attempt in the window is refused');
set local role anon;
select throws_ok($$select public.consume_rate_limit('payment_init', 2, 900)$$, '42501', null,
  'anon cannot use the limiter');

select * from finish();
rollback;
