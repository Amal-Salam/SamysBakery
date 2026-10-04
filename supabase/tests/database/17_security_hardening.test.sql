-- Milestone 18 — security invariants that must hold for every future migration.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select is(
  (select array_agg(relname order by relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null, 'every public table has RLS enabled');

select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null, 'every SECURITY DEFINER function pins its search_path');

select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  null, 'no trigger function is callable by clients');

select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  array['delivery_date_status', 'eligible_delivery_dates', 'get_published_menu_availability', 'is_on_published_menu',
        'is_published_menu', 'order_cutoff_time', 'reservation_timeout_minutes']::name[],
  'visitors can call only the reviewed public storefront functions');

select ok(
  not has_function_privilege('anon', 'public.consume_public_rate_limit(text, text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.consume_public_rate_limit(text, text, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.consume_public_rate_limit(text, text, integer, integer)', 'execute'),
  'the public rate limiter is callable by the server (service role) only');

select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('confirm_payment_order', 'apply_refund_status', 'fail_payment', 'record_refund_request',
                        'claim_confirmation_email', 'complete_confirmation_email', 'release_payment_internal',
                        'available_quantity', 'expire_temporary_reservations')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  null, 'payment, refund, email and stock internals are not callable by signed-in users');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'),
  0, 'visitors have no write privileges on any table');

select * from finish();
rollback;
