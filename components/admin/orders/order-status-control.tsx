"use client";

import { useActionState, useState } from "react";

import { updateOrderStatusAction } from "@/actions/admin/orders";
import {
  FormError,
  FormSuccess,
  SelectField,
  SubmitButton,
  TextareaField,
  fieldErrorsOf,
} from "@/components/ui/form";
import { ORDER_STATUS_LABELS, allowedStatusMoves, type OrderStatus } from "@/features/orders/rules";

/** Status dropdown (PRD §19) offering only the moves the matrix allows. */
export function OrderStatusControl({ orderNumber, status }: { orderNumber: string; status: OrderStatus }) {
  const moves = allowedStatusMoves(status);
  const [selected, setSelected] = useState("");
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof updateOrderStatusAction>> | null, formData: FormData) => {
      const result = await updateOrderStatusAction(prev, formData);
      if (result.success) setSelected("");
      return result;
    },
    null
  );
  const errors = fieldErrorsOf(state);
  const isCorrection = moves.find((move) => move.status === selected)?.kind === "CORRECTION";

  if (moves.length === 0) {
    return <p className="text-body-sm text-muted-foreground">This order is cancelled; its status can&apos;t change.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <FormError state={state} />
      <FormSuccess state={state} message="Order status updated." />
      <SelectField
        label="Change status to"
        name="status"
        className="w-full"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        errors={errors.status}
      >
        <option value="" disabled>
          Choose a status…
        </option>
        <optgroup label="Move forward">
          {moves
            .filter((move) => move.kind === "FORWARD")
            .map((move) => (
              <option key={move.status} value={move.status}>
                {ORDER_STATUS_LABELS[move.status]}
              </option>
            ))}
        </optgroup>
        {moves.some((move) => move.kind === "CORRECTION") ? (
          <optgroup label="Correct a mistake (one step back)">
            {moves
              .filter((move) => move.kind === "CORRECTION")
              .map((move) => (
                <option key={move.status} value={move.status}>
                  Back to {ORDER_STATUS_LABELS[move.status]}
                </option>
              ))}
          </optgroup>
        ) : null}
      </SelectField>
      {isCorrection ? (
        <TextareaField
          label="Reason for the correction"
          name="reason"
          rows={2}
          maxLength={500}
          required
          hint="Required when moving an order back. Saved in the audit log."
          errors={errors.reason}
        />
      ) : null}
      <SubmitButton fullWidth={false} size="default" className="self-start" pendingLabel="Updating…">
        Update status
      </SubmitButton>
    </form>
  );
}
