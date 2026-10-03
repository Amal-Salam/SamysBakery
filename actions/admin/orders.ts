"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateOrderStatus } from "@/features/orders/admin";
import { cancelOrder, checkOrderRefundStatus, requestRefund } from "@/features/payments/refunds";
import { fail, ok, toFailure, validationFailure } from "@/lib/errors";
import { assertAdmin } from "@/lib/security/auth";
import type { ActionResult } from "@/types/api";

const statusSchema = z.object({
  orderNumber: z.string().regex(/^SAM-\d{4,}$/, "Invalid order."),
  status: z.enum(["PAID", "RECEIVED", "BAKING", "READY", "HANDED_TO_DELIVERY", "DELIVERED"], "Choose a status."),
  reason: z
    .string()
    .trim()
    .max(500, "The reason is too long.")
    .transform((value) => value || null),
});

export async function updateOrderStatusAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = statusSchema.safeParse({
      orderNumber: formData.get("orderNumber"),
      status: formData.get("status"),
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await updateOrderStatus(parsed.data.orderNumber, parsed.data.status, parsed.data.reason);
    revalidatePath("/admin/orders", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

const orderNumberSchema = z.string().regex(/^SAM-\d{4,}$/, "Invalid order.");

export async function adminCancelOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const orderNumber = orderNumberSchema.safeParse(formData.get("orderNumber"));
    if (!orderNumber.success) return validationFailure(orderNumber.error);
    const reason = String(formData.get("reason") ?? "").trim() || null;
    await cancelOrder(orderNumber.data, reason);
    revalidatePath("/admin/orders", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function requestRefundAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const orderNumber = orderNumberSchema.safeParse(formData.get("orderNumber"));
    if (!orderNumber.success) return validationFailure(orderNumber.error);
    if (formData.get("confirm") !== "yes") return fail("VALIDATION_ERROR", "Please confirm the refund.");
    await requestRefund(orderNumber.data);
    revalidatePath("/admin/orders", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function checkRefundStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const orderNumber = orderNumberSchema.safeParse(formData.get("orderNumber"));
    if (!orderNumber.success) return validationFailure(orderNumber.error);
    await checkOrderRefundStatus(orderNumber.data);
    revalidatePath("/admin/orders", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}
