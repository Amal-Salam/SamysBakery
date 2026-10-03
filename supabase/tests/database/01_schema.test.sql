-- Schema structure: tables, RLS-by-default, privileges, indexes.
begin;
-- Hosted CLI runs connect as cli_login_postgres; run as postgres (as locally).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- All approved tables exist.
select has_table('public', t, t || ' exists')
from unnest(array[
  'profiles', 'addresses', 'categories', 'products', 'product_images',
  'weekly_menus', 'weekly_menu_products', 'carts', 'cart_items',
  'inventory_reservations', 'inventory_adjustments', 'orders', 'order_items',
  'payments', 'refunds', 'audit_logs', 'system_settings'
]) as t;

-- RLS is enabled on every public table.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every public table has RLS enabled'
);

-- anon may only ever SELECT (catalogue rows are filtered by RLS).
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'),
  0,
  'anon has no write privileges on any public table'
);
-- Clients can never write audited/transactional tables directly.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
     and table_name in ('weekly_menus', 'orders', 'order_items', 'payments', 'refunds',
       'inventory_reservations', 'inventory_adjustments', 'audit_logs', 'system_settings'))
  + (select count(*)::int from information_schema.column_privileges
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE')
     and table_name in ('weekly_menus', 'orders', 'order_items', 'payments', 'refunds',
       'inventory_reservations', 'inventory_adjustments', 'audit_logs', 'system_settings')),
  0,
  'no client write privileges on audited/transactional tables'
);

-- Security-spec §33 minimum indexes (spot-check the high-risk ones).
select ok(
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'profiles_role_idx', 'addresses_user_id_idx', 'weekly_menus_status_idx',
    'weekly_menu_products_weekly_menu_id_idx', 'weekly_menu_products_product_id_idx',
    'cart_items_cart_id_idx', 'inventory_reservations_product_status_idx',
    'inventory_reservations_expires_at_idx', 'inventory_adjustments_weekly_menu_product_id_idx',
    'orders_user_id_idx', 'orders_order_status_idx', 'orders_delivery_date_idx',
    'order_items_order_id_idx', 'payments_order_id_key', 'refunds_order_id_idx',
    'audit_logs_entity_idx', 'audit_logs_created_at_idx'
  )) = 17,
  'required indexes exist'
);

-- No mutable available_quantity column anywhere.
select hasnt_column('public', 'weekly_menu_products', 'available_quantity',
  'no casually mutable available_quantity');

-- Initial categories are seeded as data.
select results_eq(
  'select slug from public.categories order by display_order',
  array['cakes', 'bread', 'pastries'],
  'initial categories seeded'
);

select * from finish();
rollback;
