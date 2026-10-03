"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "@/actions/admin/products";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { FormError, FormField, SubmitButton, fieldErrorsOf } from "@/components/ui/form";
import type { Category } from "@/features/products/queries";

export function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-col gap-4">
      {categories.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          No categories. Products are shown as one list.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 md:flex-row md:items-end"
            >
              <RenameCategoryForm category={category} />
              <div className="flex flex-wrap gap-2">
                <form action={moveCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button type="submit" variant="outline" size="sm" disabled={index === 0}>
                    Move up
                  </Button>
                </form>
                <form action={moveCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={index === categories.length - 1}
                  >
                    Move down
                  </Button>
                </form>
                <ConfirmActionDialog
                  trigger="Delete"
                  triggerSize="sm"
                  title={`Delete the “${category.name}” category?`}
                  description={<p>Products in this category are kept and become uncategorized.</p>}
                  confirmLabel="Delete category"
                  pendingLabel="Deleting…"
                  action={deleteCategoryAction}
                  fields={{ id: category.id }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <AddCategoryForm />
    </div>
  );
}

function RenameCategoryForm({ category }: { category: Category }) {
  const [state, action] = useActionState(renameCategoryAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end" noValidate>
      <input type="hidden" name="id" value={category.id} />
      <div className="flex-1">
        <FormField
          label="Category name"
          name="name"
          maxLength={60}
          defaultValue={category.name}
          errors={errors.name}
        />
      </div>
      <SubmitButton size="default" variant="outline" fullWidth={false} pendingLabel="Saving…">
        Rename
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

function AddCategoryForm() {
  const [state, action] = useActionState(createCategoryAction, null);
  const errors = fieldErrorsOf(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end" noValidate>
      <div className="flex-1">
        <FormField label="New category" name="name" maxLength={60} errors={errors.name} />
      </div>
      <SubmitButton size="default" fullWidth={false} pendingLabel="Adding…">
        Add category
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}
