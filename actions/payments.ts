"use server";

import { redirect } from "next/navigation";

import { startPayment } from "@/features/payments/service";
import { fail, toFailure } from "@/lib/errors";
import { prepareCheckoutSchema } from "@/schemas/checkout";
import type { ActionResult } from "@/types/api";

/**
 * "Pay with Paystack": validates input, then the server reserves stock,
 * calculates the amount and initializes Paystack. The browser sends no amount.
 */
export async function startPaymentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = prepareCheckoutSchema.safeParse({
    deliveryDate: formData.get("deliveryDate") ?? "",
    addressId: formData.get("addressId") || undefined,
    specialNotes: formData.get("specialNotes") ?? "",
  });
  if (!parsed.success || !parsed.data.addressId) {
    return fail("CHECKOUT_INVALID", "Please review your delivery details and try again.");
  }

  let authorizationUrl: string;
  try {
    ({ authorizationUrl } = await startPayment({
      deliveryDate: parsed.data.deliveryDate,
      addressId: parsed.data.addressId,
      specialNotes: parsed.data.specialNotes,
    }));
  } catch (error) {
    return toFailure(error);
  }
  // Redirect flow (owner decision): continue on Paystack's hosted checkout.
  redirect(authorizationUrl);
}
