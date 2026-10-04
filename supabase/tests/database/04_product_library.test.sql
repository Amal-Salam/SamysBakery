-- Milestone 4 — Product Library: archive_product() and product-image storage.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

-- Move any real menus out of the way (rolled back with the test, so real data is untouched).
update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'customer@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.products (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Never used', 'never-used'),
  ('10000000-0000-0000-0000-000000000002', 'On published', 'on-published'),
  ('10000000-0000-0000-0000-000000000003', 'On draft', 'on-draft'),
  ('10000000-0000-0000-0000-000000000004', 'Used before', 'used-before');

-- Dates are relative to today in Lagos so the published menu is always current.
insert into public.weekly_menus (id, week_start, week_end, status, published_at, expired_at) values
  ('20000000-0000-0000-0000-000000000001', public.menu_week_start_for(public.lagos_today()),
   public.menu_week_start_for(public.lagos_today()) + 4, 'PUBLISHED', now(), null),
  ('20000000-0000-0000-0000-000000000002', public.menu_week_start_for(public.lagos_today()) + 7,
   public.menu_week_start_for(public.lagos_today()) + 11, 'DRAFT', null, null),
  ('20000000-0000-0000-0000-000000000003', public.menu_week_start_for(public.lagos_today()) - 7,
   public.menu_week_start_for(public.lagos_today()) - 3, 'EXPIRED', now(), now());

-- Historical fixture rows: load with triggers paused (expired menus are frozen).
set local session_replication_role = replica;
insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'On published', 5000, 5),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'On draft', 5000, 5),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'Used before', 5000, 5);
set local session_replication_role = origin;

-- ---------- storage bucket ----------
select is(
  (select public from storage.buckets where id = 'product-images'),
  true, 'product-images bucket is public (owner decision)');
select is(
  (select file_size_limit from storage.buckets where id = 'product-images'),
  5242880::bigint, 'bucket limits files to 5 MB');
select is(
  (select allowed_mime_types from storage.buckets where id = 'product-images'),
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  'bucket only accepts raster photo types (no SVG)');

-- ---------- customer ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'customer cannot archive products');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/evil.jpg')$$,
  '42501', null, 'customer cannot upload product images');

-- ---------- anon ----------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon cannot archive products');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/evil.jpg')$$,
  '42501', null, 'anon cannot upload product images');

-- ---------- admin ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/photo.jpg')$$,
  'admin can upload product images');
-- Storage forbids raw SQL deletes; deletion through the Storage API (covered by
-- E2E) requires the admin to see the object row.
select is(
  (select count(*)::int from storage.objects where bucket_id = 'product-images' and name = 'products/x/photo.jpg'),
  1, 'admin can see product image objects (required to delete via the Storage API)');

select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'PRODUCT_ON_ACTIVE_MENU', 'cannot archive a product on the published menu');
select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-000000000003')$$,
  'P0001', 'PRODUCT_ON_ACTIVE_MENU', 'cannot archive a product on the draft menu');

select is(
  public.archive_product('10000000-0000-0000-0000-000000000001'),
  '{"had_history": false}'::jsonb, 'archives a never-used product');
select is(
  public.archive_product('10000000-0000-0000-0000-000000000004'),
  '{"had_history": true}'::jsonb, 'archives a product with history and reports it');
select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-000000000004')$$,
  'P0002', 'NOT_FOUND', 'cannot archive twice');
select throws_ok(
  $$select public.archive_product('10000000-0000-0000-0000-0000000000ff')$$,
  'P0002', 'NOT_FOUND', 'unknown product is NOT_FOUND');

-- ---------- effects (as postgres) ----------
set local role postgres;
select isnt(
  (select deleted_at from public.products where id = '10000000-0000-0000-0000-000000000004'),
  null, 'archived product has deleted_at');
select is(
  (select count(*)::int from public.products where id = '10000000-0000-0000-0000-000000000004'),
  1, 'archived product row is kept (never hard-deleted)');
select is(
  (select name_snapshot from public.weekly_menu_products
   where product_id = '10000000-0000-0000-0000-000000000004'),
  'Used before', 'past weekly-menu snapshot is untouched');
select results_eq(
  $$select action, entity_id, actor_user_id, (metadata ->> 'had_history')::boolean
      from public.audit_logs where action = 'PRODUCT_DELETED' and entity_id::text like '10000000-%'
     order by (metadata ->> 'had_history')$$,
  $$values
      ('PRODUCT_DELETED', '10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-0000000000ad'::uuid, false),
      ('PRODUCT_DELETED', '10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-0000000000ad'::uuid, true)$$,
  'each archive writes an audit record with the admin as actor');
select is(
  (select count(*)::int from public.audit_logs where entity_id in (
    '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003')
    and action = 'PRODUCT_DELETED'),
  0, 'blocked attempts leave no audit record or change');

select * from finish();
rollback;
