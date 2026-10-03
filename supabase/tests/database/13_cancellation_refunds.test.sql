-- Milestone 14 — cancellation (releases stock) and refunds (separate, explicit).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.products (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'Loaf', 'cancel-loaf');
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now());
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Loaf', 5000, 5);

-- Four paid orders for customer A (statuses below), one for B; each holds 1 loaf.
insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at, order_status) values
  ('60000000-0000-0000-0000-000000000001', 'SAM-930001', '00000000-0000-0000-0000-0000000000a1', '2030-01-03', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 5000, now(), 'PAID'),
  ('60000000-0000-0000-0000-000000000002', 'SAM-930002', '00000000-0000-0000-0000-0000000000a1', '2030-01-03', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 5000, now(), 'BAKING'),
  ('60000000-0000-0000-0000-000000000003', 'SAM-930003', '00000000-0000-0000-0000-0000000000a1', '2030-01-03', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 5000, now(), 'READY'),
  ('60000000-0000-0000-0000-000000000004', 'SAM-930004', '00000000-0000-0000-0000-0000000000b1', '2030-01-03', 'B', '0803', 'b@example.com', 'R', 'Abuja', 'FCT', 5000, now(), 'RECEIVED');
insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type)
select '30000000-0000-0000-0000-000000000001', id, 1, 'ORDER_CONFIRMED' from public.orders where order_number like 'SAM-93000%';
insert into public.payments (id, order_id, user_id, reference, amount, status, paid_at, checkout_snapshot) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'cx-ref-1', 5000, 'PAID', now(), '{}'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', 'cx-ref-4', 5000, 'PAID', now(), '{}');

select is(available_quantity('30000000-0000-0000-0000-000000000001'), 1, 'starting availability: 5 − 4 held');

-- ---------- customer cancellation ----------
set local role anon;
select throws_ok($$select public.cancel_order('SAM-930001')$$, '42501', null, 'anon cannot cancel');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.cancel_order('SAM-930004')$$, 'P0002', 'NOT_FOUND',
  'customer cannot cancel another customer''s order');
select throws_ok($$select public.cancel_order('SAM-930003')$$, 'P0001', 'ORDER_NOT_CANCELLABLE',
  'READY orders cannot be cancelled');
select lives_ok($$select public.cancel_order('SAM-930001', 'Changed my plans')$$, 'customer cancels own PAID order');
select throws_ok($$select public.cancel_order('SAM-930001')$$, 'P0001', 'ORDER_NOT_CANCELLABLE',
  'cancelling twice is refused');
select throws_ok($$select public.request_refund('SAM-930001')$$, '42501', null, 'customers cannot request refunds');

set local role postgres;
select results_eq(
  $$select order_status::text, cancelled_at is not null, payment_status::text from public.orders where order_number = 'SAM-930001'$$,
  $$values ('CANCELLED', true, 'PAID')$$, 'order CANCELLED; payment untouched (no automatic refund)');
select is((select count(*)::int from public.refunds where order_id = '60000000-0000-0000-0000-000000000001'), 0,
  'cancellation does not create a refund');
select is((select status::text from public.inventory_reservations where order_id = '60000000-0000-0000-0000-000000000001'),
  'RELEASED', 'confirmed reservation released');
select is(available_quantity('30000000-0000-0000-0000-000000000001'), 2, 'cancellation release restores availability');
select is((select weekly_quantity from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000001'),
  5, 'original weekly quantity is not changed');
select results_eq(
  $$select actor_user_id, metadata ->> 'cancelled_by', metadata ->> 'reason', metadata ->> 'from'
      from public.audit_logs where action = 'ORDER_CANCELLED' and entity_id = '60000000-0000-0000-0000-000000000001'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'CUSTOMER', 'Changed my plans', 'PAID')$$,
  'customer cancellation audited');

-- ---------- admin cancellation ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select lives_ok($$select public.cancel_order('SAM-930004')$$, 'admin cancels another customer''s RECEIVED order');
select lives_ok($$select public.cancel_order('SAM-930002')$$, 'admin cancels a BAKING order');
select throws_ok($$select public.cancel_order('SAM-930003')$$, 'P0001', 'ORDER_NOT_CANCELLABLE',
  'not even admins cancel after READY');
select throws_ok($$select public.update_order_status('SAM-930004', 'RECEIVED')$$, 'P0001', 'ORDER_CANCELLED',
  'CANCELLED is final');

-- ---------- refunds ----------
select throws_ok($$select public.request_refund('SAM-930003')$$, 'P0001', 'ORDER_NOT_CANCELLED',
  'only cancelled orders can be refunded');
select throws_ok($$select public.request_refund('SAM-930002')$$, 'P0001', 'NOT_REFUNDABLE',
  'an order without a paid payment is not refundable');

create temp table r (k text primary key, v jsonb) on commit drop;
grant all on r to authenticated;
insert into r select 'one', public.request_refund('SAM-930001');
select is((select (v ->> 'amount')::numeric from r where k = 'one'), 5000::numeric, 'full refund of the paid amount');
select is((select v ->> 'payment_reference' from r where k = 'one'), 'cx-ref-1', 'targets the order''s payment');
select throws_ok($$select public.request_refund('SAM-930001')$$, 'P0001', 'REFUND_IN_PROGRESS',
  'a second request while one is in progress is refused');

set local role postgres;
select results_eq(
  $$select status::text, reason, created_by from public.refunds where order_id = '60000000-0000-0000-0000-000000000001'$$,
  $$values ('NOT_REFUNDED', 'CANCELLATION', '00000000-0000-0000-0000-0000000000ad'::uuid)$$,
  'refund recorded as requested, not completed');

-- Paystack accepts the request (pending): still not REFUNDED.
select lives_ok($$select record_refund_request((select (v ->> 'refund_id')::uuid from r where k = 'one'), 'rf_100', 'pending')$$,
  'provider request recorded');
select is(apply_refund_status((select (v ->> 'refund_id')::uuid from r where k = 'one'), 'processing'), 'NOT_REFUNDED',
  'processing is not REFUNDED');
select is((select payment_status::text from public.orders where order_number = 'SAM-930001'), 'PAID',
  'order payment still PAID while processing');

-- Paystack reports failure: retry is allowed.
select is(apply_refund_status((select (v ->> 'refund_id')::uuid from r where k = 'one'), 'failed'), 'NOT_REFUNDED',
  'failed refund stays NOT_REFUNDED');
set local role authenticated;
select lives_ok($$select public.request_refund('SAM-930001')$$, 'admin can retry a failed refund');
set local role postgres;
select is((select count(*)::int from public.refunds where order_id = '60000000-0000-0000-0000-000000000001'), 1,
  'retry reuses the single refund record');

-- Paystack processes it: REFUNDED everywhere.
select is(apply_refund_status((select (v ->> 'refund_id')::uuid from r where k = 'one'), 'processed'), 'REFUNDED',
  'processed → REFUNDED');
select results_eq(
  $$select r.status::text, r.processed_at is not null, p.status::text, o.payment_status::text
      from public.refunds r join public.payments p on p.id = r.payment_id join public.orders o on o.id = r.order_id
     where r.order_id = '60000000-0000-0000-0000-000000000001'$$,
  $$values ('REFUNDED', true, 'REFUNDED', 'REFUNDED')$$,
  'refund, payment and order all show REFUNDED');
select is(apply_refund_status((select (v ->> 'refund_id')::uuid from r where k = 'one'), 'failed'), 'REFUNDED',
  'a late/duplicate event cannot undo a completed refund');
set local role authenticated;
select throws_ok($$select public.request_refund('SAM-930001')$$, 'P0001', 'ALREADY_REFUNDED', 'cannot refund twice');

set local role postgres;
select is((select count(*)::int from public.audit_logs where action in ('REFUND_INITIATED', 'REFUND_REQUESTED', 'REFUND_FAILED', 'REFUND_CONFIRMED')
            and (entity_id = '60000000-0000-0000-0000-000000000001' or entity_id = (select (v ->> 'refund_id')::uuid from r where k = 'one'))),
  5, 'every refund step is audited');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.apply_refund_status(gen_random_uuid(), 'processed')$$, '42501', null,
  'customers cannot mark refunds complete');

select * from finish();
rollback;
