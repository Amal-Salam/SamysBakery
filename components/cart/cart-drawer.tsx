"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cartIssueMessage, type EvaluatedCart } from "@/features/cart/rules";
import { formatNaira } from "@/features/weekly-menu/rules";

/** Quick cart summary (PRD §14): not a checkout interface. */
export function CartDrawer({ cart }: { cart: EvaluatedCart }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const count = cart.itemCount;
  const label = count === 0 ? "Cart, empty" : `Cart, ${count} ${count === 1 ? "item" : "items"}`;

  // Close when navigating via a link inside the drawer.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body-sm font-medium whitespace-nowrap text-foreground transition-colors hover:text-accent sm:px-3 sm:text-body"
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          <span>Cart</span>
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-semibold text-accent-foreground"
            >
              {count}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-heading-2">Your Cart</SheetTitle>
          <SheetDescription>
            {count === 0 ? "Your cart is empty." : `${count} ${count === 1 ? "item" : "items"}`}
          </SheetDescription>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start gap-4 px-4">
            <Button asChild>
              <Link href="/menu">View This Week&apos;s Menu</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-1 flex-col divide-y divide-border overflow-y-auto px-4">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex flex-col gap-1 py-3">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{item.name}</p>
                  {item.lineTotal !== null && !item.issue ? (
                    <p className="font-medium whitespace-nowrap">{formatNaira(item.lineTotal)}</p>
                  ) : null}
                </div>
                <p className="text-body-sm text-muted-foreground">
                  {item.quantity} × {item.unitPrice !== null ? formatNaira(item.unitPrice) : "—"}
                </p>
                {item.issue ? <p className="text-body-sm text-destructive">{cartIssueMessage(item)}</p> : null}
              </li>
            ))}
          </ul>
        )}

        {cart.items.length > 0 ? (
          <SheetFooter className="border-t border-border">
            <div className="flex items-center justify-between text-body-lg font-semibold">
              <span>Subtotal</span>
              <span>{formatNaira(cart.subtotal)}</span>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link href="/cart">View Cart</Link>
            </Button>
            {cart.canCheckout ? (
              <Button asChild size="lg">
                <Link href="/checkout">Checkout</Link>
              </Button>
            ) : (
              <p className="text-body-sm text-muted-foreground">
                Fix the items marked above in your cart before checking out.
              </p>
            )}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
