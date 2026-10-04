-- Milestone 16 — admin operations: inventory view and customer lookup.
-- Spec: API contract §26 (getInventory), §28 (getCustomers/getCustomer);
-- Design System §25–26. Read-only, admin-only; stock increases continue to go
-- through add_inventory() (Milestone 9).

-- ---------------------------------------------------------------------
-- get_menu_inventory(): per-product capacity, reservations and availability
-- ---------------------------------------------------------------------

create function public.get_menu_inventory(target_menu_id uuid)
returns table (
  weekly_menu_product_id uuid,
  name text,
  weekly_quantity integer,
  added_quantity integer,
  reserved_pending integer,
  reserved_confirmed integer,
  available_quantity integer,
  low_stock_threshold integer,
  availability_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    wmp.id,
    wmp.name_snapshot,
    wmp.weekly_quantity,
    coalesce((select sum(a.quantity) from public.inventory_adjustments a
               where a.weekly_menu_product_id = wmp.id), 0)::integer,
    coalesce((select sum(r.quantity) from public.inventory_reservations r
               where r.weekly_menu_product_id = wmp.id and r.status = 'ACTIVE'
                 and r.reservation_type = 'PAYMENT_TEMPORARY' and r.expires_at > now()), 0)::integer,
    coalesce((select sum(r.quantity) from public.inventory_reservations r
               where r.weekly_menu_product_id = wmp.id and r.status = 'ACTIVE'
                 and r.reservation_type = 'ORDER_CONFIRMED'), 0)::integer,
    public.available_quantity(wmp.id),
    wmp.low_stock_threshold,
    public.availability_status(public.available_quantity(wmp.id), wmp.low_stock_threshold)
  from public.weekly_menu_products wmp
  where wmp.weekly_menu_id = target_menu_id
  order by wmp.created_at;
end;
$$;

revoke all on function public.get_menu_inventory(uuid) from public, anon;
grant execute on function public.get_menu_inventory(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Customer lookup. Email lives in auth.users, which clients cannot read,
-- so these admin-only functions return the minimum the screen needs.
-- ---------------------------------------------------------------------

create function public.admin_list_customers(search text default null, max_rows integer default 100)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  order_count integer,
  last_order_number text,
  last_order_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(search, '')), '') is not null then
    pattern := '%' || replace(replace(replace(left(trim(search), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.phone,
    p.created_at,
    (select count(*)::integer from public.orders o where o.user_id = p.id),
    last_order.order_number,
    last_order.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select o.order_number, o.created_at from public.orders o
     where o.user_id = p.id order by o.created_at desc limit 1
  ) last_order on true
  where p.role = 'CUSTOMER'
    and (pattern is null
         or p.full_name ilike pattern
         or u.email ilike pattern
         or coalesce(p.phone, '') ilike pattern)
  order by last_order.created_at desc nulls last, p.created_at desc
  limit least(greatest(coalesce(max_rows, 100), 1), 200);
end;
$$;

revoke all on function public.admin_list_customers(text, integer) from public, anon;
grant execute on function public.admin_list_customers(text, integer) to authenticated;

create function public.admin_get_customer(target_user_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, u.email::text, p.phone, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = target_user_id and p.role = 'CUSTOMER';
end;
$$;

revoke all on function public.admin_get_customer(uuid) from public, anon;
grant execute on function public.admin_get_customer(uuid) to authenticated;
