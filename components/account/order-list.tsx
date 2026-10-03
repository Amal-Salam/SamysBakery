import Link from "next/link";

import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import type { MyOrderSummary } from "@/features/orders/customer";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatLongDate } from "@/lib/utils/dates";

const placedFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });

export function OrderList({ orders }: { orders: MyOrderSummary[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Your orders">
      {orders.map((order) => (
        <li key={order.orderNumber} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Link href={`/account/orders/${order.orderNumber}`} className="font-heading text-heading-3 text-primary hover:text-accent">
                {order.orderNumber}
              </Link>
              <p className="text-caption text-muted-foreground">Placed {placedFormat.format(new Date(order.placedAt))}</p>
            </div>
            <OrderStatusBadge status={order.orderStatus} />
          </div>
          <p className="mt-2 text-body-sm">
            {order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-body-sm">
            <span>Delivery: {formatLongDate(order.deliveryDate)}</span>
            <span className="font-semibold">{formatNaira(order.subtotal)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
