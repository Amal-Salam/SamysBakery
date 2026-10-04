import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityList } from "@/components/admin/audit/activity-list";
import { CancelAndRefund } from "@/components/admin/orders/cancel-and-refund";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/order-status-badge";
import { OrderStatusControl } from "@/components/admin/orders/order-status-control";
import { getEntityActivity } from "@/features/admin/audit";
import { getAdminOrder } from "@/features/orders/admin";
import { ORDER_STATUS_LABELS } from "@/features/orders/rules";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatLongDate } from "@/lib/utils/dates";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Order" };


export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[orderNumber]">) {
  if (!(await isAdminViewer())) return null;
  const { orderNumber } = await params;
  if (!/^SAM-\d{4,}$/.test(orderNumber)) notFound();
  const order = await getAdminOrder(orderNumber);
  if (!order) notFound();
  const activity = await getEntityActivity([
    { type: "order", ids: [order.id] },
    { type: "refund", ids: order.refund ? [order.refund.id] : [] },
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/orders" className="text-body-sm text-accent underline underline-offset-4">
          ← Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-1 text-primary">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.orderStatus} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          Current status: <strong>{ORDER_STATUS_LABELS[order.orderStatus]}</strong>
        </p>
      </div>

      <section aria-labelledby="status-heading" className="flex max-w-md flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="status-heading" className="text-heading-3 text-primary">
          Order status
        </h2>
        <OrderStatusControl orderNumber={order.orderNumber} status={order.orderStatus} />
      </section>

      <section
        aria-labelledby="cancel-heading"
        className="flex max-w-xl flex-col gap-3 rounded-lg border border-destructive/40 p-4"
      >
        <h2 id="cancel-heading" className="text-heading-3 text-destructive">
          {order.orderStatus === "CANCELLED" ? "Refund" : "Cancel order"}
        </h2>
        <CancelAndRefund order={order} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="customer-heading" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 id="customer-heading" className="text-heading-3 text-primary">
            Customer & delivery
          </h2>
          <dl className="grid gap-2 text-body-sm">
            <div>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="font-medium">
                {order.customerId ? (
                  <Link href={`/admin/customers/${order.customerId}`} className="text-accent underline underline-offset-4">
                    {order.customerName}
                  </Link>
                ) : (
                  order.customerName
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{order.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{order.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Delivery date</dt>
              <dd className="font-medium">{formatLongDate(order.deliveryDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Delivery address</dt>
              <dd>{order.address}</dd>
              {order.additionalInfo ? <dd className="text-muted-foreground">{order.additionalInfo}</dd> : null}
            </div>
            <div>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{order.specialNotes ?? "None"}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="items-heading" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 id="items-heading" className="text-heading-3 text-primary">
            Products
          </h2>
          <ul className="divide-y divide-border text-body-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{item.name}</span>
                  <span className="block text-muted-foreground">
                    {item.quantity} × {formatNaira(item.unitPrice)}
                  </span>
                </span>
                <span className="font-medium">{formatNaira(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex justify-between border-t border-border pt-2 font-semibold">
            <dt>Subtotal</dt>
            <dd>{formatNaira(order.subtotal)}</dd>
          </dl>
        </section>
      </div>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-2">
        <h2 id="activity-heading" className="text-heading-3 text-primary">
          Activity
        </h2>
        <ActivityList entries={activity} empty="No activity recorded yet." />
      </section>
    </div>
  );
}
