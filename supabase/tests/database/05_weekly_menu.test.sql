-- Milestone 5 — weekly menu lifecycle, locking, read guard, expiry.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(43);

-- Move any real menus out of the way (rolled back with the test, so real data is untouched).
update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

-- ---------- week calculation (Africa/Lagos dates) ----------
select is(menu_week_start_for('2026-10-04'), '2026-10-06'::date, 'Sunday → upcoming Tuesday');
select is(menu_week_start_for('2026-10-05'), '2026-10-06'::date, 'Monday → upcoming Tuesday');
select is(menu_week_start_for('2026-10-06'), '2026-10-06'::date, 'Tuesday → this week');
select is(menu_week_start_for('2026-10-08'), '2026-10-06'::date, 'Thursday → this week (not ended)');
select is(menu_week_start_for('2026-10-10'), '2026-10-06'::date, 'Saturday → this week (not ended)');
select is(lagos_today(), (now() at time zone 'Africa/Lagos')::date, 'business date is Lagos time');

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'customer@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.products (id, name, slug, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'Sourdough', 'sourdough', null),
  ('10000000-0000-0000-0000-000000000002', 'Brioche', 'brioche', null),
  ('10000000-0000-0000-0000-000000000003', 'Archived Cake', 'archived-cake', now());

-- ---------- customer cannot run lifecycle operations ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select throws_ok('select public.create_weekly_menu()', '42501', null, 'customer cannot create a week');
select throws_ok($$select public.publish_weekly_menu(gen_random_uuid())$$, '42501', null,
  'customer cannot publish');
select throws_ok($$select public.unpublish_weekly_menu(gen_random_uuid())$$, '42501', null,
  'customer cannot unpublish');
select throws_ok('select public.expire_ended_menus()', '42501', null,
  'customer cannot run expiry');

-- ---------- admin: create ----------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok('select public.expire_ended_menus()', '42501', null,
  'expiry is a system operation, not an admin one');

create temp table menu_ids (id uuid) on commit drop;
grant all on menu_ids to authenticated;
insert into menu_ids select public.create_weekly_menu();

select results_eq(
  'select status::text, week_start, week_end - week_start from public.weekly_menus where id = (select id from menu_ids)',
  $$values ('DRAFT', public.menu_week_start_for(public.lagos_today()), 4)$$,
  'creates an empty Tuesday–Saturday DRAFT for the upcoming week');
select is((select count(*)::int from public.weekly_menu_products where weekly_menu_id = (select id from menu_ids)),
  0, 'new week starts empty');
select throws_ok('select public.create_weekly_menu()', 'P0001', 'MENU_ALREADY_ACTIVE',
  'cannot create another week while a draft exists');

-- ---------- admin: publish ----------
select throws_ok($$select public.publish_weekly_menu((select id from menu_ids))$$, 'P0001', 'MENU_EMPTY',
  'cannot publish an empty menu');

-- Fixture rows with known ids (admins can't set ids; admin inserts are covered in 03_rls).
set local role postgres;
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
values
  ('30000000-0000-0000-0000-000000000001', (select id from menu_ids), '10000000-0000-0000-0000-000000000001', 'Sourdough', 6500, 10),
  ('30000000-0000-0000-0000-000000000002', (select id from menu_ids), '10000000-0000-0000-0000-000000000002', 'Brioche', 5000, 8);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select throws_ok(
  $$insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity)
    values ((select id from menu_ids), '10000000-0000-0000-0000-000000000003', 'Archived Cake', 9000, 2)$$,
  'P0001', 'PRODUCT_ARCHIVED', 'archived library products cannot be added');

select lives_ok($$select public.publish_weekly_menu((select id from menu_ids))$$, 'admin publishes the menu');
select ok(
  (select status = 'PUBLISHED' and published_at is not null from public.weekly_menus where id = (select id from menu_ids)),
  'menu is PUBLISHED with published_at');
select throws_ok($$select public.publish_weekly_menu((select id from menu_ids))$$, 'P0001', 'MENU_NOT_DRAFT',
  'cannot publish twice');
select throws_ok('select public.create_weekly_menu()', 'P0001', 'MENU_ALREADY_ACTIVE',
  'cannot create a new week while the current week is active');

-- ---------- customers see it ----------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.weekly_menu_products), 2, 'published products are public');

-- ---------- unpublish ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select lives_ok($$select public.unpublish_weekly_menu((select id from menu_ids))$$,
  'admin can unpublish a menu with no orders');
select ok(
  (select status = 'DRAFT' and published_at is null from public.weekly_menus where id = (select id from menu_ids)),
  'unpublished menu is back to DRAFT');
select lives_ok($$select public.publish_weekly_menu((select id from menu_ids))$$, 'and can be republished');

-- First order locks the product (set by order creation in a later milestone).
set local role postgres;
update public.weekly_menu_products set locked_at = now() where id = '30000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok($$select public.unpublish_weekly_menu((select id from menu_ids))$$, 'P0001', 'MENU_HAS_ORDERS',
  'a menu with orders cannot be unpublished');

-- ---------- product locking ----------
select throws_ok(
  $$update public.weekly_menu_products set price = 1 where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_LOCKED', 'locked: price');
select throws_ok(
  $$update public.weekly_menu_products set name_snapshot = 'Renamed' where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_LOCKED', 'locked: name');
select throws_ok(
  $$update public.weekly_menu_products set weekly_quantity = 99 where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_LOCKED', 'locked: weekly quantity');
select lives_ok(
  $$update public.weekly_menu_products
      set description_snapshot = 'New description', ingredients_snapshot = 'Flour, water, salt',
          image_snapshot = 'products/x/new.jpg', low_stock_threshold = 3
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'still editable: description, ingredients, photo, low-stock threshold');
select throws_ok(
  $$delete from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_HAS_ORDERS', 'a product with orders cannot be removed from the menu');

select lives_ok(
  $$update public.weekly_menu_products set price = 5500, weekly_quantity = 12, name_snapshot = 'Brioche Loaf'
    where id = '30000000-0000-0000-0000-000000000002'$$,
  'unlocked product: price, quantity and name are editable');
select lives_ok(
  $$delete from public.weekly_menu_products where id = '30000000-0000-0000-0000-000000000002'$$,
  'unlocked product can be removed');

set local role postgres;
select throws_ok(
  $$update public.weekly_menu_products set price = 1 where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_LOCKED', 'lock is enforced even for the server/service role');
select throws_ok(
  $$update public.weekly_menu_products set locked_at = null where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'WEEKLY_PRODUCT_LOCKED', 'a lock cannot be removed');

-- ---------- read guard + expiry ----------
-- Simulate the week having ended (Saturday passed) before the job runs.
update public.weekly_menus
   set week_start = week_start - 7, week_end = week_end - 7
 where id = (select id from menu_ids);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.weekly_menus), 0,
  'read guard: an ended menu is hidden before the expiry job runs');
select is((select count(*)::int from public.weekly_menu_products), 0,
  'read guard: its products are hidden too');

set local role postgres;
select is(public.expire_ended_menus(), 1, 'expiry job expires the ended menu');
select ok(
  (select status = 'EXPIRED' and expired_at is not null from public.weekly_menus where id = (select id from menu_ids)),
  'menu is EXPIRED with expired_at');
select is(public.expire_ended_menus(), 0, 'expiry is idempotent');

select throws_ok(
  $$update public.weekly_menu_products set description_snapshot = 'late edit'
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', 'MENU_EXPIRED', 'expired menus are frozen');

-- All rows share one transaction timestamp, so compare as a multiset.
select bag_eq(
  $$select action, actor_user_id is null from public.audit_logs
     where entity_id = (select id from menu_ids) and action not like 'MENU\_PRODUCT\_%'$$,
  $$values ('MENU_CREATED', false), ('MENU_PUBLISHED', false), ('MENU_UNPUBLISHED', false),
           ('MENU_PUBLISHED', false), ('MENU_EXPIRED', true)$$,
  'every lifecycle step is audited (expiry by the system)');

-- After expiry a new week can be created.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select lives_ok('select public.create_weekly_menu()', 'a new week can be created after expiry');

-- ---------- scheduled job ----------
set local role postgres;
select is(
  (select count(*)::int from cron.job
    where jobname = 'expire-ended-weekly-menus' and command = 'select public.expire_ended_menus()'),
  1, 'expiry job is scheduled');

select * from finish();
rollback;
