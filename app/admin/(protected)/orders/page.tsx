import type { Metadata } from "next";
import Link from "next/link";

import { OrdersTable } from "@/components/admin/orders/orders-table";
import { TodayByStatus } from "@/components/admin/orders/today-by-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { listAdminOrders, ORDER_VIEWS, type OrderView } from "@/features/orders/admin";
import {
  normalizeOrderNumberQuery,
  ORDER_FLOW,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/features/orders/rules";
import { formatLongDate, lagosToday } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];
function isIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

const VIEW_TITLES: Record<OrderView, string> = {
  today: "Today's Orders",
  upcoming: "Upcoming Orders",
  preparing: "Orders to Prepare",
  ready: "Ready for Delivery",
};

const VIEW_DESCRIPTIONS: Record<OrderView, string> = {
  today: "Orders for delivery today",
  upcoming: "Orders for delivery after today, not yet delivered or cancelled.",
  preparing: "Paid, received or baking orders, earliest delivery first.",
  ready: "Orders ready to hand to the delivery partner, earliest delivery first.",
};

const VIEW_EMPTY: Record<OrderView, string> = {
  today: "No orders for delivery today.",
  upcoming: "No upcoming orders.",
  preparing: "No orders to prepare.",
  ready: "No orders are ready for delivery.",
};

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { status, view: viewParam, q, date } = await searchParams;
  const view = ORDER_VIEWS.includes(viewParam as OrderView) ? (viewParam as OrderView) : undefined;
  const filter = !view && STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const query = !view && typeof q === "string" ? q.trim() : "";
  const orderNumber = query ? normalizeOrderNumberQuery(query) : null;
  const deliveryDate = !view && typeof date === "string" && isIsoDate(date) ? date : undefined;
  const invalidQuery = query !== "" && orderNumber === null;
  const orders = invalidQuery
    ? []
    : await listAdminOrders({ status: filter, view, orderNumber: orderNumber ?? undefined, deliveryDate });
  const filtered = Boolean(filter || orderNumber || deliveryDate);
  const withFilters = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: query || undefined, date: deliveryDate, status: filter, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  if (view) {
    const description =
      view === "today" ? `${VIEW_DESCRIPTIONS.today}, ${formatLongDate(lagosToday())}.` : VIEW_DESCRIPTIONS[view];
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-1 text-primary">{VIEW_TITLES[view]}</h1>
          <p className="text-body-sm text-muted-foreground">{description}</p>
        </div>
        {orders.length === 0 ? (
          <EmptyState title={VIEW_EMPTY[view]} />
        ) : view === "today" ? (
          <TodayByStatus orders={orders} />
        ) : (
          <OrdersTable orders={orders} caption={VIEW_TITLES[view]} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading-1 text-primary">Orders</h1>

      <form role="search" aria-label="Find orders" action="/admin/orders" className="flex flex-wrap items-end gap-3">
        {filter ? <input type="hidden" name="status" value={filter} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-search">Order number</Label>
          <Input id="order-search" name="q" defaultValue={query} placeholder="SAM-1001" className="w-44" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-date">Delivery date</Label>
          <Input id="delivery-date" name="date" type="date" defaultValue={deliveryDate} className="w-44" />
        </div>
        <Button type="submit">Search</Button>
        {query || deliveryDate ? (
          <Button asChild variant="ghost">
            <Link href={filter ? `/admin/orders?status=${filter}` : "/admin/orders"}>Clear</Link>
          </Button>
        ) : null}
      </form>

      {invalidQuery ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm text-destructive">
          Enter an order number like SAM-1001.
        </p>
      ) : null}

      <nav aria-label="Filter orders by status" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={filter ? "outline" : "default"}>
          <Link href={withFilters({ status: undefined })}>All</Link>
        </Button>
        {STATUSES.map((value) => (
          <Button key={value} asChild size="sm" variant={filter === value ? "default" : "outline"}>
            <Link href={withFilters({ status: value })} aria-current={filter === value ? "page" : undefined}>
              {ORDER_STATUS_LABELS[value]}
            </Link>
          </Button>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState title={filtered || invalidQuery ? "No orders match." : "No orders yet."} />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
