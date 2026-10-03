import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminOrders } from "@/features/orders/admin";
import { ORDER_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/rules";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatWeekRange } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];

function deliveryLabel(date: string) {
  return formatWeekRange(date, date).split(" – ")[1];
}

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const orders = await listAdminOrders({ status: filter });

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
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <Table>
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
      )}
    </div>
  );
}
