import type { Metadata } from "next";
import Link from "next/link";

import { clearCartAction } from "@/actions/cart";
import { CartLine } from "@/components/cart/cart-line";
import { CartNoticeBanner } from "@/components/cart/cart-notice";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getCart, readCartNotice } from "@/features/cart/service";
import { formatNaira } from "@/features/weekly-menu/rules";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const [cart, notice] = await Promise.all([getCart(), readCartNotice()]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
      <h1 className="text-display-l text-primary">Your Cart</h1>
      <CartNoticeBanner notice={notice} />

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty."
          action={
            <Button asChild size="lg">
              <Link href="/menu">View This Week&apos;s Menu</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="cart-items-heading">
            <h2 id="cart-items-heading" className="sr-only">
              Items
            </h2>
            <ul className="divide-y divide-border border-y border-border">
              {cart.items.map((item) => (
                <CartLine key={item.productId} item={item} />
              ))}
            </ul>
            <div className="mt-4">
              <ConfirmActionDialog
                trigger="Clear cart"
                triggerVariant="ghost"
                triggerSize="sm"
                title="Clear your cart?"
                description={<p>All items will be removed from your cart.</p>}
                confirmLabel="Clear cart"
                pendingLabel="Clearing…"
                action={clearCartAction}
                fields={{}}
              />
            </div>
          </section>

          <aside aria-labelledby="summary-heading" className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-surface p-5">
            <h2 id="summary-heading" className="text-heading-3 text-primary">
              Order Summary
            </h2>
            <dl className="flex items-center justify-between text-body-lg font-semibold">
              <dt>Subtotal</dt>
              <dd>{formatNaira(cart.subtotal)}</dd>
            </dl>
            <p className="text-caption text-muted-foreground">
              Prices and availability are checked again at checkout. Your cart doesn&apos;t hold
              stock until you pay.
            </p>
            {cart.canCheckout ? (
              <Button asChild size="lg">
                <Link href="/checkout">Checkout</Link>
              </Button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  aria-describedby="checkout-blocked"
                  className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-md bg-muted px-6 text-button font-semibold text-muted-foreground"
                >
                  Checkout
                </button>
                <p id="checkout-blocked" className="text-body-sm text-destructive">
                  Fix the items marked in your cart before checking out.
                </p>
              </>
            )}
            <Button asChild variant="outline">
              <Link href="/menu">Continue Shopping</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
