-- Milestone 18 — security hardening.
--
-- 1. Rate limiting for signed-out operations (owner decision, M18): sign-in,
--    admin login, sign-up, password reset and the Paystack webhook. These run
--    server-side, so Supabase Auth sees one server IP; the app limits per
--    visitor instead. Keys are HMACs computed by the server — the database
--    never stores raw IP addresses or emails. Callable by the service role only.
--
-- 2. Internal trigger functions are not callable directly by clients
--    (triggers still fire; EXECUTE is only checked when a trigger is created).

create function public.consume_public_rate_limit(
  bucket text,
  subject text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  current_hits integer;
begin
  if bucket !~ '^[a-z_]{1,40}$' or subject !~ '^[0-9a-f]{64}$' or max_hits < 1 or window_seconds < 1 then
    raise exception 'INVALID_RATE_LIMIT' using errcode = 'P0001';
  end if;

  bucket_start := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into public.rate_limits as rl (key, window_start, hits)
  values ('public:' || bucket || ':' || subject, bucket_start, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into current_hits;

  delete from public.rate_limits where window_start < now() - interval '1 day';

  return current_hits <= max_hits;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, text, integer, integer) to service_role;

revoke all on function public.enforce_weekly_menu_product_rules() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_history_modification() from public, anon, authenticated;
revoke all on function public.protect_audit_log() from public, anon, authenticated;
revoke all on function public.protect_order_item_snapshot() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
