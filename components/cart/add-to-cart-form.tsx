"use client";

import Link from "next/link";
import { useActionState } from "react";

import { addToCartAction } from "@/actions/cart";
import { FormError, SubmitButton } from "@/components/ui/form";

import { QuantitySelector } from "./quantity-selector";

export function AddToCartForm({
  productId,
  available,
  soldOut,
}: {
  productId: string;
  available: number;
  soldOut: boolean;
}) {
  const [state, action] = useActionState(addToCartAction, null);

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted px-6 text-button font-semibold text-muted-foreground sm:w-fit"
      >
        Sold out
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <QuantitySelector max={available} />
      <FormError state={state} />
      {state?.success ? (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
          Added to cart.
          <Link href="/cart" className="font-semibold underline underline-offset-4">
            View cart
          </Link>
        </p>
      ) : null}
      <SubmitButton pendingLabel="Adding…" className="sm:w-fit">
        Add to Cart
      </SubmitButton>
    </form>
  );
}
