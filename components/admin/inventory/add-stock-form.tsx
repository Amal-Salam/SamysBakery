"use client";

import { useActionState, useState } from "react";

import { addInventoryAction } from "@/actions/admin/inventory";
import {
  FormError,
  FormField,
  SelectField,
  SubmitButton,
  TextareaField,
  fieldErrorsOf,
} from "@/components/ui/form";

type StockProduct = { id: string; name: string; available: number };

/**
 * Stock increase (Design System §25): shows quantity, reason and the resulting
 * availability before submitting. The preview is a guide only — the server
 * calculates and returns the real figure.
 */
export function AddStockForm({ products }: { products: StockProduct[] }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof addInventoryAction>> | null, formData: FormData) => {
      const result = await addInventoryAction(prev, formData);
      if (result.success) setQuantity("");
      return result;
    },
    null
  );
  const errors = fieldErrorsOf(state);
  const product = products.find((p) => p.id === productId);
  const amount = Number(quantity);
  const validAmount = Number.isInteger(amount) && amount > 0;

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError state={state} />
      {state?.success ? (
        <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
          Added {state.data.added}. Now available: {state.data.available}.
        </p>
      ) : null}
      <SelectField
        label="Product"
        name="weeklyMenuProductId"
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        errors={errors.weeklyMenuProductId}
      >
        <option value="" disabled>
          Choose a product…
        </option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.available} available)
          </option>
        ))}
      </SelectField>
      <FormField
        label="Quantity to add"
        name="quantity"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        hint="Stock can only be increased."
        errors={errors.quantity}
      />
      <TextareaField
        label="Reason"
        name="reason"
        rows={2}
        maxLength={500}
        required
        hint="For example: extra batch baked. Saved with your name in the stock history."
        errors={errors.reason}
      />
      <p aria-live="polite" className="text-body-sm text-muted-foreground">
        {product
          ? validAmount
            ? `${product.name}: ${product.available} available now → ${product.available + amount} after adding ${amount}.`
            : `${product.name}: ${product.available} available now.`
          : "Choose a product to see the resulting availability."}
      </p>
      <SubmitButton fullWidth={false} size="default" className="self-start" pendingLabel="Adding…">
        Add stock
      </SubmitButton>
    </form>
  );
}
