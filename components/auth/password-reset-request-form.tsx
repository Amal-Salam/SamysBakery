"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/actions/auth";

import { FormError, FormField, SubmitButton, fieldErrorsOf } from "@/components/ui/form";

export function PasswordResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const errors = fieldErrorsOf(state);

  if (state?.success) {
    return (
      <p role="status" className="rounded-md bg-muted px-4 py-5 text-body-sm">
        If an account exists for that email, we&apos;ve sent a link to reset your
        password. Check your inbox.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError state={state} />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={errors.email}
      />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
