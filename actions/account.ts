"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/features/customers/addresses";
import { deleteMyAccount, updateProfile } from "@/features/customers/profile";
import { fail, ok, toFailure, validationFailure } from "@/lib/errors";
import { assertUser } from "@/lib/security/auth";
import { addressInputSchema } from "@/schemas/address";
import { uuidSchema } from "@/schemas/product";
import { DELETE_CONFIRMATION_PHRASE, profileInputSchema } from "@/schemas/profile";
import type { ActionResult } from "@/types/api";

// Customer self-service. Each action authenticates; RLS and SECURITY INVOKER
// functions guarantee customers can only touch their own data.

function addressFields(formData: FormData) {
  return {
    label: formData.get("label") ?? "",
    recipientName: formData.get("recipientName") ?? "",
    phone: formData.get("phone") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    additionalInfo: formData.get("additionalInfo") ?? "",
  };
}

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const parsed = profileInputSchema.safeParse({
      fullName: formData.get("fullName") ?? "",
      phone: formData.get("phone") ?? "",
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await updateProfile(user.id, parsed.data);
    revalidatePath("/account", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function createAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const parsed = addressInputSchema.safeParse(addressFields(formData));
    if (!parsed.success) return validationFailure(parsed.error);
    await createAddress(user.id, parsed.data);
    revalidatePath("/account/addresses");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function updateAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertUser();
    const id = uuidSchema.safeParse(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid address.");
    const parsed = addressInputSchema.safeParse(addressFields(formData));
    if (!parsed.success) return validationFailure(parsed.error);
    await updateAddress(id.data, parsed.data);
    revalidatePath("/account/addresses");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function deleteAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertUser();
    const id = uuidSchema.safeParse(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid address.");
    await deleteAddress(id.data);
    revalidatePath("/account/addresses");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function setDefaultAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertUser();
    const id = uuidSchema.safeParse(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid address.");
    await setDefaultAddress(id.data);
    revalidatePath("/account/addresses");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertUser();
    if (String(formData.get("confirmation") ?? "").trim() !== DELETE_CONFIRMATION_PHRASE) {
      const message = `Type ${DELETE_CONFIRMATION_PHRASE} to confirm.`;
      return fail("VALIDATION_ERROR", message, { confirmation: [message] });
    }
    await deleteMyAccount();
  } catch (error) {
    return toFailure(error);
  }
  revalidatePath("/", "layout");
  redirect("/?account=deleted");
}
