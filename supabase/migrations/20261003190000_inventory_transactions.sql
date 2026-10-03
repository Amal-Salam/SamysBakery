-- Milestone 9 — inventory transactions.
-- Spec: Database_Security_&_Transaction_Specs.md §11–15, §26; API contract §12, §26.
-- Owner decision (2026-10-03): temporary payment reservations last 15 minutes
-- (admin-changeable setting).
--
-- Concurrency model: every operation that can REDUCE availability (reserving)
-- or change capacity (adding stock) first takes a row lock on the affected
-- weekly_menu_products rows (FOR UPDATE, in id order to avoid deadlocks).
-- The availability check and the reservation insert then happen inside the
-- same transaction, so two customers can never both take the last unit.

-- ---------------------------------------------------------------------
-- Reservation timeout setting
-- ---------------------------------------------------------------------

insert into public.system_settings (key, value)
values ('RESERVATION_TIMEOUT_MINUTES', '15'::jsonb)
on conflict (key) do nothing;

create function public.reservation_timeout_minutes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'RESERVATION_TIMEOUT_MINUTES'),
    15
  );
$$;

grant execute on function public.reservation_timeout_minutes() to authenticated;

create function public.set_reservation_timeout(minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  previous integer;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if minutes is null or minutes < 5 or minutes > 120 then
    raise exception 'INVALID_TIMEOUT' using errcode = 'P0001';
  end if;
  previous := public.reservation_timeout_minutes();

  insert into public.system_settings (key, value, updated_by)
  values ('RESERVATION_TIMEOUT_MINUTES', to_jsonb(minutes), actor)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;

  insert into public.audit_logs (actor_user_id, action, entity_type, metadata)
  values (actor, 'RESERVATION_TIMEOUT_CHANGED', 'system_setting',
          jsonb_build_object('key', 'RESERVATION_TIMEOUT_MINUTES', 'from', previous, 'to', minutes));
end;
$$;

revoke all on function public.set_reservation_timeout(integer) from public, anon;
grant execute on function public.set_reservation_timeout(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Release (failed / abandoned / superseded payment)
-- ---------------------------------------------------------------------

-- Internal: releases a pending payment's active temporary reservations and
-- marks the payment FAILED. No-op for payments that are not PENDING.
create function public.release_payment_internal(target_payment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released integer;
begin
  update public.inventory_reservations
     set status = 'RELEASED', released_at = now()
   where payment_id = target_payment_id
     and reservation_type = 'PAYMENT_TEMPORARY'
     and status = 'ACTIVE';
  get diagnostics released = row_count;

  update public.payments
     set status = 'FAILED'
   where id = target_payment_id and status = 'PENDING';

  return released;
end;
$$;

revoke all on function public.release_payment_internal(uuid) from public, anon, authenticated;

-- release_inventory_reservation() (spec name): the customer (owner) or the
-- server may release a pending payment's temporary reservations.
create function public.release_inventory_reservation(target_payment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_id uuid;
begin
  select user_id into owner_id from public.payments where id = target_payment_id for update;
  if owner_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Clients may only release their own payment; the service role has no auth.uid().
  if actor is not null and actor <> owner_id then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.release_payment_internal(target_payment_id);
end;
$$;

revoke all on function public.release_inventory_reservation(uuid) from public, anon;
grant execute on function public.release_inventory_reservation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- reserve_checkout_inventory(): the checkout reservation transaction
-- ---------------------------------------------------------------------

create function public.reserve_checkout_inventory(
  delivery_date date,
  address_id uuid,
  special_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  customer record;
  menu record;
  addr record;
  v_cart_id uuid;
  date_status text;
  line record;
  available integer;
  short_names text[] := '{}';
  lines jsonb := '[]'::jsonb;
  subtotal_kobo bigint := 0;
  new_payment_id uuid;
  new_reference text;
  expires timestamptz;
  previous record;
begin
  -- 1. Authenticated customer.
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  select p.full_name, u.email into customer
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = actor;

  -- Current published menu.
  select id, week_start, week_end into menu
    from public.weekly_menus
   where status = 'PUBLISHED' and week_end >= public.lagos_today();
  if not found then
    raise exception 'MENU_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Delivery date + cutoff (authoritative).
  date_status := public.delivery_date_status(delivery_date);
  if date_status <> 'VALID' then
    raise exception '%', date_status using errcode = 'P0001';
  end if;

  -- Address must belong to the customer.
  select recipient_name, phone, address_line, city, state, additional_info into addr
    from public.addresses where id = address_id and user_id = actor;
  if not found then
    raise exception 'ADDRESS_NOT_FOUND' using errcode = 'P0002';
  end if;

  if special_notes is not null and char_length(special_notes) > 500 then
    raise exception 'NOTES_TOO_LONG' using errcode = 'P0001';
  end if;

  -- A retry supersedes any earlier unpaid attempt: release its hold first so
  -- the same customer never holds stock twice.
  for previous in
    select id from public.payments where user_id = actor and status = 'PENDING' and order_id is null
    for update
  loop
    perform public.release_payment_internal(previous.id);
  end loop;

  -- 2. Load the customer's cart.
  select id into v_cart_id from public.carts where user_id = actor;
  if v_cart_id is null or not exists (select 1 from public.cart_items ci where ci.cart_id = v_cart_id) then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  -- Every cart line must be on the current published menu.
  if exists (
    select 1 from public.cart_items ci
      join public.weekly_menu_products wmp on wmp.id = ci.weekly_menu_product_id
     where ci.cart_id = v_cart_id and wmp.weekly_menu_id <> menu.id
  ) then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- 3. Lock the relevant inventory rows (deterministic order: no deadlocks).
  perform 1
     from public.weekly_menu_products wmp
    where wmp.id in (select ci.weekly_menu_product_id from public.cart_items ci where ci.cart_id = v_cart_id)
    order by wmp.id
    for update;

  -- 4–5. Calculate availability and verify requested quantities, under the lock.
  for line in
    select ci.quantity, wmp.id, wmp.name_snapshot, wmp.description_snapshot,
           wmp.ingredients_snapshot, wmp.image_snapshot, wmp.price
      from public.cart_items ci
      join public.weekly_menu_products wmp on wmp.id = ci.weekly_menu_product_id
     where ci.cart_id = v_cart_id
     order by ci.created_at, wmp.id
  loop
    available := public.available_quantity(line.id);
    if line.quantity > available then
      short_names := short_names || line.name_snapshot;
    end if;
    subtotal_kobo := subtotal_kobo + round(line.price * 100)::bigint * line.quantity;
    lines := lines || jsonb_build_object(
      'weekly_menu_product_id', line.id,
      'name', line.name_snapshot,
      'description', line.description_snapshot,
      'ingredients', line.ingredients_snapshot,
      'image', line.image_snapshot,
      'unit_price', line.price,
      'quantity', line.quantity,
      'line_total', line.price * line.quantity
    );
  end loop;

  if array_length(short_names, 1) > 0 then
    raise exception 'OUT_OF_STOCK'
      using errcode = 'P0001', detail = array_to_string(short_names, ', ');
  end if;

  -- 6. Pending payment with the server-written checkout snapshot.
  new_reference := 'SAMY-' || upper(replace(gen_random_uuid()::text, '-', ''));
  expires := now() + make_interval(mins => public.reservation_timeout_minutes());

  insert into public.payments (user_id, reference, amount, currency, status, checkout_snapshot)
  values (
    actor,
    new_reference,
    subtotal_kobo / 100.0,
    'NGN',
    'PENDING',
    jsonb_build_object(
      'weekly_menu_id', menu.id,
      'customer', jsonb_build_object('name', customer.full_name, 'email', customer.email),
      'delivery_date', delivery_date,
      'address', jsonb_build_object(
        'recipient_name', addr.recipient_name,
        'phone', addr.phone,
        'address_line', addr.address_line,
        'city', addr.city,
        'state', addr.state,
        'additional_info', addr.additional_info
      ),
      'special_notes', nullif(trim(special_notes), ''),
      'lines', lines,
      'subtotal', subtotal_kobo / 100.0
    )
  )
  returning id into new_payment_id;

  -- 7. Temporary reservations.
  insert into public.inventory_reservations
    (weekly_menu_product_id, payment_id, quantity, reservation_type, status, expires_at)
  select ci.weekly_menu_product_id, new_payment_id, ci.quantity, 'PAYMENT_TEMPORARY', 'ACTIVE', expires
    from public.cart_items ci
   where ci.cart_id = v_cart_id;

  -- 8. Payment context (never secrets).
  return jsonb_build_object(
    'payment_id', new_payment_id,
    'reference', new_reference,
    'amount', subtotal_kobo / 100.0,
    'currency', 'NGN',
    'expires_at', expires
  );
end;
$$;

revoke all on function public.reserve_checkout_inventory(date, uuid, text) from public, anon;
grant execute on function public.reserve_checkout_inventory(date, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Expiry of temporary reservations (system job)
-- ---------------------------------------------------------------------

create function public.expire_temporary_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer;
begin
  update public.inventory_reservations
     set status = 'EXPIRED', released_at = now()
   where reservation_type = 'PAYMENT_TEMPORARY'
     and status = 'ACTIVE'
     and expires_at <= now();
  get diagnostics expired = row_count;
  return expired;
end;
$$;

revoke all on function public.expire_temporary_reservations() from public, anon, authenticated;

select cron.schedule(
  'expire-temporary-reservations',
  '* * * * *',
  $$select public.expire_temporary_reservations()$$
);

-- ---------------------------------------------------------------------
-- add_inventory(): admin stock increase (positive only, audited)
-- ---------------------------------------------------------------------

create function public.add_inventory(
  target_weekly_menu_product_id uuid,
  quantity integer,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  product record;
  before_available integer;
  after_available integer;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if quantity is null or quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;
  if reason is null or char_length(trim(reason)) = 0 or char_length(reason) > 500 then
    raise exception 'INVALID_REASON' using errcode = 'P0001';
  end if;

  -- Lock the product so concurrent reservations see a consistent capacity.
  select wmp.id, wmp.name_snapshot, wm.status
    into product
    from public.weekly_menu_products wmp
    join public.weekly_menus wm on wm.id = wmp.weekly_menu_id
   where wmp.id = target_weekly_menu_product_id
   for update of wmp;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if product.status = 'EXPIRED' then
    raise exception 'MENU_EXPIRED' using errcode = 'P0001';
  end if;

  before_available := public.available_quantity(product.id);

  insert into public.inventory_adjustments (weekly_menu_product_id, quantity, reason, created_by)
  values (product.id, quantity, trim(reason), actor);

  after_available := public.available_quantity(product.id);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'INVENTORY_INCREASED', 'weekly_menu_product', product.id,
          jsonb_build_object('product', product.name_snapshot, 'quantity', quantity,
                             'reason', trim(reason), 'available_before', before_available,
                             'available_after', after_available));

  return after_available;
end;
$$;

revoke all on function public.add_inventory(uuid, integer, text) from public, anon;
grant execute on function public.add_inventory(uuid, integer, text) to authenticated;
