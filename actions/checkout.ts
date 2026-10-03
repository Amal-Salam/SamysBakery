"use server";

import { revalidatePath } from "next/cache";

import { prepareCheckout, type CheckoutSummary } from "@/features/checkout/service";
import { ok, toFailure, validationFailure } from "@/lib/errors";
import { prepareCheckoutSchema } from "@/schemas/checkout";
import type { ActionResult } from "@/types/api";

/**
 * Validates the Delivery step and returns the authoritative Review summary.
 * Request → Authentication (in prepareCheckout) → Zod → business rules → result.
 */
export async function prepareCheckoutAction(
  _prev: ActionResult<CheckoutSummary> | null,
  formData: FormData
): Promise<ActionResult<CheckoutSummary>> {
  const addressChoice = formData.get("addressChoice");
  const parsed = prepareCheckoutSchema.safeParse({
    deliveryDate: formData.get("deliveryDate") ?? "",
    addressId: addressChoice && addressChoice !== "new" ? addressChoice : undefined,
    newAddress:
      addressChoice === "new"
        ? {
            label: formData.get("label") ?? "",
            recipientName: formData.get("recipientName") ?? "",
            phone: formData.get("phone") ?? "",
            addressLine: formData.get("addressLine") ?? "",
            city: formData.get("city") ?? "",
            state: formData.get("state") ?? "",
            additionalInfo: formData.get("additionalInfo") ?? "",
          }
        : undefined,
    specialNotes: formData.get("specialNotes") ?? "",
  });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const summary = await prepareCheckout(parsed.data);
    if (parsed.data.newAddress) revalidatePath("/checkout");
    return ok(summary);
  } catch (error) {
    return toFailure(error);
  }
}
