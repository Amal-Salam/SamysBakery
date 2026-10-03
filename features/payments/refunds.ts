import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import { createRefund, fetchRefund } from "@/lib/paystack/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { toKobo } from "./rules";

// Cancellation and refunds are separate operations (AGENTS.md §29–30).
// Refunds are reconciled from Paystack (owner decision): signed refund
// webhooks and the admin "Check refund status" both fetch the refund from
// Paystack's API; only "processed" marks it REFUNDED.

const CANCEL_ERRORS: Record<string, { code: "ORDER_NOT_CANCELLABLE" | "NOT_FOUND" | "VALIDATION_ERROR"; message: string }> = {
  ORDER_NOT_CANCELLABLE: {
    code: "ORDER_NOT_CANCELLABLE",
    message: "This order can no longer be cancelled. Orders can be cancelled only before they're ready.",
  },
  NOT_FOUND: { code: "NOT_FOUND", message: "That order could not be found." },
  REASON_TOO_LONG: { code: "VALIDATION_ERROR", message: "The reason is too long (500 characters at most)." },
};

/** Customer (own order) or admin. Releases the reserved stock; never refunds. */
export async function cancelOrder(orderNumber: string, reason: string | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_order", { target_order_number: orderNumber, reason: reason as string });
  if (error) {
    const known = CANCEL_ERRORS[error.message];
    if (known) throw new AppError(known.code, known.message);
    throw fromDbError(error);
  }
}

const REFUND_ERRORS: Record<string, string> = {
  ORDER_NOT_CANCELLED: "Cancel the order before refunding it.",
  NOT_REFUNDABLE: "This order has no completed payment to refund.",
  ALREADY_REFUNDED: "This order has already been refunded.",
  REFUND_IN_PROGRESS: "A refund for this order is already in progress. Use \"Check refund status\" for an update.",
  NOT_FOUND: "That order could not be found.",
};

/** Admin-initiated full refund of a cancelled order. Never claims REFUNDED on request. */
export async function requestRefund(orderNumber: string): Promise<{ providerStatus: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("request_refund", { target_order_number: orderNumber });
  if (error) {
    const message = REFUND_ERRORS[error.message];
    if (message) throw new AppError(error.message === "NOT_FOUND" ? "NOT_FOUND" : "REFUND_FAILED", message);
    throw fromDbError(error);
  }
  const request = data as unknown as { refund_id: string; payment_reference: string; amount: number };

  const admin = createSupabaseAdminClient();
  try {
    const result = await createRefund({
      transactionReference: request.payment_reference,
      amountKobo: toKobo(Number(request.amount)),
    });
    await admin.rpc("record_refund_request", {
      target_refund_id: request.refund_id,
      provider_refund_id: result.refundId,
      provider_status: result.status,
    });
    // Paystack can occasionally process immediately.
    if (result.status === "processed") {
      await admin.rpc("apply_refund_status", { target_refund_id: request.refund_id, reported_status: "processed" });
    }
    return { providerStatus: result.status };
  } catch {
    await admin.rpc("record_refund_request", {
      target_refund_id: request.refund_id,
      provider_refund_id: null as unknown as string,
      provider_status: "request_failed",
    });
    console.error("[refunds] Paystack refund request failed", orderNumber);
    throw new AppError("REFUND_FAILED", "Paystack didn't accept the refund request. Please try again.");
  }
}

/** Fetches the refund's real status from Paystack and records it. */
export async function syncRefundStatus(refundId: string): Promise<"REFUNDED" | "NOT_REFUNDED" | "UNKNOWN"> {
  const admin = createSupabaseAdminClient();
  const { data: refund } = await admin.from("refunds").select("paystack_refund_id, status").eq("id", refundId).single();
  if (!refund) return "UNKNOWN";
  if (refund.status === "REFUNDED") return "REFUNDED";
  if (!refund.paystack_refund_id) return "NOT_REFUNDED";

  let provider;
  try {
    provider = await fetchRefund(refund.paystack_refund_id);
  } catch {
    return "UNKNOWN";
  }
  const { data, error } = await admin.rpc("apply_refund_status", {
    target_refund_id: refundId,
    reported_status: provider.status,
  });
  if (error) throw fromDbError(error);
  return data as "REFUNDED" | "NOT_REFUNDED";
}

/** Admin "Check refund status" for an order. */
export async function checkOrderRefundStatus(orderNumber: string) {
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
  if (!order) throw new AppError("NOT_FOUND", "That order could not be found.");
  const { data: refund } = await admin.from("refunds").select("id").eq("order_id", order.id).maybeSingle();
  if (!refund) throw new AppError("NOT_FOUND", "No refund has been requested for this order.");
  const result = await syncRefundStatus(refund.id);
  if (result === "UNKNOWN") throw new AppError("REFUND_FAILED", "Paystack couldn't be reached. Please try again shortly.");
  return result;
}

/** Signed refund webhook: identify by OUR payment reference, then verify with Paystack. */
export async function handleRefundEvent(paymentReference: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin.from("payments").select("id").eq("reference", paymentReference).maybeSingle();
  if (!payment) return;
  const { data: refund } = await admin.from("refunds").select("id").eq("payment_id", payment.id).maybeSingle();
  if (!refund) return;
  await syncRefundStatus(refund.id);
}
