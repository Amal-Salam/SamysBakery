-- Milestone 15 — revenue metrics for the admin dashboard and /admin/revenue.
-- Owner decisions (2026-10-03) — the approved metric contract:
--   * Paid      = orders paid in the period (count + subtotal), including
--                 orders cancelled later.
--   * Cancelled = of those, orders now CANCELLED (count + subtotal).
--   * Refunded  = of those, refunds Paystack has confirmed (status REFUNDED).
--   * Net       = Paid − Refunded.
--   * Products sold = units in paid orders that are NOT cancelled.
--   * Periods are by the order's payment date in Africa/Lagos; refunds are
--     attributed to the period their order was paid in.
--   * Late payments refunded automatically never became orders: excluded.
-- No other financial metrics.

create function public.get_revenue_metrics(from_date date default null, to_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with period_orders as (
    select o.id, o.subtotal, o.order_status
      from public.orders o
     where (from_date is null or (o.paid_at at time zone 'Africa/Lagos')::date >= from_date)
       and (to_date is null or (o.paid_at at time zone 'Africa/Lagos')::date <= to_date)
  ),
  totals as (
    select
      count(*)::int as paid_count,
      coalesce(sum(subtotal), 0) as paid_total,
      (count(*) filter (where order_status = 'CANCELLED'))::int as cancelled_count,
      coalesce(sum(subtotal) filter (where order_status = 'CANCELLED'), 0) as cancelled_total
    from period_orders
  ),
  refunded as (
    select count(*)::int as refunded_count, coalesce(sum(r.amount), 0) as refunded_total
      from public.refunds r
      join period_orders po on po.id = r.order_id
     where r.status = 'REFUNDED'
  ),
  sold as (
    select oi.product_name, sum(oi.quantity)::int as quantity
      from public.order_items oi
      join period_orders po on po.id = oi.order_id
     where po.order_status <> 'CANCELLED'
     group by oi.product_name
  )
  select jsonb_build_object(
    'paid_count', t.paid_count,
    'paid_total', t.paid_total,
    'cancelled_count', t.cancelled_count,
    'cancelled_total', t.cancelled_total,
    'refunded_count', rf.refunded_count,
    'refunded_total', rf.refunded_total,
    'net_total', t.paid_total - rf.refunded_total,
    'products_sold', (select coalesce(sum(quantity), 0)::int from sold),
    'products', coalesce(
      (select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity)
                        order by quantity desc, product_name)
         from sold),
      '[]'::jsonb)
  )
  into result
  from totals t, refunded rf;

  return result;
end;
$$;

revoke all on function public.get_revenue_metrics(date, date) from public, anon;
grant execute on function public.get_revenue_metrics(date, date) to authenticated;
