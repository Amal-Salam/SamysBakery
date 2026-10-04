-- Milestone 17 — audit coverage: mandatory events exist, administrative
-- changes are recorded with the right actor, and the log is append-only.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'customer@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

-- ---------- mandatory events (Database_Security_&_Transaction_Specs.md §30) ----------
select is(
  (select array_agg(required order by required) from unnest(array[
     'MENU_PUBLISHED', 'MENU_EXPIRED', 'PRODUCT_DELETED', 'INVENTORY_INCREASED', 'ORDER_STATUS_CHANGED',
     'ORDER_CANCELLED', 'REFUND_REQUESTED', 'REFUND_CONFIRMED', 'ACCOUNT_ADMIN_ACTION']) required
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosrc like '%insert into public.audit_logs%'
        and p.prosrc like '%''' || required || '''%')),
  null, 'every mandatory audit event is written by a database function');

-- ---------- account role changes ----------
update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-0000000000ad'; -- operator script
select results_eq(
  $$select actor_user_id, metadata ->> 'change', metadata ->> 'from', metadata ->> 'to', metadata ->> 'via'
      from public.audit_logs where action = 'ACCOUNT_ADMIN_ACTION' and entity_id = '00000000-0000-0000-0000-0000000000ad'$$,
  $$values (null::uuid, 'ROLE_CHANGED', 'CUSTOMER', 'ADMIN', 'OPERATOR')$$,
  'promoting an admin is audited (operator change, no app actor)');
update public.profiles set full_name = 'Renamed Admin' where id = '00000000-0000-0000-0000-0000000000ad';
select is((select count(*)::int from public.audit_logs where action = 'ACCOUNT_ADMIN_ACTION'
             and entity_id = '00000000-0000-0000-0000-0000000000ad'), 1, 'non-role profile edits are not role changes');

-- ---------- Product Library (as the admin) ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

insert into public.categories (id, name, slug, display_order) values ('40000000-0000-0000-0000-000000000001', 'Audit Cat', 'audit-cat', 99);
update public.categories set display_order = 100 where id = '40000000-0000-0000-0000-000000000001';
update public.categories set name = 'Audit Category' where id = '40000000-0000-0000-0000-000000000001';
insert into public.products (name, slug, category_id) values
  ('Audit Loaf', 'audit-loaf', '40000000-0000-0000-0000-000000000001');
update public.products set name = 'Audit Sourdough', description = 'Tangy' where id = (select id from public.products where slug = 'audit-loaf');
update public.products set name = 'Audit Sourdough' where id = (select id from public.products where slug = 'audit-loaf'); -- no-op
insert into public.product_images (product_id, storage_path, alt_text) values
  ((select id from public.products where slug = 'audit-loaf'), 'products/audit/a.jpg', 'Loaf');
update public.product_images set alt_text = 'A loaf' where storage_path = 'products/audit/a.jpg';
delete from public.product_images where storage_path = 'products/audit/a.jpg';

set local role postgres;
select results_eq(
  $$select action from public.audit_logs where entity_id = '40000000-0000-0000-0000-000000000001' order by action$$,
  $$values ('CATEGORY_CREATED'), ('CATEGORY_UPDATED')$$, 'category create and rename audited; reordering is not');
select is((select metadata ->> 'previous_name' from public.audit_logs where action = 'CATEGORY_UPDATED'
             and entity_id = '40000000-0000-0000-0000-000000000001'), 'Audit Cat', 'category rename keeps the old name');
select results_eq(
  $$select action, actor_user_id from public.audit_logs where entity_id = (select id from public.products where slug = 'audit-loaf')
     order by action$$,
  $$values ('PRODUCT_CREATED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('PRODUCT_IMAGE_ADDED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('PRODUCT_IMAGE_REMOVED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('PRODUCT_UPDATED', '00000000-0000-0000-0000-0000000000ad'::uuid)$$,
  'product create, edit and photo changes are audited with the admin as actor; no-ops and alt text are not');
select results_eq(
  $$select metadata -> 'fields', metadata ->> 'previous_name' from public.audit_logs
     where action = 'PRODUCT_UPDATED' and entity_id = (select id from public.products where slug = 'audit-loaf')$$,
  $$values ('["name", "description"]'::jsonb, 'Audit Loaf')$$, 'product edit records which fields changed');

set local role authenticated;
select lives_ok($$select public.archive_product((select id from public.products where slug = 'audit-loaf'))$$, 'admin archives the product');
set local role postgres;
select is((select count(*)::int from public.audit_logs where entity_id = (select id from public.products where slug = 'audit-loaf')
             and action in ('PRODUCT_DELETED', 'PRODUCT_UPDATED')), 2,
  'archiving logs PRODUCT_DELETED only (not an extra edit)');
set local role authenticated;
delete from public.categories where id = '40000000-0000-0000-0000-000000000001';
set local role postgres;
select is((select count(*)::int from public.audit_logs where action = 'CATEGORY_DELETED'
             and entity_id = '40000000-0000-0000-0000-000000000001'), 1, 'category deletion audited');

-- ---------- weekly-menu products ----------
insert into public.products (name, slug) values ('Audit Bun', 'audit-bun'), ('Audit Roll', 'audit-roll');
insert into public.weekly_menus (id, week_start, week_end, status) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'DRAFT');

set local role authenticated;
insert into public.weekly_menu_products (weekly_menu_id, product_id, name_snapshot, price, weekly_quantity, low_stock_threshold) values
  ('20000000-0000-0000-0000-000000000001', (select id from public.products where slug = 'audit-bun'), 'Audit Bun', 3000, 12, 2),
  ('20000000-0000-0000-0000-000000000001', (select id from public.products where slug = 'audit-roll'), 'Audit Roll', 2000, 6, 1);
update public.weekly_menu_products set price = 3500, weekly_quantity = 15 where id = (select id from public.weekly_menu_products where name_snapshot = 'Audit Bun' and weekly_menu_id = '20000000-0000-0000-0000-000000000001');
update public.weekly_menu_products set description_snapshot = 'Soft' where id = (select id from public.weekly_menu_products where name_snapshot = 'Audit Bun' and weekly_menu_id = '20000000-0000-0000-0000-000000000001');
set local role postgres;
update public.weekly_menu_products set locked_at = now() where id = (select id from public.weekly_menu_products where name_snapshot = 'Audit Bun' and weekly_menu_id = '20000000-0000-0000-0000-000000000001'); -- first order
set local role authenticated;
delete from public.weekly_menu_products where name_snapshot = 'Audit Roll' and weekly_menu_id = '20000000-0000-0000-0000-000000000001';

set local role postgres;
select results_eq(
  $$select action, actor_user_id from public.audit_logs
     where entity_type = 'weekly_menu' and entity_id = '20000000-0000-0000-0000-000000000001' order by created_at, action$$,
  $$values ('MENU_PRODUCT_ADDED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('MENU_PRODUCT_ADDED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('MENU_PRODUCT_REMOVED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('MENU_PRODUCT_UPDATED', '00000000-0000-0000-0000-0000000000ad'::uuid),
           ('MENU_PRODUCT_UPDATED', '00000000-0000-0000-0000-0000000000ad'::uuid)$$,
  'menu product add, edits and removal audited on the menu; locking is not an admin change');
select is(
  (select metadata -> 'changes' from public.audit_logs where action = 'MENU_PRODUCT_UPDATED'
     and entity_id = '20000000-0000-0000-0000-000000000001' and metadata -> 'changes' <> '{}'::jsonb),
  '{"price": {"from": 3000, "to": 3500}, "weekly_quantity": {"from": 12, "to": 15}}'::jsonb,
  'price and quantity changes keep before and after values');
select is(
  (select metadata -> 'fields' from public.audit_logs where action = 'MENU_PRODUCT_UPDATED'
     and entity_id = '20000000-0000-0000-0000-000000000001' and metadata -> 'changes' = '{}'::jsonb),
  '["description"]'::jsonb, 'text edits name the field');
select results_eq(
  $$select metadata ->> 'name', (metadata ->> 'price')::numeric, (metadata ->> 'weekly_quantity')::int
      from public.audit_logs where action = 'MENU_PRODUCT_ADDED' and entity_id = '20000000-0000-0000-0000-000000000001'
       and metadata ->> 'name' = 'Audit Bun'$$,
  $$values ('Audit Bun', 3000::numeric, 12)$$, 'adding records the weekly price and quantity');

-- ---------- append-only, admin-only ----------
set local role authenticated;
select throws_ok($$update public.audit_logs set action = 'TAMPERED'$$, '42501', null, 'admins cannot rewrite audit records');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'admins cannot delete audit records');
set local role postgres;
select throws_ok($$update public.audit_logs set action = 'TAMPERED' where action = 'MENU_PRODUCT_ADDED'$$, null, null,
  'even the table owner cannot rewrite audit records');
select throws_ok($$delete from public.audit_logs where action = 'MENU_PRODUCT_ADDED'$$, null, null,
  'even the table owner cannot delete audit records');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select is((select count(*)::int from public.audit_logs), 0, 'customers read no audit records');
select throws_ok($$insert into public.audit_logs (action, entity_type) values ('FAKE', 'order')$$, '42501', null,
  'customers cannot write audit records');

set local role postgres;
select ok(not has_function_privilege('authenticated', 'public.audit_menu_product_change()', 'execute'),
  'trigger functions are not callable by clients');
select ok(not has_function_privilege('anon', 'public.audit_profile_role_change()', 'execute'),
  'role-change trigger function is not callable by visitors');
select is(
  (select count(*)::int from pg_trigger where tgname in
     ('profiles_audit_role_change', 'products_audit', 'product_images_audit', 'categories_audit', 'weekly_menu_products_audit')
     and not tgisinternal and tgenabled = 'O'),
  5, 'all audit triggers are enabled');

select * from finish();
rollback;
