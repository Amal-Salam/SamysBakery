import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatNaira } from "@/features/weekly-menu/rules";
import { requireUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatLongDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Order Confirmed" };

// Only reachable for orders that exist, i.e. after verified payment and order
// creation. RLS returns the order only to the customer who placed it.
export default async function OrderConfirmationPage({ params }: PageProps<"/order-confirmation/[orderNumber]">) {
  const { orderNumber } = await params;
  await requireUser(`/order-confirmation/${orderNumber}`);
  if (!/^SAM-\d{4,}$/.test(orderNumber)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      `order_number, delivery_date, recipient_name, phone, delivery_address, delivery_city, delivery_state,
       delivery_additional_info, special_notes, subtotal,
       order_items ( id, product_name, quantity, unit_price, line_total )`
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
      <div className="flex flex-col items-start gap-3">
        <CircleCheck className="size-12 text-success" aria-hidden="true" />
        <h1 className="text-display-l text-primary">Order Confirmed</h1>
        <p className="font-heading text-heading-2">{order.order_number}</p>
        <p className="text-body-lg text-muted-foreground">
          Thank you! Your payment was received and your order is with the bakery.
        </p>
      </div>

      <section aria-labelledby="items-heading" className="flex flex-col gap-3">
        <h2 id="items-heading" className="text-heading-3 text-primary">
          Your order
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 p-3 text-body-sm">
              <span>
                <span className="font-medium">{item.product_name}</span>
                <span className="block text-muted-foreground">
                  {item.quantity} × {formatNaira(Number(item.unit_price))}
                </span>
              </span>
              <span className="font-medium">{formatNaira(Number(item.line_total))}</span>
            </li>
          ))}
        </ul>
        <dl className="flex justify-between text-body-lg font-semibold">
          <dt>Subtotal</dt>
          <dd>{formatNaira(Number(order.subtotal))}</dd>
        </dl>
      </section>

      <section aria-labelledby="delivery-heading" className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <h2 id="delivery-heading" className="sr-only">
          Delivery
        </h2>
        <div>
          <p className="text-caption text-muted-foreground">Delivery date</p>
          <p className="font-medium">{formatLongDate(order.delivery_date)}</p>
        </div>
        <div>
          <p className="text-caption text-muted-foreground">Delivery address</p>
          <p className="font-medium">
            {order.recipient_name} · {order.phone}
          </p>
          <p className="text-body-sm">
            {[order.delivery_address, order.delivery_city, order.delivery_state].join(", ")}
          </p>
          {order.delivery_additional_info ? (
            <p className="text-body-sm text-muted-foreground">{order.delivery_additional_info}</p>
          ) : null}
        </div>
        {order.special_notes ? (
          <div className="sm:col-span-2">
            <p className="text-caption text-muted-foreground">Notes</p>
            <p className="text-body-sm">{order.special_notes}</p>
          </div>
        ) : null}
      </section>

      <p className="text-body-sm text-muted-foreground">
        Delivery fee is handled separately by our delivery partner and is not included in the amount paid
        to Samy&apos;s Bakery.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/account">View My Orders</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/menu">Continue Browsing</Link>
        </Button>
      </div>
    </div>
  );
}
