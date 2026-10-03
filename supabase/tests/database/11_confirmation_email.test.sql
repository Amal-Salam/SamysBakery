-- Milestone 12 — confirmation email claim (exactly-once sending).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@example.com');
insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at) values
  ('60000000-0000-0000-0000-000000000001', 'SAM-910001', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'A', '0803', 'a@example.com', '1 Road', 'Abuja', 'FCT', 5000, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.claim_confirmation_email('60000000-0000-0000-0000-000000000001')$$, '42501', null,
  'customers cannot claim emails');
select throws_ok($$select public.complete_confirmation_email('60000000-0000-0000-0000-000000000001', true)$$, '42501', null,
  'customers cannot mark emails sent');
set local role postgres;

select is(claim_confirmation_email('60000000-0000-0000-0000-000000000001'), true, 'first processor claims the send');
select is(claim_confirmation_email('60000000-0000-0000-0000-000000000001'), null, 'a concurrent duplicate cannot claim it');

select lives_ok($$select complete_confirmation_email('60000000-0000-0000-0000-000000000001', false)$$, 'send failed');
select is((select confirmation_email_sent_at from public.orders where id = '60000000-0000-0000-0000-000000000001'), null,
  'failure does not mark it sent');
select is(claim_confirmation_email('60000000-0000-0000-0000-000000000001'), true, 'a later retry can claim again');

select lives_ok($$select complete_confirmation_email('60000000-0000-0000-0000-000000000001', true)$$, 'send succeeded');
select isnt((select confirmation_email_sent_at from public.orders where id = '60000000-0000-0000-0000-000000000001'), null,
  'marked sent');
select is(claim_confirmation_email('60000000-0000-0000-0000-000000000001'), null, 'never sent twice');

-- Stale claim (sender crashed mid-send) can be retaken after 5 minutes.
insert into public.orders (id, order_number, user_id, delivery_date, recipient_name, phone, email,
  delivery_address, delivery_city, delivery_state, subtotal, paid_at, confirmation_email_claimed_at) values
  ('60000000-0000-0000-0000-000000000002', 'SAM-910002', '00000000-0000-0000-0000-0000000000a1', '2026-10-08',
   'A', '0803', 'a@example.com', '1 Road', 'Abuja', 'FCT', 5000, now(), now() - interval '6 minutes');
select is(claim_confirmation_email('60000000-0000-0000-0000-000000000002'), true, 'stale claim is retaken');

select * from finish();
rollback;
