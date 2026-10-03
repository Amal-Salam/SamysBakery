-- Milestone 14 — cancellation and refunds (separate operations).
-- Spec: AGENTS.md §29–30; API contract §21–22; Database_Security §24–25.
-- Owner decision (2026-10-03): refunds are reconciled from Paystack refund
-- webhooks plus an admin "Check refund status"; only Paystack's "processed"
-- marks a refund REFUNDED.

-- ---------------------------------------------------------------------
-- cancel_order(): customer (own order) or admin, only before READY.
-- Releases the confirmed reservation. Never refunds.
-- ---------------------------------------------------------------------

create function public.cancel_order(target_order_number text, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
  current_order record;
  released integer;
  clean_reason text := nullif(trim(coalesce(reason, '')), '');
begin
  -- 1. Authorization.
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  actor_is_admin := public.is_admin();

  -- 2. Lock the order.
  select id, order_number, user_id, order_status into current_order
    from public.orders where order_number = target_order_number for update;
  if not found or (not actor_is_admin and current_order.user_id is distinct from actor) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  -- 3. Only before READY.
  if current_order.order_status not in ('PAID', 'RECEIVED', 'BAKING') then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  -- 4. Mark CANCELLED.
  update public.orders set order_status = 'CANCELLED', cancelled_at = now() where id = current_order.id;

  -- 5. Release the confirmed reservation (the original weekly quantity is untouched).
  update public.inventory_reservations
     set status = 'RELEASED', released_at = now()
   where order_id = current_order.id and reservation_type = 'ORDER_CONFIRMED' and status = 'ACTIVE';
  get diagnostics released = row_count;

  -- 6. Audit.
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'ORDER_CANCELLED', 'order', current_order.id,
          jsonb_strip_nulls(jsonb_build_object(
            'order_number', current_order.order_number,
            'from', current_order.order_status,
            'cancelled_by', case when actor_is_admin then 'ADMIN' else 'CUSTOMER' end,
            'reason', clean_reason,
            'reservations_released', released)));

  return jsonb_build_object('order_number', current_order.order_number, 'reservations_released', released);
end;
$$;

revoke all on function public.cancel_order(text, text) from public, anon;
grant execute on function public.cancel_order(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- request_refund(): admin explicitly starts a full refund of a cancelled
-- order. Records the request; Paystack is called by the server afterwards.
-- ---------------------------------------------------------------------

create function public.request_refund(target_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_order record;
  pay record;
  existing record;
  refund_id uuid;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id, order_number, order_status into current_order
    from public.orders where order_number = target_order_number for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if current_order.order_status <> 'CANCELLED' then
    raise exception 'ORDER_NOT_CANCELLED' using errcode = 'P0001';
  end if;

  select id, reference, amount, status into pay from public.payments where order_id = current_order.id;
  if not found or pay.status not in ('PAID', 'REFUNDED') then
    raise exception 'NOT_REFUNDABLE' using errcode = 'P0001';
  end if;

  select id, status, provider_status into existing from public.refunds where payment_id = pay.id for update;
  if found then
    if existing.status = 'REFUNDED' then
      raise exception 'ALREADY_REFUNDED' using errcode = 'P0001';
    end if;
    -- Only a refund that Paystack failed (or that never reached Paystack) may be retried.
    if existing.provider_status is null or existing.provider_status not in ('failed', 'request_failed') then
      raise exception 'REFUND_IN_PROGRESS' using errcode = 'P0001';
    end if;
    update public.refunds
       set provider_status = null, paystack_refund_id = null, requested_at = null, created_by = actor
     where id = existing.id;
    refund_id := existing.id;
  else
    insert into public.refunds (order_id, payment_id, amount, status, reason, created_by)
    values (current_order.id, pay.id, pay.amount, 'NOT_REFUNDED', 'CANCELLATION', actor)
    returning id into refund_id;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'REFUND_INITIATED', 'order', current_order.id,
          jsonb_build_object('order_number', current_order.order_number, 'refund_id', refund_id,
                             'amount', pay.amount));

  return jsonb_build_object('refund_id', refund_id, 'payment_reference', pay.reference, 'amount', pay.amount);
end;
$$;

revoke all on function public.request_refund(text) from public, anon;
grant execute on function public.request_refund(text) to authenticated;

-- record_refund_request(): audit now reflects the refund's real reason.
create or replace function public.record_refund_request(target_refund_id uuid, provider_refund_id text, provider_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_reason text;
begin
  update public.refunds
     set paystack_refund_id = coalesce(provider_refund_id, paystack_refund_id),
         provider_status = left(record_refund_request.provider_status, 50),
         requested_at = coalesce(requested_at, now())
   where id = target_refund_id
  returning reason into refund_reason;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'REFUND_REQUESTED', 'refund', target_refund_id,
          jsonb_build_object('provider_refund_id', provider_refund_id, 'provider_status', provider_status,
                             'reason', refund_reason));
end;
$$;

-- ---------------------------------------------------------------------
-- apply_refund_status(): records Paystack's (server-verified) refund state.
-- Only "processed" marks REFUNDED. Idempotent.
-- ---------------------------------------------------------------------

create function public.apply_refund_status(target_refund_id uuid, reported_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund record;
begin
  select id, status, payment_id, order_id, provider_status as previous
    into refund from public.refunds where id = target_refund_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if refund.status = 'REFUNDED' then
    return 'REFUNDED';
  end if;

  if reported_status = 'processed' then
    update public.refunds
       set status = 'REFUNDED', provider_status = 'processed', processed_at = now()
     where id = refund.id;
    update public.payments set status = 'REFUNDED' where id = refund.payment_id;
    if refund.order_id is not null then
      update public.orders set payment_status = 'REFUNDED' where id = refund.order_id;
    end if;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'REFUND_CONFIRMED', 'refund', refund.id,
            jsonb_build_object('order_id', refund.order_id, 'provider_status', reported_status));
    return 'REFUNDED';
  end if;

  update public.refunds set provider_status = left(reported_status, 50) where id = refund.id;
  if reported_status = 'failed' and refund.previous is distinct from 'failed' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'REFUND_FAILED', 'refund', refund.id, jsonb_build_object('order_id', refund.order_id));
  end if;
  return 'NOT_REFUNDED';
end;
$$;

revoke all on function public.apply_refund_status(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_refund_status(uuid, text) to service_role;
