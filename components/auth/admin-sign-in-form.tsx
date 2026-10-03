"use client";

import { useActionState } from "react";

import { adminSignIn } from "@/actions/auth";

import { FormError, FormField, SubmitButton, fieldErrorsOf } from "./form-parts";

export function AdminSignInForm() {
  const [state, action] = useActionState(adminSignIn, null);
  const errors = fieldErrorsOf(state);

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
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors.password}
      />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
