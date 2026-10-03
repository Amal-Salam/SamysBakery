"use client";

import Image from "next/image";
import { useActionState, useId } from "react";

import { removeMenuProductAction, updateMenuProductAction } from "@/actions/admin/menu";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
  TextareaField,
  fieldErrorsOf,
} from "@/components/ui/form";
import type { MenuProduct } from "@/features/weekly-menu/queries";
import { formatNaira } from "@/features/weekly-menu/rules";
import { productImageUrl } from "@/lib/supabase/storage";

export function MenuProductEditor({
  product,
  editable,
}: {
  product: MenuProduct;
  /** False for ended/expired menus, which are read-only history. */
  editable: boolean;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex gap-4">
        {product.imageSnapshot ? (
          <Image
            src={productImageUrl(product.imageSnapshot)}
            alt={product.libraryImages.find((image) => image.storagePath === product.imageSnapshot)?.altText ?? ""}
            width={72}
            height={72}
            sizes="72px"
            className="aspect-square h-auto w-18 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex aspect-square w-18 shrink-0 items-center justify-center rounded-md bg-muted text-caption text-muted-foreground">
            No photo
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{product.name}</p>
            {product.locked ? <Badge variant="outline">Has orders — partly locked</Badge> : null}
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-muted-foreground">
            <div className="flex gap-1">
              <dt>Price</dt>
              <dd className="font-medium text-foreground">{formatNaira(product.price)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Weekly quantity</dt>
              <dd className="font-medium text-foreground">{product.weeklyQuantity}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Low-stock at</dt>
              <dd className="font-medium text-foreground">{product.lowStockThreshold}</dd>
            </div>
          </dl>
        </div>
      </div>

      {editable ? (
        <details className="group rounded-md border border-border">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-body-sm font-medium">
            Edit {product.name}
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
            <EditForm product={product} />
            {product.locked ? (
              <p className="text-body-sm text-muted-foreground">
                This product has orders, so it can&apos;t be removed from the menu.
              </p>
            ) : (
              <ConfirmActionDialog
                trigger="Remove from menu"
                triggerSize="sm"
                title={`Remove “${product.name}” from this menu?`}
                description={
                  <p>It stays in the Product Library. Customers&apos; carts will no longer include it.</p>
                }
                confirmLabel="Remove from menu"
                pendingLabel="Removing…"
                action={removeMenuProductAction}
                fields={{ id: product.id }}
              />
            )}
          </div>
        </details>
      ) : null}
    </li>
  );
}

function EditForm({ product }: { product: MenuProduct }) {
  const [state, action] = useActionState(updateMenuProductAction, null);
  const errors = fieldErrorsOf(state);
  const lockNoteId = useId();
  const locked = product.locked;
  const lockProps = locked
    ? { readOnly: true, "aria-describedby": lockNoteId, className: "bg-muted text-muted-foreground" }
    : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={product.id} />
      <FormError state={state} />
      <FormSuccess state={state} message="Menu product saved." />

      {locked ? (
        <p id={lockNoteId} className="rounded-md bg-warning/10 px-3 py-2 text-body-sm text-warning">
          Locked: this product has orders, so its name, price and weekly quantity can&apos;t change.
          Description, ingredients, photo and low-stock threshold are still editable.
        </p>
      ) : null}

      <FormField
        label="Name on this menu"
        name="name"
        maxLength={120}
        defaultValue={product.name}
        errors={errors.name}
        {...lockProps}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Weekly price (₦)"
          name="price"
          inputMode="decimal"
          defaultValue={String(product.price)}
          errors={errors.price}
          {...lockProps}
        />
        <FormField
          label="Weekly quantity"
          name="weeklyQuantity"
          inputMode="numeric"
          defaultValue={String(product.weeklyQuantity)}
          errors={errors.weeklyQuantity}
          {...lockProps}
        />
        <FormField
          label="Low-stock threshold"
          name="lowStockThreshold"
          inputMode="numeric"
          defaultValue={String(product.lowStockThreshold)}
          errors={errors.lowStockThreshold}
        />
      </div>
      <TextareaField
        label="Description"
        name="description"
        rows={3}
        maxLength={2000}
        defaultValue={product.description}
        errors={errors.description}
      />
      <TextareaField
        label="Ingredients"
        name="ingredients"
        rows={2}
        maxLength={2000}
        defaultValue={product.ingredients}
        errors={errors.ingredients}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium">Photo on this menu</legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 has-checked:border-primary">
            <input type="radio" name="imageSnapshot" value="" defaultChecked={!product.imageSnapshot} />
            <span className="text-body-sm">No photo</span>
          </label>
          {product.libraryImages.map((image) => (
            <label
              key={image.storagePath}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 has-checked:border-primary"
            >
              <input
                type="radio"
                name="imageSnapshot"
                value={image.storagePath}
                defaultChecked={product.imageSnapshot === image.storagePath}
              />
              <Image
                src={productImageUrl(image.storagePath)}
                alt={image.altText}
                width={56}
                height={56}
                sizes="56px"
                className="aspect-square h-auto w-14 rounded object-cover"
              />
            </label>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          Add or replace photos in the Product Library, then choose one here.
        </p>
        {errors.imageSnapshot?.length ? (
          <p className="text-body-sm text-destructive">{errors.imageSnapshot[0]}</p>
        ) : null}
      </fieldset>

      <SubmitButton fullWidth={false} className="self-start" pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
