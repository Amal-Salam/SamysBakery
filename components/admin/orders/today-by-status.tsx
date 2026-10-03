import { OrdersTable } from "@/components/admin/orders/orders-table";
import type { AdminOrderSummary } from "@/features/orders/admin";
import { ORDER_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/rules";

const STATUSES: OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];

/** Today's orders grouped by status (Design System §21); cancelled last. */
export function TodayByStatus({ orders, headingLevel = "h2" }: { orders: AdminOrderSummary[]; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const groups = STATUSES.map((status) => ({
    status,
    orders: orders.filter((order) => order.orderStatus === status),
  })).filter((group) => group.orders.length > 0);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const headingId = `today-${group.status.toLowerCase()}`;
        return (
          <section key={group.status} aria-labelledby={headingId} className="flex flex-col gap-2">
            <Heading id={headingId} className="text-heading-3 text-primary">
              {ORDER_STATUS_LABELS[group.status]} <span className="text-muted-foreground">({group.orders.length})</span>
            </Heading>
            <OrdersTable orders={group.orders} caption={`Today's ${ORDER_STATUS_LABELS[group.status]} orders`} />
          </section>
        );
      })}
    </div>
  );
}
