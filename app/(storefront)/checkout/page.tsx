import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getCart } from "@/features/cart/service";
import { getCheckoutContext } from "@/features/checkout/service";
import { requireUser } from "@/lib/security/auth";
import { formatClockTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  // Authentication is required before checkout (proxy redirects first; this is the authoritative check).
  const user = await requireUser("/checkout");
  const [cart, context] = await Promise.all([getCart(), getCheckoutContext(user)]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
      <h1 className="text-display-l text-primary">Checkout</h1>

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty."
          action={
            <Button asChild size="lg">
              <Link href="/menu">View This Week&apos;s Menu</Link>
            </Button>
          }
        />
      ) : !cart.canCheckout ? (
        <EmptyState
          title="Some items in your cart need attention."
          description="A product is sold out or no longer available in that quantity."
          action={
            <Button asChild size="lg">
              <Link href="/cart">Review your cart</Link>
            </Button>
          }
        />
      ) : context.deliveryDates.length === 0 ? (
        <EmptyState
          title="Ordering for this week has closed."
          description={`Orders for today close at ${formatClockTime(context.cutoff)}, and there are no delivery days left this week. A new menu is coming soon.`}
          action={
            <Button asChild variant="outline" size="lg">
              <Link href="/menu">Back to the menu</Link>
            </Button>
          }
        />
      ) : (
        <CheckoutFlow context={context} cart={cart} />
      )}
    </div>
  );
}
