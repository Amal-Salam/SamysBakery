"use client";

import { useActionState } from "react";

import { deleteAccountAction, updateProfileAction } from "@/actions/account";
import { FormError, FormField, FormSuccess, SubmitButton, fieldErrorsOf } from "@/components/ui/form";
import { DELETE_CONFIRMATION_PHRASE } from "@/schemas/profile";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4" noValidate>
      <FormError state={state} />
      <FormSuccess state={state} message="Profile saved." />
      <FormField label="Full name" name="fullName" autoComplete="name" maxLength={120} defaultValue={fullName} errors={errors.fullName} />
      <FormField
        label="Phone number (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        maxLength={30}
        defaultValue={phone ?? ""}
        errors={errors.phone}
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-body-sm font-medium">Email</p>
        <p className="text-body-sm text-muted-foreground break-all">{email}</p>
      </div>
      <SubmitButton fullWidth={false} className="self-start" pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4" noValidate>
      <p className="text-body-sm">
        Your login, saved addresses, cart and profile will be permanently deleted. Past orders stay in the
        bakery&apos;s records with your name, contact details and address removed. You can&apos;t delete your
        account while an order is still being prepared or delivered.
      </p>
      <FormError state={state} />
      <FormField
        label={`Type ${DELETE_CONFIRMATION_PHRASE} to confirm`}
        name="confirmation"
        autoComplete="off"
        errors={errors.confirmation}
      />
      <SubmitButton variant="destructive" fullWidth={false} className="self-start" pendingLabel="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
