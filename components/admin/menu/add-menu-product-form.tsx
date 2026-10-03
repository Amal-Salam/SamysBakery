"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";

import { addMenuProductAction } from "@/actions/admin/menu";
import {
  FormError,
  FormField,
  FormSuccess,
  SelectField,
  SubmitButton,
  fieldErrorsOf,
} from "@/components/ui/form";
import type { AddableProduct } from "@/features/weekly-menu/queries";
import type { ActionResult } from "@/types/api";

export function AddMenuProductForm({
  menuId,
  products,
}: {
  menuId: string;
  products: AddableProduct[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await addMenuProductAction(prev, formData);
      if (result.success) formRef.current?.reset();
      return result;
    },
    null
  );
  const errors = fieldErrorsOf(state);

  if (products.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Every Product Library product is already on this menu.{" "}
        <Link href="/admin/products/new" className="text-accent underline underline-offset-4">
          Create a new product
        </Link>
        .
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="menuId" value={menuId} />
      <FormError state={state} />
      <FormSuccess state={state} message="Product added to the menu." />
      <SelectField
        label="Product"
        name="productId"
        className="w-full"
        defaultValue=""
        errors={errors.productId}
        hint="Its name, description, ingredients and main photo are copied into this week's menu."
      >
        <option value="" disabled>
          Choose a Product Library product…
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
            {product.categoryName ? ` (${product.categoryName})` : ""}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Weekly price (₦)"
          name="price"
          inputMode="decimal"
          placeholder="e.g. 6500"
          errors={errors.price}
        />
        <FormField
          label="Weekly quantity"
          name="weeklyQuantity"
          inputMode="numeric"
          placeholder="e.g. 20"
          errors={errors.weeklyQuantity}
        />
        <FormField
          label="Low-stock threshold"
          name="lowStockThreshold"
          inputMode="numeric"
          defaultValue="0"
          hint="Warn when this many or fewer are left."
          errors={errors.lowStockThreshold}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton fullWidth={false} pendingLabel="Adding…">
          Add to menu
        </SubmitButton>
        <Link href="/admin/products/new" className="text-body-sm text-accent underline underline-offset-4">
          Need a new product? Create it in the Product Library
        </Link>
      </div>
    </form>
  );
}
