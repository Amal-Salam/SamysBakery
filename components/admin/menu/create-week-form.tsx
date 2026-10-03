"use client";

import { useActionState } from "react";

import { createWeekAction } from "@/actions/admin/menu";
import { FormError, SubmitButton } from "@/components/ui/form";

export function CreateWeekForm() {
  const [state, action] = useActionState(createWeekAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <SubmitButton fullWidth={false} className="self-start" pendingLabel="Creating…">
        Create week
      </SubmitButton>
    </form>
  );
}
