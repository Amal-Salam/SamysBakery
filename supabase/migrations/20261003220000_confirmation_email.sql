-- Milestone 12 — order confirmation email, sent exactly once.
-- Spec: AGENTS.md §32; API contract §20; PRD §23.
--   * Sent only after verified payment and order creation.
--   * Email failure never affects the paid order; a later processing of the
--     same payment (webhook retry / return page) retries the send.
--   * Duplicate webhooks never send a second email: a single UPDATE claims
--     the send, so concurrent processors cannot both send.

alter table public.orders
  add column confirmation_email_sent_at timestamptz,
  add column confirmation_email_claimed_at timestamptz;

-- Returns true if the caller won the right to send now.
create function public.claim_confirmation_email(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.orders
     set confirmation_email_claimed_at = now()
   where id = target_order_id
     and confirmation_email_sent_at is null
     -- A stale claim (sender crashed) can be retaken after 5 minutes.
     and (confirmation_email_claimed_at is null or confirmation_email_claimed_at < now() - interval '5 minutes')
  returning true;
$$;

-- Records the result: success marks it sent; failure releases the claim for a retry.
create function public.complete_confirmation_email(target_order_id uuid, succeeded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if succeeded then
    update public.orders
       set confirmation_email_sent_at = now(), confirmation_email_claimed_at = null
     where id = target_order_id and confirmation_email_sent_at is null;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'ORDER_CONFIRMATION_EMAIL_SENT', 'order', target_order_id, '{}'::jsonb);
  else
    update public.orders set confirmation_email_claimed_at = null where id = target_order_id;
  end if;
end;
$$;

revoke all on function public.claim_confirmation_email(uuid) from public, anon, authenticated;
revoke all on function public.complete_confirmation_email(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_confirmation_email(uuid) to service_role;
grant execute on function public.complete_confirmation_email(uuid, boolean) to service_role;
