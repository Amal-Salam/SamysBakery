-- Milestone 15 — approved revenue metrics (admin only).
-- Fixtures are paid in March 2001 so real data never falls in the test ranges.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

-- O1 ready, O2 cancelled + refunded, O3 cancelled + refund pending,
-- O4 paid 23:30 UTC = 00:30 the next day in Lagos.
insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at, order_status, cancelled_at) values
  ('61000000-0000-0000-0000-000000000001', 'SAM-940001', '00000000-0000-0000-0000-0000000000a1', '2001-03-08', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 10000, '2001-03-06 10:00+01', 'READY', null),
  ('61000000-0000-0000-0000-000000000002', 'SAM-940002', '00000000-0000-0000-0000-0000000000a1', '2001-03-08', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 4000, '2001-03-06 11:00+01', 'CANCELLED', now()),
  ('61000000-0000-0000-0000-000000000003', 'SAM-940003', '00000000-0000-0000-0000-0000000000a1', '2001-03-08', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 3000, '2001-03-06 12:00+01', 'CANCELLED', now()),
  ('61000000-0000-0000-0000-000000000004', 'SAM-940004', '00000000-0000-0000-0000-0000000000a1', '2001-03-08', 'A', '0803', 'a@example.com', 'R', 'Abuja', 'FCT', 6000, '2001-03-06 23:30+00', 'BAKING', null);
insert into public.order_items (order_id, product_name, unit_price, quantity, line_total) values
  ('61000000-0000-0000-0000-000000000001', 'Loaf', 5000, 2, 10000),
  ('61000000-0000-0000-0000-000000000002', 'Bun', 4000, 1, 4000),
  ('61000000-0000-0000-0000-000000000003', 'Bun', 3000, 1, 3000),
  ('61000000-0000-0000-0000-000000000004', 'Bun', 3000, 2, 6000);
insert into public.payments (id, order_id, user_id, reference, amount, status, paid_at, checkout_snapshot) values
  ('71000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'rev-ref-2', 4000, 'REFUNDED', '2001-03-06 11:00+01', '{}'),
  ('71000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'rev-ref-3', 3000, 'PAID', '2001-03-06 12:00+01', '{}'),
  ('71000000-0000-0000-0000-000000000009', null, '00000000-0000-0000-0000-0000000000a1', 'rev-ref-late', 9000, 'REFUNDED', '2001-03-06 13:00+01', '{}');
insert into public.refunds (order_id, payment_id, amount, status, provider_status, requested_at, processed_at, reason) values
  ('61000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 4000, 'REFUNDED', 'processed', now(), now(), 'CANCELLATION'),
  ('61000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 3000, 'NOT_REFUNDED', 'pending', now(), null, 'CANCELLATION'),
  (null, '71000000-0000-0000-0000-000000000009', 9000, 'REFUNDED', 'processed', now(), now(), 'LATE_PAYMENT');

-- ---------- authorization ----------
set local role anon;
select throws_ok($$select public.get_revenue_metrics()$$, '42501', null, 'anon cannot read revenue');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.get_revenue_metrics()$$, '42501', 'FORBIDDEN', 'customers cannot read revenue');

-- ---------- metrics ----------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
create temp table m (k text primary key, v jsonb) on commit drop;
grant all on m to authenticated;
insert into m values
  ('two_days', public.get_revenue_metrics('2001-03-06', '2001-03-07')),
  ('one_day', public.get_revenue_metrics('2001-03-06', '2001-03-06')),
  ('empty', public.get_revenue_metrics('2001-01-01', '2001-01-01')),
  ('all', public.get_revenue_metrics());

select is((select (v ->> 'paid_count')::int from m where k = 'two_days'), 4, 'paid count includes later-cancelled orders');
select is((select (v ->> 'paid_total')::numeric from m where k = 'two_days'), 23000::numeric, 'paid total');
select is((select (v ->> 'cancelled_count')::int from m where k = 'two_days'), 2, 'cancelled count');
select is((select (v ->> 'cancelled_total')::numeric from m where k = 'two_days'), 7000::numeric, 'cancelled value');
select is((select (v ->> 'refunded_total')::numeric from m where k = 'two_days'), 4000::numeric,
  'refunded counts only Paystack-confirmed refunds, not pending ones or late-payment refunds');
select is((select (v ->> 'net_total')::numeric from m where k = 'two_days'), 19000::numeric, 'net = paid − refunded');
select is((select (v ->> 'products_sold')::int from m where k = 'two_days'), 4, 'products sold excludes cancelled orders');
select is((select v -> 'products' from m where k = 'two_days'),
  '[{"name": "Bun", "quantity": 2}, {"name": "Loaf", "quantity": 2}]'::jsonb, 'units per product');
select is((select (v ->> 'paid_total')::numeric from m where k = 'one_day'), 17000::numeric,
  'periods use the Lagos payment date (23:30 UTC belongs to the next day)');
select is((select v from m where k = 'empty'),
  '{"paid_count": 0, "paid_total": 0, "cancelled_count": 0, "cancelled_total": 0, "refunded_count": 0,
    "refunded_total": 0, "net_total": 0, "products_sold": 0, "products": []}'::jsonb, 'an empty period returns zeros');
select ok((select (v ->> 'paid_total')::numeric >= 23000 from m where k = 'all'), 'all time has no bounds');

set local role postgres;
select is((select count(*)::int from public.audit_logs where action like '%REVENUE%'), 0, 'reading metrics writes nothing');

select * from finish();
rollback;
