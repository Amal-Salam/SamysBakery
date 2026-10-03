"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updatePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";

import { FormError, FormField, SubmitButton, fieldErrorsOf } from "./form-parts";

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  const errors = fieldErrorsOf(state);

  if (state?.success) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="rounded-md bg-muted px-4 py-5 text-body-sm">
          Your password has been updated.
        </p>
        <Button asChild size="lg">
          <Link href="/">Continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError state={state} />
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="At least 8 characters."
        errors={errors.password}
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors.confirmPassword}
      />
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
