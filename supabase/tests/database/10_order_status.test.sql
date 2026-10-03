-- Milestone 11 — order status transitions (owner-decided correction matrix).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at) values
  ('60000000-0000-0000-0000-000000000001', 'SAM-900001', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'A', '0803', 'a@example.com', '1 Road', 'Abuja', 'FCT', 5000, now()),
  ('60000000-0000-0000-0000-000000000002', 'SAM-900002', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'A', '0803', 'a@example.com', '1 Road', 'Abuja', 'FCT', 5000, now());

create function pg_temp.status_of(num text) returns text language sql as
  $$ select order_status::text from public.orders where order_number = num $$;

-- ---------- authorization ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.update_order_status('SAM-900001', 'RECEIVED')$$, '42501', null,
  'customers cannot change order status');
set local role anon;
select throws_ok($$select public.update_order_status('SAM-900001', 'RECEIVED')$$, '42501', null,
  'anon cannot change order status');

-- ---------- forward ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select lives_ok($$select public.update_order_status('SAM-900001', 'RECEIVED')$$, 'PAID → RECEIVED');
select lives_ok($$select public.update_order_status('SAM-900001', 'BAKING')$$, 'RECEIVED → BAKING/PREPARING');
select lives_ok($$select public.update_order_status('SAM-900001', 'HANDED_TO_DELIVERY')$$,
  'forward skipping allowed (BAKING → HANDED_TO_DELIVERY)');
select is(pg_temp.status_of('SAM-900001'), 'HANDED_TO_DELIVERY', 'status updated');
select throws_ok($$select public.update_order_status('SAM-900001', 'HANDED_TO_DELIVERY')$$, 'P0001', 'NO_CHANGE',
  'same status is rejected');

-- ---------- backward correction: one step, reason required ----------
select throws_ok($$select public.update_order_status('SAM-900001', 'READY')$$, 'P0001', 'REASON_REQUIRED',
  'correction without a reason is rejected');
select throws_ok($$select public.update_order_status('SAM-900001', 'READY', '  ')$$, 'P0001', 'REASON_REQUIRED',
  'blank reason is rejected');
select throws_ok($$select public.update_order_status('SAM-900001', 'BAKING', 'oops wrong order')$$, 'P0001',
  'INVALID_TRANSITION', 'more than one step back is rejected');
select lives_ok($$select public.update_order_status('SAM-900001', 'READY', 'Marked handed over by mistake')$$,
  'one step back with a reason');
select is(pg_temp.status_of('SAM-900001'), 'READY', 'status corrected');

-- ---------- DELIVERED and its correction ----------
select lives_ok($$select public.update_order_status('SAM-900001', 'DELIVERED')$$, 'READY → DELIVERED');
set local role postgres;
select isnt((select delivered_at from public.orders where order_number = 'SAM-900001'), null, 'delivered_at recorded');
set local role authenticated;
select lives_ok($$select public.update_order_status('SAM-900001', 'HANDED_TO_DELIVERY', 'Courier has not delivered yet')$$,
  'DELIVERED can be corrected one step back (owner decision)');
set local role postgres;
select is((select delivered_at from public.orders where order_number = 'SAM-900001'), null, 'delivered_at cleared');
set local role authenticated;
select throws_ok($$select public.update_order_status('SAM-900001', 'PAID', 'reset everything')$$, 'P0001',
  'INVALID_TRANSITION', 'arbitrary rewinds are rejected');

-- ---------- cancellation is a separate operation; CANCELLED is final ----------
select throws_ok($$select public.update_order_status('SAM-900002', 'CANCELLED')$$, 'P0001', 'USE_CANCELLATION',
  'status update cannot cancel an order');
set local role postgres;
update public.orders set order_status = 'CANCELLED', cancelled_at = now() where order_number = 'SAM-900002';
set local role authenticated;
select throws_ok($$select public.update_order_status('SAM-900002', 'RECEIVED')$$, 'P0001', 'ORDER_CANCELLED',
  'a cancelled order cannot change status');
select throws_ok($$select public.update_order_status('SAM-999999', 'RECEIVED')$$, 'P0002', 'NOT_FOUND',
  'unknown order');

-- ---------- audit ----------
set local role postgres;
select is((select count(*)::int from public.audit_logs where action = 'ORDER_STATUS_CHANGED'
            and entity_id = '60000000-0000-0000-0000-000000000001'), 6, 'every status change is audited');
select results_eq(
  $$select metadata ->> 'from', metadata ->> 'to', metadata ->> 'direction', metadata ->> 'reason'
      from public.audit_logs where action = 'ORDER_STATUS_CHANGED' and metadata ->> 'direction' = 'CORRECTION'
       and entity_id = '60000000-0000-0000-0000-000000000001' order by metadata ->> 'from'$$,
  $$values ('DELIVERED', 'HANDED_TO_DELIVERY', 'CORRECTION', 'Courier has not delivered yet'),
           ('HANDED_TO_DELIVERY', 'READY', 'CORRECTION', 'Marked handed over by mistake')$$,
  'corrections record the reason');
select is((select actor_user_id from public.audit_logs where action = 'ORDER_STATUS_CHANGED'
            and entity_id = '60000000-0000-0000-0000-000000000001' limit 1),
  '00000000-0000-0000-0000-0000000000ad'::uuid, 'the admin is recorded as the actor');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok($$update public.orders set order_status = 'DELIVERED' where order_number = 'SAM-900001'$$,
  '42501', null, 'even admins can only change status through the audited operation');

select * from finish();
rollback;
