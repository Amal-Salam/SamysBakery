import { useState } from "react";
import { View } from "react-native";

import { Button, Field, Notice } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Address } from "@/lib/types";
import { hasErrors, validateAddress, type AddressInput, type FieldErrors } from "@/lib/validation";
import { space } from "@/theme";

const EMPTY: AddressInput = { label: "", recipientName: "", phone: "", addressLine: "", city: "", state: "", additionalInfo: "" };

function fromAddress(address: Address | null | undefined): AddressInput {
  if (!address) return EMPTY;
  return {
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine: address.addressLine,
    city: address.city,
    state: address.state,
    additionalInfo: address.additionalInfo ?? "",
  };
}

/** Add or edit an address (same fields and rules as the website). The server decides. */
export function AddressForm({ address, onSaved }: { address?: Address | null; onSaved: () => void }) {
  const [values, setValues] = useState<AddressInput>(() => fromAddress(address));
  const [errors, setErrors] = useState<FieldErrors<keyof AddressInput>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof AddressInput) => (text: string) => setValues((current) => ({ ...current, [key]: text }));

  async function save() {
    const next = validateAddress(values);
    setErrors(next);
    if (hasErrors(next)) return;
    setBusy(true);
    setProblem(null);
    try {
      if (address) await api(`/addresses/${address.id}`, { method: "PATCH", body: values });
      else await api("/addresses", { method: "POST", body: values });
      onSaved();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't save the address. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Field label="Label" placeholder="e.g. Home, Office" value={values.label} onChangeText={set("label")} maxLength={50} error={errors.label} />
      <Field label="Recipient's name" value={values.recipientName} onChangeText={set("recipientName")} autoComplete="name" maxLength={120} error={errors.recipientName} />
      <Field label="Phone number" value={values.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" maxLength={30} error={errors.phone} />
      <Field label="Street address" value={values.addressLine} onChangeText={set("addressLine")} autoComplete="street-address" maxLength={300} error={errors.addressLine} />
      <Field label="City" value={values.city} onChangeText={set("city")} autoComplete="postal-address-locality" maxLength={100} error={errors.city} />
      <Field label="State" value={values.state} onChangeText={set("state")} autoComplete="postal-address-region" maxLength={100} error={errors.state} />
      <Field
        label="Landmark or extra directions (optional)"
        value={values.additionalInfo}
        onChangeText={set("additionalInfo")}
        maxLength={500}
        multiline
        error={errors.additionalInfo}
      />
      <Button label={address ? "Save address" : "Add address"} onPress={save} loading={busy} />
    </View>
  );
}
