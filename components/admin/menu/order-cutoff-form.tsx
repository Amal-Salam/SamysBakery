"use client";

import { useActionState } from "react";

import { setOrderCutoffAction } from "@/actions/admin/menu";
import { FormError, FormField, FormSuccess, SubmitButton, fieldErrorsOf } from "@/components/ui/form";

export function OrderCutoffForm({ cutoff }: { cutoff: string }) {
  const [state, action] = useActionState(setOrderCutoffAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <p className="text-body-sm text-muted-foreground">
        After this time (Abuja time), customers can no longer choose today for delivery; the next
        delivery day becomes the earliest option. Changes are recorded in the audit log.
      </p>
      <FormError state={state} />
      <FormSuccess state={state} message="Ordering cutoff saved." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <FormField label="Same-day cutoff" name="cutoff" type="time" defaultValue={cutoff} errors={errors.cutoff} />
        </div>
        <SubmitButton fullWidth={false} size="default" pendingLabel="Saving…">
          Save cutoff
        </SubmitButton>
      </div>
    </form>
  );
}
