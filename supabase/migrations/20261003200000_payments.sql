-- Milestone 10 — Paystack payments, idempotent confirmation, order creation.
-- Spec: API contract §13–18; Database_Security_&_Transaction_Specs.md §16–21.
-- Owner decisions (2026-10-03):
--   * Redirect checkout flow.
--   * Late payments (paid after the hold expired, or superseded by a newer
--     attempt) are refused and refunded automatically; the refund is recorded
--     as requested, never as completed, until Paystack confirms it.
--   * Payment initialization is rate limited in Postgres (no Redis).

-- ---------------------------------------------------------------------
-- Refunds: allow system-initiated refunds of late payments (no order)
-- ---------------------------------------------------------------------

alter table public.refunds alter column order_id drop not null;
alter table public.refunds alter column created_by drop not null;
alter table public.refunds
  add column reason text not null default 'CANCELLATION'
    check (reason in ('CANCELLATION', 'LATE_PAYMENT'));
alter table public.refunds
  add constraint refunds_order_or_late_payment check (order_id is not null or reason = 'LATE_PAYMENT');
-- Full refunds only: one refund per payment (also makes refund requests idempotent).
create unique index refunds_payment_id_key on public.refunds (payment_id);
drop index if exists public.refunds_payment_id_idx;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, keyed on the signed-in user in the database)
-- ---------------------------------------------------------------------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
revoke all on table public.rate_limits from anon, authenticated;
alter table public.rate_limits enable row level security;

create function public.consume_rate_limit(bucket text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  bucket_start timestamptz;
  current_hits integer;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if bucket !~ '^[a-z_]{1,40}$' or max_hits < 1 or window_seconds < 1 then
    raise exception 'INVALID_RATE_LIMIT' using errcode = 'P0001';
  end if;

  bucket_start := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into public.rate_limits as rl (key, window_start, hits)
  values (bucket || ':' || actor, bucket_start, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into current_hits;

  -- Opportunistic cleanup of old windows.
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return current_hits <= max_hits;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Weekly-menu trigger: an order may record the product's first-order lock
-- even if the menu expired between payment and processing.
-- ---------------------------------------------------------------------

create or replace function public.enforce_weekly_menu_product_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  menu_id uuid := case when tg_op = 'DELETE' then old.weekly_menu_id else new.weekly_menu_id end;
  menu_status public.menu_status;
begin
  select status into menu_status from public.weekly_menus where id = menu_id;
  if menu_status = 'EXPIRED' then
    -- Only permitted change on an expired menu: setting locked_at the first time.
    if tg_op = 'UPDATE'
       and old.locked_at is null and new.locked_at is not null
       and (to_jsonb(new) - 'locked_at' - 'updated_at') = (to_jsonb(old) - 'locked_at' - 'updated_at') then
      return new;
    end if;
    raise exception 'MENU_EXPIRED' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.products where id = new.product_id and deleted_at is not null) then
      raise exception 'PRODUCT_ARCHIVED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.weekly_menu_id is distinct from old.weekly_menu_id
       or new.product_id is distinct from old.product_id then
      raise exception 'WEEKLY_PRODUCT_IMMUTABLE_LINK' using errcode = 'P0001';
    end if;
    if old.locked_at is not null and new.locked_at is null then
      raise exception 'WEEKLY_PRODUCT_LOCKED' using errcode = 'P0001';
    end if;
    if old.locked_at is not null and (
         new.name_snapshot is distinct from old.name_snapshot
         or new.price is distinct from old.price
         or new.weekly_quantity is distinct from old.weekly_quantity
       ) then
      raise exception 'WEEKLY_PRODUCT_LOCKED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.locked_at is not null
     or exists (select 1 from public.order_items where weekly_menu_product_id = old.id)
     or exists (select 1 from public.inventory_reservations where weekly_menu_product_id = old.id)
  then
    raise exception 'WEEKLY_PRODUCT_HAS_ORDERS' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------
-- confirm_payment_order(): createPaidOrderFromPayment (server only)
-- Called after the server has verified the transaction with Paystack.
-- Idempotent: repeated calls (webhook retries, customer refresh, both the
-- webhook and the return page) always converge on the same single order.
-- ---------------------------------------------------------------------

create function public.confirm_payment_order(
  payment_reference text,
  verified_amount_kobo bigint,
  verified_currency text,
  verified_paid_at timestamptz,
  provider_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
  snapshot jsonb;
  existing_refund uuid;
  is_late boolean;
  stock_lost boolean := false;
  r record;
  new_order record;
  new_refund_id uuid;
begin
  -- Lock the payment: concurrent webhook + return-page processing serialise here.
  select * into pay from public.payments where reference = payment_reference for update;
  if not found then
    return jsonb_build_object('outcome', 'UNKNOWN_REFERENCE');
  end if;

  -- Idempotency: already turned into an order.
  if pay.order_id is not null then
    return jsonb_build_object(
      'outcome', 'ALREADY_PROCESSED',
      'order_id', pay.order_id,
      'order_number', (select order_number from public.orders where id = pay.order_id),
      'user_id', pay.user_id
    );
  end if;

  -- Idempotency: already refused and sent for refund.
  select id into existing_refund from public.refunds where payment_id = pay.id;
  if existing_refund is not null then
    return jsonb_build_object('outcome', 'REFUND_ALREADY_REQUESTED', 'refund_id', existing_refund,
                              'user_id', pay.user_id);
  end if;

  -- Amount / currency must match the server-calculated amount exactly.
  if verified_currency is distinct from 'NGN' or verified_amount_kobo is distinct from round(pay.amount * 100)::bigint then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, case when verified_currency is distinct from 'NGN' then 'PAYMENT_CURRENCY_MISMATCH'
                       else 'PAYMENT_AMOUNT_MISMATCH' end,
            'payment', pay.id,
            jsonb_build_object('reference', pay.reference, 'expected_kobo', round(pay.amount * 100)::bigint,
                               'verified_kobo', verified_amount_kobo, 'verified_currency', verified_currency));
    perform public.release_payment_internal(pay.id);
    return jsonb_build_object('outcome',
      case when verified_currency is distinct from 'NGN' then 'CURRENCY_MISMATCH' else 'AMOUNT_MISMATCH' end,
      'user_id', pay.user_id);
  end if;

  -- Late (owner decision): superseded/released attempt, or paid after the hold expired.
  is_late := pay.status <> 'PENDING' or exists (
    select 1 from public.inventory_reservations
     where payment_id = pay.id and reservation_type = 'PAYMENT_TEMPORARY'
       and verified_paid_at > expires_at
  );

  if not is_late then
    -- Paid in time. If the hold timed out before we processed it, re-secure the
    -- stock under lock; if someone else has since taken it, refund instead.
    perform 1 from public.weekly_menu_products
     where id in (select weekly_menu_product_id from public.inventory_reservations where payment_id = pay.id)
     order by id
     for update;

    for r in
      select id, weekly_menu_product_id, quantity, status, expires_at
        from public.inventory_reservations
       where payment_id = pay.id and reservation_type = 'PAYMENT_TEMPORARY'
    loop
      if (r.status = 'ACTIVE' and r.expires_at <= now()) or r.status = 'EXPIRED' then
        -- This hold no longer counts against availability; is the stock still free?
        if public.available_quantity(r.weekly_menu_product_id) < r.quantity then
          stock_lost := true;
        end if;
      elsif r.status <> 'ACTIVE' then
        stock_lost := true;
      end if;
    end loop;
  end if;

  if is_late or stock_lost then
    update public.payments
       set status = 'PAID', paid_at = verified_paid_at, provider_transaction_id = confirm_payment_order.provider_transaction_id
     where id = pay.id;
    update public.inventory_reservations
       set status = 'RELEASED', released_at = now()
     where payment_id = pay.id and reservation_type = 'PAYMENT_TEMPORARY' and status = 'ACTIVE';

    insert into public.refunds (payment_id, amount, status, reason, created_by)
    values (pay.id, pay.amount, 'NOT_REFUNDED', 'LATE_PAYMENT', null)
    returning id into new_refund_id;

    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'LATE_PAYMENT_REFUSED', 'payment', pay.id,
            jsonb_build_object('reference', pay.reference, 'amount', pay.amount,
                               'reason', case when is_late then 'PAID_AFTER_HOLD' else 'STOCK_NO_LONGER_AVAILABLE' end,
                               'refund_id', new_refund_id));

    return jsonb_build_object('outcome', 'REFUND_REQUIRED', 'refund_id', new_refund_id,
                              'amount', pay.amount, 'user_id', pay.user_id);
  end if;

  -- Create the order from the server-written checkout snapshot.
  snapshot := pay.checkout_snapshot;

  insert into public.orders (
    user_id, delivery_date, recipient_name, phone, email,
    delivery_address, delivery_city, delivery_state, delivery_additional_info,
    special_notes, subtotal, payment_status, order_status, paid_at
  ) values (
    pay.user_id,
    (snapshot ->> 'delivery_date')::date,
    snapshot #>> '{address,recipient_name}',
    snapshot #>> '{address,phone}',
    snapshot #>> '{customer,email}',
    snapshot #>> '{address,address_line}',
    snapshot #>> '{address,city}',
    snapshot #>> '{address,state}',
    nullif(snapshot #>> '{address,additional_info}', ''),
    nullif(snapshot ->> 'special_notes', ''),
    pay.amount,
    'PAID',
    'PAID',
    verified_paid_at
  )
  returning id, order_number into new_order;

  insert into public.order_items (
    order_id, weekly_menu_product_id, product_name, product_description, product_ingredients,
    product_image, unit_price, quantity, line_total
  )
  select new_order.id,
         (line ->> 'weekly_menu_product_id')::uuid,
         line ->> 'name',
         coalesce(line ->> 'description', ''),
         coalesce(line ->> 'ingredients', ''),
         nullif(line ->> 'image', ''),
         (line ->> 'unit_price')::numeric,
         (line ->> 'quantity')::integer,
         (line ->> 'line_total')::numeric
    from jsonb_array_elements(snapshot -> 'lines') as line;

  -- Temporary reservations → confirmed order reservations.
  insert into public.inventory_reservations (weekly_menu_product_id, order_id, quantity, reservation_type, status)
  select weekly_menu_product_id, new_order.id, quantity, 'ORDER_CONFIRMED', 'ACTIVE'
    from public.inventory_reservations
   where payment_id = pay.id and reservation_type = 'PAYMENT_TEMPORARY';

  update public.inventory_reservations
     set status = 'CONVERTED', order_id = new_order.id
   where payment_id = pay.id and reservation_type = 'PAYMENT_TEMPORARY';

  -- First order locks name, price and weekly quantity of these products.
  update public.weekly_menu_products
     set locked_at = now()
   where locked_at is null
     and id in (select weekly_menu_product_id from public.order_items where order_id = new_order.id);

  update public.payments
     set status = 'PAID', paid_at = verified_paid_at, order_id = new_order.id,
         provider_transaction_id = confirm_payment_order.provider_transaction_id
   where id = pay.id;

  -- The purchased products leave the customer's cart.
  delete from public.cart_items ci
   using public.carts c
   where ci.cart_id = c.id and c.user_id = pay.user_id
     and ci.weekly_menu_product_id in (select weekly_menu_product_id from public.order_items where order_id = new_order.id);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'ORDER_CREATED', 'order', new_order.id,
          jsonb_build_object('order_number', new_order.order_number, 'payment_reference', pay.reference,
                             'subtotal', pay.amount, 'customer_id', pay.user_id));

  return jsonb_build_object('outcome', 'CREATED', 'order_id', new_order.id,
                            'order_number', new_order.order_number, 'user_id', pay.user_id);
end;
$$;

revoke all on function public.confirm_payment_order(text, bigint, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.confirm_payment_order(text, bigint, text, timestamptz, text) to service_role;

-- Records what Paystack said when the automatic late-payment refund was requested.
create function public.record_refund_request(target_refund_id uuid, provider_refund_id text, provider_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.refunds
     set paystack_refund_id = coalesce(provider_refund_id, paystack_refund_id),
         provider_status = left(record_refund_request.provider_status, 50),
         requested_at = coalesce(requested_at, now())
   where id = target_refund_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'REFUND_REQUESTED', 'refund', target_refund_id,
          jsonb_build_object('provider_refund_id', provider_refund_id, 'provider_status', provider_status,
                             'reason', 'LATE_PAYMENT'));
end;
$$;

revoke all on function public.record_refund_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_refund_request(uuid, text, text) to service_role;

-- Server marks an unsuccessful (failed/abandoned/reversed) payment and frees its stock.
create function public.fail_payment(payment_reference text, provider_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
begin
  select id, status into pay from public.payments where reference = payment_reference for update;
  if not found or pay.status <> 'PENDING' then
    return;
  end if;
  perform public.release_payment_internal(pay.id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'PAYMENT_FAILED', 'payment', pay.id,
          jsonb_build_object('reference', payment_reference, 'provider_status', provider_status));
end;
$$;

revoke all on function public.fail_payment(text, text) from public, anon, authenticated;
grant execute on function public.fail_payment(text, text) to service_role;

-- Release must also be callable by the server (service role) for payments.
grant execute on function public.release_inventory_reservation(uuid) to service_role;
