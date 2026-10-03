"use client";

import { FormField, fieldErrorsOf } from "@/components/ui/form";
import type { Address } from "@/features/customers/addresses";
import type { ActionResult } from "@/types/api";

/** Address inputs shared by the add and edit forms. */
export function AddressFields({ address, state }: { address?: Address; state: ActionResult | null }) {
  const errors = fieldErrorsOf(state);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Label" name="label" placeholder="e.g. Home, Office" maxLength={50} defaultValue={address?.label} errors={errors.label} />
      <FormField label="Recipient's name" name="recipientName" autoComplete="name" maxLength={120} defaultValue={address?.recipientName} errors={errors.recipientName} />
      <FormField label="Phone number" name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={address?.phone} errors={errors.phone} />
      <FormField label="City" name="city" autoComplete="address-level2" maxLength={100} defaultValue={address?.city} errors={errors.city} />
      <div className="sm:col-span-2">
        <FormField label="Street address" name="addressLine" autoComplete="street-address" maxLength={300} defaultValue={address?.addressLine} errors={errors.addressLine} />
      </div>
      <FormField label="State" name="state" autoComplete="address-level1" maxLength={100} defaultValue={address?.state} errors={errors.state} />
      <FormField label="Landmark or extra directions (optional)" name="additionalInfo" maxLength={500} defaultValue={address?.additionalInfo ?? ""} errors={errors.additionalInfo} />
    </div>
  );
}
