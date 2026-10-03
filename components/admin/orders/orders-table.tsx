import Link from "next/link";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/order-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminOrderSummary } from "@/features/orders/admin";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatWeekRange } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

function deliveryLabel(date: string) {
  return formatWeekRange(date, date).split(" – ")[1];
}

export function OrdersTable({ orders, caption }: { orders: AdminOrderSummary[]; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.orderNumber} className={cn(order.orderStatus === "CANCELLED" && "opacity-70")}>
              <TableCell>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="font-medium text-accent underline underline-offset-4"
                >
                  {order.orderNumber}
                </Link>
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>{deliveryLabel(order.deliveryDate)}</TableCell>
              <TableCell className="text-right">{formatNaira(order.subtotal)}</TableCell>
              <TableCell>
                <PaymentStatusBadge status={order.paymentStatus} />
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.orderStatus} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
