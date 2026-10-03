-- Milestone 6 — server-authoritative availability for the storefront.
-- Spec: Database.md §9; Database_Security_&_Transaction_Specs.md §12.
--
--   effective capacity = weekly_quantity + sum(inventory adjustments)
--   available          = effective capacity − active reservations
--
-- Active reservations are confirmed order reservations plus temporary payment
-- reservations that have not yet expired (the timeout value itself is still
-- UNDECIDED; this logic does not depend on it).
-- Customers never read reservations directly; they only receive the result.

create function public.available_quantity(target_weekly_menu_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    wmp.weekly_quantity
      + coalesce((
          select sum(a.quantity)
            from public.inventory_adjustments a
           where a.weekly_menu_product_id = wmp.id
        ), 0)
      - coalesce((
          select sum(r.quantity)
            from public.inventory_reservations r
           where r.weekly_menu_product_id = wmp.id
             and r.status = 'ACTIVE'
             and (r.reservation_type = 'ORDER_CONFIRMED' or r.expires_at > now())
        ), 0)
  )::integer
  from public.weekly_menu_products wmp
  where wmp.id = target_weekly_menu_product_id;
$$;

-- Internal building block for other database functions only; clients use
-- get_published_menu_availability() (and admin functions in later milestones).
revoke all on function public.available_quantity(uuid) from public, anon, authenticated;

-- Low-stock / sold-out classification, shared by storefront and admin.
create function public.availability_status(available integer, low_stock_threshold integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when available <= 0 then 'SOLD_OUT'
    when low_stock_threshold > 0 and available <= low_stock_threshold then 'LOW_STOCK'
    else 'AVAILABLE'
  end;
$$;

grant execute on function public.availability_status(integer, integer) to anon, authenticated;

-- Public: availability for products on the current published (not ended) menu only.
create function public.get_published_menu_availability()
returns table (
  weekly_menu_product_id uuid,
  available_quantity integer,
  availability_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    wmp.id,
    public.available_quantity(wmp.id),
    public.availability_status(public.available_quantity(wmp.id), wmp.low_stock_threshold)
  from public.weekly_menu_products wmp
  join public.weekly_menus wm on wm.id = wmp.weekly_menu_id
  where wm.status = 'PUBLISHED'
    and wm.week_end >= public.lagos_today();
$$;

revoke all on function public.get_published_menu_availability() from public;
grant execute on function public.get_published_menu_availability() to anon, authenticated;
