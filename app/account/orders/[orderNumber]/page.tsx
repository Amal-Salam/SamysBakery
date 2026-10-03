import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/order-status-badge";
import { getMyOrder } from "@/features/orders/customer";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatLongDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Order" };

// Ownership is enforced by RLS: another customer's order number is "not found".
export default async function MyOrderPage({ params }: PageProps<"/account/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  if (!/^SAM-\d{4,}$/.test(orderNumber)) notFound();
  const order = await getMyOrder(orderNumber);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/account/orders" className="text-body-sm text-accent underline underline-offset-4">
        ← Your orders
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-heading-1 text-primary">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.orderStatus} />
      </div>
      <dl className="grid gap-1 text-body-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Payment:</dt>
          <dd>
            <PaymentStatusBadge status={order.paymentStatus} />
          </dd>
        </div>
      </dl>

      <section aria-labelledby="order-items-heading" className="flex flex-col gap-2">
        <h2 id="order-items-heading" className="text-heading-3 text-primary">
          Products
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-body-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3 p-3">
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
        <dl className="flex justify-between font-semibold">
          <dt>Subtotal</dt>
          <dd>{formatNaira(order.subtotal)}</dd>
        </dl>
      </section>

      <section aria-labelledby="order-delivery-heading" className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-body-sm">
        <h2 id="order-delivery-heading" className="text-heading-3 text-primary">
          Delivery
        </h2>
        <p className="font-medium">{formatLongDate(order.deliveryDate)}</p>
        <p>
          {order.recipientName} · {order.phone}
        </p>
        <p>{order.address}</p>
        {order.additionalInfo ? <p className="text-muted-foreground">{order.additionalInfo}</p> : null}
        <p className="mt-2">
          <span className="text-muted-foreground">Notes: </span>
          {order.specialNotes ?? "None"}
        </p>
      </section>
    </div>
  );
}
