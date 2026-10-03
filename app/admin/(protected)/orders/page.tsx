import type { Metadata } from "next";
import Link from "next/link";

import { OrdersTable } from "@/components/admin/orders/orders-table";
import { TodayByStatus } from "@/components/admin/orders/today-by-status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { listAdminOrders, ORDER_VIEWS, type OrderView } from "@/features/orders/admin";
import { ORDER_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/rules";
import { formatLongDate, lagosToday } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];

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
  const { status, view: viewParam } = await searchParams;
  const view = ORDER_VIEWS.includes(viewParam as OrderView) ? (viewParam as OrderView) : undefined;
  const filter = !view && STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const orders = await listAdminOrders({ status: filter, view });

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

      <nav aria-label="Filter orders by status" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={filter ? "outline" : "default"}>
          <Link href="/admin/orders">All</Link>
        </Button>
        {STATUSES.map((value) => (
          <Button key={value} asChild size="sm" variant={filter === value ? "default" : "outline"}>
            <Link href={`/admin/orders?status=${value}`} aria-current={filter === value ? "page" : undefined}>
              {ORDER_STATUS_LABELS[value]}
            </Link>
          </Button>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState title={filter ? `No ${ORDER_STATUS_LABELS[filter].toLowerCase()} orders.` : "No orders yet."} />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
