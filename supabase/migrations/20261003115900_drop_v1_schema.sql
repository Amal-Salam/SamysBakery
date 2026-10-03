-- Remove the legacy v1 schema from the hosted project before v2 migrations run.
-- Approved by the project owner on 2026-10-03. v1 data was backed up locally first.
-- Every statement uses IF EXISTS, so this is a no-op on a fresh database.

-- v1 sign-up hook on auth.users (would otherwise write into the dropped v1 users table).
drop trigger if exists on_auth_user_created on auth.users;

-- v1 tables (policies, indexes and foreign keys on them are dropped with them).
drop table if exists public.payment_events cascade;
drop table if exists public.stock_reservations cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.categories cascade;
drop table if exists public.blackout_dates cascade;
drop table if exists public.store_settings cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.users cascade;

-- v1 functions.
drop function if exists public.handle_new_auth_user() cascade;
drop function if exists public.reserve_product_stock cascade;
drop function if exists public.release_stock_reservation cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;

-- v1 enum types.
drop type if exists public.delivery_type;
drop type if exists public.order_status;
drop type if exists public.payment_gateway;
drop type if exists public.payment_status;
drop type if exists public.reservation_status;
drop type if exists public.user_role;
