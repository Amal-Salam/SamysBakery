-- Milestone 11 — order status lifecycle.
-- Spec: PRD §19; API contract §27; Database_Security_&_Transaction_Specs.md §22–23.
-- Owner decisions (2026-10-03) — the admin correction matrix:
--   * Forward: to ANY later status in the normal flow (skipping allowed).
--   * Backward: only ONE step back, with a required reason.
--   * DELIVERED can be corrected with the same one-step-back rule.
--   * CANCELLED is final and is reached only through the cancellation
--     operation (Milestone 14), never through a status update.
-- Every change is audited.

create function public.order_status_rank(status public.order_status)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case status
    when 'PAID' then 1
    when 'RECEIVED' then 2
    when 'BAKING' then 3
    when 'READY' then 4
    when 'HANDED_TO_DELIVERY' then 5
    when 'DELIVERED' then 6
    else null -- CANCELLED is outside the normal flow
  end;
$$;

create function public.update_order_status(
  target_order_number text,
  new_status public.order_status,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_order record;
  from_rank integer;
  to_rank integer;
  direction text;
  clean_reason text := nullif(trim(coalesce(reason, '')), '');
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id, order_number, order_status into current_order
    from public.orders where order_number = target_order_number for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if current_order.order_status = 'CANCELLED' then
    raise exception 'ORDER_CANCELLED' using errcode = 'P0001';
  end if;
  if new_status = 'CANCELLED' then
    raise exception 'USE_CANCELLATION' using errcode = 'P0001';
  end if;
  if new_status = current_order.order_status then
    raise exception 'NO_CHANGE' using errcode = 'P0001';
  end if;

  from_rank := public.order_status_rank(current_order.order_status);
  to_rank := public.order_status_rank(new_status);

  if to_rank > from_rank then
    direction := 'FORWARD';
  elsif to_rank = from_rank - 1 then
    direction := 'CORRECTION';
    if clean_reason is null or char_length(clean_reason) < 3 then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  update public.orders
     set order_status = new_status,
         delivered_at = case when new_status = 'DELIVERED' then now() else null end
   where id = current_order.id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'ORDER_STATUS_CHANGED', 'order', current_order.id,
          jsonb_strip_nulls(jsonb_build_object(
            'order_number', current_order.order_number,
            'from', current_order.order_status,
            'to', new_status,
            'direction', direction,
            'reason', clean_reason)));

  return jsonb_build_object('order_number', current_order.order_number, 'from', current_order.order_status,
                            'to', new_status, 'direction', direction);
end;
$$;

revoke all on function public.update_order_status(text, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(text, public.order_status, text) to authenticated;
