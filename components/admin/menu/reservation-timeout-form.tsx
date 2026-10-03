"use client";

import { useActionState } from "react";

import { setReservationTimeoutAction } from "@/actions/admin/menu";
import { FormError, FormField, FormSuccess, SubmitButton, fieldErrorsOf } from "@/components/ui/form";

export function ReservationTimeoutForm({ minutes }: { minutes: number }) {
  const [state, action] = useActionState(setReservationTimeoutAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
      <p className="text-body-sm text-muted-foreground">
        While a customer pays, their items are held for this long. If payment isn&apos;t completed in
        time, the items become available to others again.
      </p>
      <FormError state={state} />
      <FormSuccess state={state} message="Payment hold time saved." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <FormField
            label="Payment hold (minutes)"
            name="minutes"
            type="number"
            inputMode="numeric"
            min={5}
            max={120}
            defaultValue={String(minutes)}
            errors={errors.minutes}
          />
        </div>
        <SubmitButton fullWidth={false} size="default" pendingLabel="Saving…">
          Save hold time
        </SubmitButton>
      </div>
    </form>
  );
}
