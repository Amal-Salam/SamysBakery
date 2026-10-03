import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AddressInput } from "@/schemas/address";

// Customer address book. Runs as the signed-in customer, so RLS limits every
// read and write to their own addresses.

export type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  additionalInfo: string | null;
  isDefault: boolean;
};

const SELECT = "id, label, recipient_name, phone, address_line, city, state, additional_info, is_default";

type Row = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  additional_info: string | null;
  is_default: boolean;
};

const toAddress = (row: Row): Address => ({
  id: row.id,
  label: row.label,
  recipientName: row.recipient_name,
  phone: row.phone,
  addressLine: row.address_line,
  city: row.city,
  state: row.state,
  additionalInfo: row.additional_info,
  isDefault: row.is_default,
});

/** Default first, then most recent. */
export async function listAddresses(): Promise<Address[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("addresses")
    .select(SELECT)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return data.map(toAddress);
}

export async function getAddress(id: string): Promise<Address | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("addresses").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toAddress(data) : null;
}

/** Saves a new address. The customer's first address becomes their default. */
export async function createAddress(userId: string, input: AddressInput): Promise<Address> {
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("is_default", true);
  if (countError) throw fromDbError(countError);

  const row = {
    user_id: userId,
    label: input.label,
    recipient_name: input.recipientName,
    phone: input.phone,
    address_line: input.addressLine,
    city: input.city,
    state: input.state,
    additional_info: input.additionalInfo,
  };
  let result = await supabase
    .from("addresses")
    .insert({ ...row, is_default: (count ?? 0) === 0 })
    .select(SELECT)
    .single();
  // A default was created concurrently: save this one as non-default.
  if (result.error?.code === "23505") {
    result = await supabase.from("addresses").insert({ ...row, is_default: false }).select(SELECT).single();
  }
  if (result.error) throw fromDbError(result.error);
  return toAddress(result.data);
}

export async function setDefaultAddress(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_default_address", { target_address_id: id });
  if (error) throw fromDbError(error, { P0002: "That address could not be found." });
}

/** Deleting the default promotes the most recently added remaining address (owner decision). */
export async function deleteAddress(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_address", { target_address_id: id });
  if (error) throw fromDbError(error, { P0002: "That address could not be found." });
}

export function formatAddress(address: Pick<Address, "addressLine" | "city" | "state">): string {
  return [address.addressLine, address.city, address.state].filter(Boolean).join(", ");
}

export function assertAddressOwned(address: Address | null): Address {
  if (!address) throw new AppError("NOT_FOUND", "That address could not be found.");
  return address;
}

export async function updateAddress(id: string, input: AddressInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: input.label,
      recipient_name: input.recipientName,
      phone: input.phone,
      address_line: input.addressLine,
      city: input.city,
      state: input.state,
      additional_info: input.additionalInfo,
    })
    .eq("id", id)
    .select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That address could not be found.");
}
