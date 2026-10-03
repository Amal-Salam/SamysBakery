"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/api";

export function fieldErrorsOf(state: ActionResult<unknown> | null) {
  return state && !state.success ? (state.error.fieldErrors ?? {}) : {};
}

type FieldChrome = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

/** Label + control + hint + error, wired together for assistive technology. */
function Field({
  label,
  errors,
  hint,
  children,
}: Omit<FieldChrome, "name"> & {
  children: (aria: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
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
      {children({
        id,
        "aria-invalid": errors?.length ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
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

export function FormField({
  label,
  errors,
  hint,
  ...inputProps
}: React.ComponentProps<typeof Input> & FieldChrome) {
  return (
    <Field label={label} errors={errors} hint={hint}>
      {(aria) => <Input {...aria} {...inputProps} />}
    </Field>
  );
}

export function TextareaField({
  label,
  errors,
  hint,
  ...textareaProps
}: React.ComponentProps<typeof Textarea> & FieldChrome) {
  return (
    <Field label={label} errors={errors} hint={hint}>
      {(aria) => <Textarea {...aria} {...textareaProps} />}
    </Field>
  );
}

export function SelectField({
  label,
  errors,
  hint,
  children,
  ...selectProps
}: React.ComponentProps<typeof NativeSelect> & FieldChrome) {
  return (
    <Field label={label} errors={errors} hint={hint}>
      {(aria) => (
        <NativeSelect {...aria} {...selectProps}>
          {children}
        </NativeSelect>
      )}
    </Field>
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

/** Success confirmation for a completed form action. */
export function FormSuccess({
  state,
  message,
}: {
  state: ActionResult<unknown> | null;
  message: string;
}) {
  if (!state?.success) return null;
  return (
    <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size = "lg",
  fullWidth = true,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  fullWidth?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      className={cn(fullWidth && "w-full", className)}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
