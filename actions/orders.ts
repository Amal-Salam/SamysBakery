"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cancelOrder } from "@/features/payments/refunds";
import { fail, ok, toFailure } from "@/lib/errors";
import { assertUser } from "@/lib/security/auth";
import type { ActionResult } from "@/types/api";

const orderNumberSchema = z.string().regex(/^SAM-\d{4,}$/);

/** Customer cancels their own eligible order (ownership enforced in the database). */
export async function cancelMyOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertUser();
    const orderNumber = orderNumberSchema.safeParse(formData.get("orderNumber"));
    if (!orderNumber.success) return fail("VALIDATION_ERROR", "Invalid order.");
    await cancelOrder(orderNumber.data, null);
    revalidatePath("/account", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}
