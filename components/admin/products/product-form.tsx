"use client";

import { useActionState } from "react";

import { createProductAction, updateProductAction } from "@/actions/admin/products";
import {
  FormError,
  FormField,
  FormSuccess,
  SelectField,
  SubmitButton,
  TextareaField,
  fieldErrorsOf,
} from "@/components/ui/form";
import type { Category, LibraryProduct } from "@/features/products/queries";

type Props =
  | { mode: "create"; categories: Category[]; product?: undefined }
  | { mode: "edit"; categories: Category[]; product: LibraryProduct };

export function ProductForm({ mode, categories, product }: Props) {
  const [state, action] = useActionState(
    mode === "create" ? createProductAction : updateProductAction,
    null
  );
  const errors = fieldErrorsOf(state);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5" noValidate>
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <FormError state={state} />
      <FormSuccess state={state} message="Product saved." />

      <FormField
        label="Name"
        name="name"
        required
        maxLength={120}
        defaultValue={product?.name}
        errors={errors.name}
      />
      <FormField
        label="URL slug"
        name="slug"
        maxLength={140}
        defaultValue={product?.slug}
        hint={
          mode === "create"
            ? "Optional. Leave blank to generate it from the name."
            : "Changing this changes the product's web address. Leave blank to keep it."
        }
        errors={errors.slug}
      />
      <SelectField
        label="Category"
        name="categoryId"
        className="w-full"
        defaultValue={product?.categoryId ?? ""}
        hint="Optional. Uncategorized products are still sold normally."
        errors={errors.categoryId}
      >
        <option value="">Uncategorized</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>
      <TextareaField
        label="Description"
        name="description"
        rows={4}
        maxLength={2000}
        defaultValue={product?.description}
        errors={errors.description}
      />
      <TextareaField
        label="Ingredients"
        name="ingredients"
        rows={3}
        maxLength={2000}
        defaultValue={product?.ingredients}
        errors={errors.ingredients}
      />
      {mode === "edit" ? (
        <p className="text-caption text-muted-foreground">
          Changes apply to future weekly menus. Existing weekly menus and past orders keep their
          own copies.
        </p>
      ) : null}
      <SubmitButton pendingLabel="Saving…" fullWidth={false} className="self-start">
        {mode === "create" ? "Create product" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
