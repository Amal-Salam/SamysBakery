"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { removeCartItemAction, updateCartItemAction } from "@/actions/cart";
import { ProductImage } from "@/components/storefront/product-image";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { cartIssueMessage, type CartItem } from "@/features/cart/rules";
import { formatNaira } from "@/features/weekly-menu/rules";

export function CartLine({ item }: { item: CartItem }) {
  const [updateState, updateAction, updating] = useActionState(updateCartItemAction, null);
  const [removeState, removeAction, removing] = useActionState(removeCartItemAction, null);
  const busy = updating || removing;
  const issue = cartIssueMessage(item);
  const canChange = item.issue !== "UNAVAILABLE" && item.issue !== "SOLD_OUT";

  return (
    <li className="flex gap-4 py-5" aria-busy={busy}>
      <div className="w-20 shrink-0 sm:w-28">
        <ProductImage image={item.image} name={item.name} sizes="7rem" className="sm:aspect-square" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2">
          {item.slug ? (
            <Link href={`/menu/${item.slug}`} className="font-heading text-heading-3 hover:text-accent">
              {item.name}
            </Link>
          ) : (
            <p className="font-heading text-heading-3 text-muted-foreground">{item.name}</p>
          )}
          {item.lineTotal !== null && !item.issue ? (
            <p className="font-semibold">{formatNaira(item.lineTotal)}</p>
          ) : null}
        </div>
        {item.unitPrice !== null ? (
          <p className="text-body-sm text-muted-foreground">{formatNaira(item.unitPrice)} each</p>
        ) : null}
        {issue ? (
          <p className="text-body-sm font-medium text-destructive" role="status">
            {issue}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {canChange ? (
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
              <form action={updateAction}>
                <input type="hidden" name="productId" value={item.productId} />
                <input type="hidden" name="quantity" value={item.quantity - 1} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={busy || item.quantity <= 1}
                  aria-label={`Decrease quantity of ${item.name}`}
                >
                  <Minus aria-hidden="true" />
                </Button>
              </form>
              <span className="min-w-8 text-center font-medium" aria-label={`Quantity ${item.quantity}`}>
                {item.quantity}
              </span>
              <form action={updateAction}>
                <input type="hidden" name="productId" value={item.productId} />
                <input type="hidden" name="quantity" value={item.quantity + 1} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={busy || item.quantity >= item.available}
                  aria-label={`Increase quantity of ${item.name}`}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </form>
            </div>
          ) : (
            <p className="text-body-sm text-muted-foreground">Quantity: {item.quantity}</p>
          )}
          {item.issue === "EXCEEDS_AVAILABLE" ? (
            <form action={updateAction}>
              <input type="hidden" name="productId" value={item.productId} />
              <input type="hidden" name="quantity" value={item.available} />
              <Button type="submit" variant="outline" size="sm" disabled={busy}>
                Set to {item.available}
              </Button>
            </form>
          ) : null}
          <form action={removeAction}>
            <input type="hidden" name="productId" value={item.productId} />
            <Button type="submit" variant="ghost" size="sm" disabled={busy}>
              <Trash2 aria-hidden="true" />
              Remove<span className="sr-only"> {item.name}</span>
            </Button>
          </form>
        </div>
        <FormError state={updateState} />
        <FormError state={removeState} />
      </div>
    </li>
  );
}
