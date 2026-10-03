"use client";

import { useActionState, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormError, SubmitButton } from "@/components/ui/form";
import type { ActionResult } from "@/types/api";

type Props = {
  trigger: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /** Hidden form fields sent with the confirmed action. */
  fields: Record<string, string>;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
};

/** Destructive action behind an explicit, accessible confirmation step. */
export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  fields,
  triggerVariant = "destructive",
  triggerSize = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    null
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} className="w-fit">
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-body-sm">{description}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormError state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton
              variant="destructive"
              size="default"
              fullWidth={false}
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
