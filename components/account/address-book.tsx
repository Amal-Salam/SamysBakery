"use client";

import { useActionState, useRef } from "react";

import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/actions/account";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { FormError, FormSuccess, SubmitButton } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import type { Address } from "@/features/customers/addresses";
import type { ActionResult } from "@/types/api";

import { AddressFields } from "./address-fields";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  return (
    <div className="flex flex-col gap-8">
      {addresses.length === 0 ? (
        <EmptyState title="No saved addresses yet." description="Add one below, or save a new address at checkout." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Saved addresses">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </ul>
      )}
      <AddAddress />
    </div>
  );
}

function AddressCard({ address }: { address: Address }) {
  const [editState, editAction] = useActionState(updateAddressAction, null);
  const [defaultState, defaultAction] = useActionState(setDefaultAddressAction, null);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{address.label}</p>
        {address.isDefault ? <Badge>Default</Badge> : null}
      </div>
      <address className="text-body-sm not-italic">
        {address.recipientName} · {address.phone}
        <br />
        {[address.addressLine, address.city, address.state].join(", ")}
        {address.additionalInfo ? (
          <>
            <br />
            <span className="text-muted-foreground">{address.additionalInfo}</span>
          </>
        ) : null}
      </address>
      <FormError state={defaultState} />
      <div className="flex flex-wrap items-center gap-2">
        {!address.isDefault ? (
          <form action={defaultAction}>
            <input type="hidden" name="id" value={address.id} />
            <SubmitButton variant="outline" size="sm" fullWidth={false} pendingLabel="Saving…">
              Make default
            </SubmitButton>
          </form>
        ) : null}
        <ConfirmActionDialog
          trigger="Delete"
          triggerSize="sm"
          title={`Delete the “${address.label}” address?`}
          description={
            <p>
              {address.isDefault
                ? "Your most recently added remaining address will become your default."
                : "Past orders keep their own copy of the delivery address."}
            </p>
          }
          confirmLabel="Delete address"
          pendingLabel="Deleting…"
          action={deleteAddressAction}
          fields={{ id: address.id }}
        />
      </div>
      <details className="rounded-md border border-border">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 text-body-sm font-medium">
          Edit {address.label}
        </summary>
        <form action={editAction} className="flex flex-col gap-4 border-t border-border p-4" noValidate>
          <input type="hidden" name="id" value={address.id} />
          <FormError state={editState} />
          <FormSuccess state={editState} message="Address saved." />
          <AddressFields address={address} state={editState} />
          <SubmitButton fullWidth={false} className="self-start" pendingLabel="Saving…">
            Save address
          </SubmitButton>
        </form>
      </details>
    </li>
  );
}

function AddAddress() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await createAddressAction(prev, formData);
      if (result.success) formRef.current?.reset();
      return result;
    },
    null
  );
  return (
    <section aria-labelledby="add-address-heading" className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4">
      <h2 id="add-address-heading" className="text-heading-3 text-primary">
        Add an address
      </h2>
      <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <FormSuccess state={state} message="Address saved." />
        <AddressFields state={state} />
        <SubmitButton fullWidth={false} className="self-start" pendingLabel="Saving…">
          Save address
        </SubmitButton>
      </form>
    </section>
  );
}
