-- Milestone 13 — account deletion (delete + anonymize; owner decisions).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'leaving@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'busy@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'paying@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set full_name = 'Leaving Customer', phone = '0803 555 0000'
 where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.addresses (user_id, label, recipient_name, phone, address_line, city, state, is_default) values
  ('00000000-0000-0000-0000-0000000000a1', 'Home', 'Leaving Customer', '0803', '9 Private Road', 'Abuja', 'FCT', true);
insert into public.carts (user_id) values ('00000000-0000-0000-0000-0000000000a1');

insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email, delivery_address,
  delivery_city, delivery_state, delivery_additional_info, special_notes, subtotal, paid_at, order_status, delivered_at, cancelled_at) values
  ('60000000-0000-0000-0000-0000000000a1', 'SAM-920001', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'Leaving Customer', '0803 555 0000', 'leaving@example.com', '9 Private Road', 'Abuja', 'FCT', 'Blue gate',
   'Call me on my private number', 7000, now(), 'DELIVERED', now(), null),
  ('60000000-0000-0000-0000-0000000000a2', 'SAM-920002', '00000000-0000-0000-0000-0000000000a1', '2026-10-09',
   'Leaving Customer', '0803 555 0000', 'leaving@example.com', '9 Private Road', 'Abuja', 'FCT', null, null,
   3000, now(), 'CANCELLED', null, now()),
  ('60000000-0000-0000-0000-0000000000b1', 'SAM-920003', '00000000-0000-0000-0000-0000000000b1', '2026-10-09',
   'Busy', '0803', 'busy@example.com', '1 Road', 'Abuja', 'FCT', null, null, 3000, now(), 'BAKING', null, null);
insert into public.order_items (order_id, product_name, unit_price, quantity, line_total) values
  ('60000000-0000-0000-0000-0000000000a1', 'Sourdough', 3500, 2, 7000);
insert into public.payments (user_id, order_id, reference, amount, status, paid_at, checkout_snapshot) values
  ('00000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a1', 'acct-ref-1', 7000, 'PAID', now(),
   '{"customer": {"name": "Leaving Customer", "email": "leaving@example.com"}, "address": {"address_line": "9 Private Road"}, "special_notes": "private", "lines": [{"name": "Sourdough"}], "subtotal": 7000}'),
  ('00000000-0000-0000-0000-0000000000c1', null, 'acct-ref-2', 1000, 'PENDING', null, '{}');
insert into public.audit_logs (actor_user_id, action, entity_type, entity_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'ORDER_CANCELLED', 'order', '60000000-0000-0000-0000-0000000000a2');

-- ---------- refusals ----------
set local role anon;
select throws_ok('select public.delete_my_account()', '42501', null, 'anon cannot delete accounts');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select throws_ok('select public.delete_my_account()', 'P0001', 'ORDERS_IN_PROGRESS',
  'blocked while an order is still in progress');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select throws_ok('select public.delete_my_account()', 'P0001', 'PAYMENT_IN_PROGRESS',
  'blocked while a payment is pending');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok('select public.delete_my_account()', 'P0001', 'ADMIN_ACCOUNT', 'admin accounts are not self-deleted');

set local role postgres;
select is((select count(*)::int from public.profiles
            where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1')), 2,
  'refused deletions change nothing');

-- ---------- successful deletion ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(public.delete_my_account() ->> 'orders_anonymized', '2', 'deletes the account and anonymizes 2 orders');

set local role postgres;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a1'), 0, 'login removed');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0, 'profile removed');
select is((select count(*)::int from public.addresses where user_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'saved addresses removed');
select is((select count(*)::int from public.carts where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'cart removed');

select is((select count(*)::int from public.orders where id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a2')),
  2, 'historical orders are kept');
select results_eq(
  $$select user_id, recipient_name, phone, email, delivery_address, delivery_additional_info, special_notes
      from public.orders where id = '60000000-0000-0000-0000-0000000000a1'$$,
  $$values (null::uuid, 'Deleted customer', 'removed', 'deleted-customer@invalid', 'Removed', null::text, null::text)$$,
  'personal details on orders are anonymized');
select results_eq(
  $$select order_number, subtotal, order_status::text, payment_status::text from public.orders
     where id = '60000000-0000-0000-0000-0000000000a1'$$,
  $$values ('SAM-920001', 7000.00::numeric, 'DELIVERED', 'PAID')$$,
  'business data on orders is unchanged');
select results_eq(
  $$select product_name, quantity, line_total from public.order_items where order_id = '60000000-0000-0000-0000-0000000000a1'$$,
  $$values ('Sourdough', 2, 7000.00::numeric)$$,
  'purchased items are unchanged');
select results_eq(
  $$select user_id, checkout_snapshot ? 'customer', checkout_snapshot ? 'address', checkout_snapshot ? 'special_notes',
           checkout_snapshot ? 'lines', amount
      from public.payments where reference = 'acct-ref-1'$$,
  $$values (null::uuid, false, false, false, true, 7000.00::numeric)$$,
  'payment snapshot keeps lines/amount but not personal details');
select is((select count(*)::int from public.orders where email = 'leaving@example.com'), 0,
  'the email no longer appears on any order');

select results_eq(
  $$select actor_user_id, action from public.audit_logs where entity_id = '60000000-0000-0000-0000-0000000000a2'$$,
  $$values (null::uuid, 'ORDER_CANCELLED')$$,
  'audit history is kept with the actor cleared');
select is((select count(*)::int from public.audit_logs where action = 'ACCOUNT_DELETED'
            and entity_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'deletion is audited');
select throws_ok($$update public.audit_logs set action = 'TAMPERED' where entity_id = '60000000-0000-0000-0000-0000000000a2'$$,
  '23001', null, 'audit entries are otherwise still immutable');
select throws_ok($$delete from public.audit_logs where entity_id = '60000000-0000-0000-0000-0000000000a2'$$,
  '23001', null, 'audit entries still cannot be deleted');

-- Untouched: other customers.
select is((select recipient_name from public.orders where id = '60000000-0000-0000-0000-0000000000b1'), 'Busy',
  'other customers are unaffected');

-- The same email can sign up again as a brand-new account.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a9', 'leaving@example.com');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a9'), 'CUSTOMER',
  'the email can be used to register again');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a9", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 0, 'the new account cannot see the old (anonymized) orders');
select is((select count(*)::int from public.payments), 0, 'or the old payments');
set local role anon;
select throws_ok('select * from public.orders', '42501', null, 'anonymized orders are not public');

select * from finish();
rollback;
