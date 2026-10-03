"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/api";

export function fieldErrorsOf(state: ActionResult<unknown> | null) {
  return state && !state.success ? (state.error.fieldErrors ?? {}) : {};
}

export function FormField({
  label,
  errors,
  hint,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, errors?.length ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-body-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error. Field errors are shown next to their inputs instead. */
export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.success) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm text-destructive">
      {state.error.message}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      className="w-full"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
