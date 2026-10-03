"use client";

import { useActionState } from "react";

import { signUp } from "@/actions/auth";

import { FormError, FormField, SubmitButton, fieldErrorsOf } from "./form-parts";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, null);
  const errors = fieldErrorsOf(state);

  if (state?.success) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-md bg-muted px-4 py-5">
        <p className="font-heading text-heading-3 font-semibold">Check your email</p>
        <p className="text-body-sm text-muted-foreground">
          We&apos;ve sent a verification link to <strong>{state.data.email}</strong>.
          Verify your email address, then sign in. You need a verified email to check out.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <FormField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        maxLength={120}
        errors={errors.fullName}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={errors.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="At least 8 characters."
        errors={errors.password}
      />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
