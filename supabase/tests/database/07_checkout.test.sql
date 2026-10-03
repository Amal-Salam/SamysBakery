-- Milestone 8 — cutoff setting, delivery-date eligibility, address defaults.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

-- Move any real menus out of the way (rolled back with the test, so real data is untouched).
update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

-- ---------- cutoff setting ----------
select is(order_cutoff_time(), '17:00'::time, 'initial cutoff is 17:00 (owner decision)');

-- ---------- no menu ----------
select is((select count(*)::int from eligible_delivery_dates()), 0, 'no published menu → no delivery dates');
select is(delivery_date_status(lagos_today()), 'MENU_UNAVAILABLE', 'no published menu → MENU_UNAVAILABLE');

-- ---------- published menu for the current week ----------
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()),
   menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now());

-- Cutoff already passed for today (00:00).
update public.system_settings set value = '"00:00"' where key = 'ORDER_CUTOFF_TIME';
-- (On the last delivery day after the cutoff, no dates remain: an empty set passes.)
select ok((select coalesce(bool_and(extract(isodow from d) between 2 and 6), true) from eligible_delivery_dates() d),
  'only Tuesday–Saturday dates are offered');
select ok((select coalesce(bool_and(d between menu_week_start_for(lagos_today()) and menu_week_start_for(lagos_today()) + 4), true)
           from eligible_delivery_dates() d),
  'only dates within the current menu week are offered');
select ok((select coalesce(bool_and(d >= lagos_today()), true) from eligible_delivery_dates() d), 'no past dates are offered');
select ok(lagos_today() not in (select eligible_delivery_dates()), 'after the cutoff, today is not offered');
select is(
  delivery_date_status(lagos_today()),
  case when extract(isodow from lagos_today()) between 2 and 6 then 'ORDER_CUTOFF_PASSED' else 'DELIVERY_DATE_INVALID' end,
  'after the cutoff, today → ORDER_CUTOFF_PASSED (or invalid on Sun/Mon)');
select is(
  (select min(d) from eligible_delivery_dates() d),
  (select min(d)::date from generate_series(greatest(menu_week_start_for(lagos_today()), lagos_today() + 1),
     menu_week_start_for(lagos_today()) + 4, interval '1 day') d),
  'after the cutoff, the next eligible day is the earliest option');

-- Cutoff later today (23:59): today is offered if it's a delivery day in the menu week.
update public.system_settings set value = '"23:59"' where key = 'ORDER_CUTOFF_TIME';
select is(
  lagos_today() in (select eligible_delivery_dates()),
  extract(isodow from lagos_today()) between 2 and 6 and (now() at time zone 'Africa/Lagos')::time < '23:59',
  'before the cutoff, same-day delivery is offered on delivery days');

-- Validation outcomes (API contract §11).
select is(delivery_date_status(menu_week_start_for(lagos_today()) - 2), 'DELIVERY_DATE_INVALID', 'Sunday → INVALID');
select is(delivery_date_status(menu_week_start_for(lagos_today()) - 1), 'DELIVERY_DATE_INVALID', 'Monday → INVALID');
select is(delivery_date_status(menu_week_start_for(lagos_today()) + 7), 'DELIVERY_DATE_INVALID',
  'next week''s Tuesday → INVALID');
select is(delivery_date_status(menu_week_start_for(lagos_today()) + 4 + 1), 'DELIVERY_DATE_INVALID',
  'day after the menu week → INVALID');
select is(delivery_date_status(menu_week_start_for(lagos_today()) + 4),
  case when menu_week_start_for(lagos_today()) + 4 > lagos_today()
         or (now() at time zone 'Africa/Lagos')::time < '23:59' then 'VALID' else 'ORDER_CUTOFF_PASSED' end,
  'this week''s Saturday (before its cutoff) → VALID');

-- ---------- cutoff changes: admin only, audited ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.set_order_cutoff('12:00')$$, '42501', null, 'customers cannot change the cutoff');
select is(order_cutoff_time(), '23:59'::time, 'customers can read the cutoff');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok($$select public.set_order_cutoff('25:00')$$, 'P0001', 'INVALID_CUTOFF', 'invalid time rejected');
select throws_ok($$select public.set_order_cutoff('5pm')$$, 'P0001', 'INVALID_CUTOFF', 'non HH:MM rejected');
select lives_ok($$select public.set_order_cutoff('16:30')$$, 'admin changes the cutoff');
select is(order_cutoff_time(), '16:30'::time, 'cutoff updated');
select results_eq(
  $$select action, metadata ->> 'from', metadata ->> 'to' from public.audit_logs
     where action = 'ORDER_CUTOFF_CHANGED' and actor_user_id = '00000000-0000-0000-0000-0000000000ad'$$,
  $$values ('ORDER_CUTOFF_CHANGED', '23:59', '16:30')$$,
  'cutoff change is audited with old and new values');

-- ---------- addresses ----------
set local role postgres;
insert into public.addresses (id, user_id, label, recipient_name, phone, address_line, city, state, is_default, created_at) values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Home', 'A', '0800', '1 Rd', 'Abuja', 'FCT', true, now() - interval '3 days'),
  ('40000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Office', 'A', '0800', '2 Rd', 'Abuja', 'FCT', false, now() - interval '2 days'),
  ('40000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', 'Mum', 'A', '0800', '3 Rd', 'Abuja', 'FCT', false, now() - interval '1 day'),
  ('40000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Home', 'B', '0800', '9 Rd', 'Abuja', 'FCT', true, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$select public.set_default_address('40000000-0000-0000-0000-0000000000a2')$$, 'owner sets a new default');
select results_eq(
  $$select id from public.addresses where is_default$$,
  $$values ('40000000-0000-0000-0000-0000000000a2'::uuid)$$,
  'exactly one default address afterwards');
select throws_ok($$select public.set_default_address('40000000-0000-0000-0000-0000000000b1')$$,
  'P0002', 'NOT_FOUND', 'cannot set another customer''s address as default');
select lives_ok($$select public.delete_address('40000000-0000-0000-0000-0000000000a2')$$, 'owner deletes the default');
select results_eq(
  $$select id from public.addresses where is_default$$,
  $$values ('40000000-0000-0000-0000-0000000000a3'::uuid)$$,
  'deleting the default promotes the most recently added remaining address');
select throws_ok($$select public.delete_address('40000000-0000-0000-0000-0000000000b1')$$,
  'P0002', 'NOT_FOUND', 'cannot delete another customer''s address');

select * from finish();
rollback;
