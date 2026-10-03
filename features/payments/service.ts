import "server-only";

import { after } from "next/server";

import { releaseReservation, reserveCheckout } from "@/features/inventory/service";
import { sendOrderConfirmationOnce } from "@/features/notifications/order-confirmation";
import { publicEnv } from "@/lib/env";
import { AppError, fromDbError } from "@/lib/errors";
import { createRefund, initializeTransaction, PaystackError, verifyTransaction } from "@/lib/paystack/client";
import { assertUser } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { classifyVerification, toKobo } from "./rules";

// Payment flow (API contract §13–18):
//   prepare → reserve stock (DB) → initialize Paystack → customer pays on
//   Paystack → webhook AND return page both call processPayment() → verify with
//   Paystack → confirm_payment_order() (idempotent, DB transaction).
// The browser's word is never taken for success, amount or reference.

const PAYMENT_STARTS_PER_WINDOW = 10;
const PAYMENT_WINDOW_SECONDS = 15 * 60;

/** Server-side Paystack initialization. Returns the hosted checkout URL (redirect flow). */
export async function startPayment(input: {
  deliveryDate: string;
  addressId: string;
  specialNotes: string | null;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const user = await assertUser();

  // Rate limit payment starts per customer (owner decision: Postgres-based).
  const supabase = await createSupabaseServerClient();
  const { data: allowed, error: limitError } = await supabase.rpc("consume_rate_limit", {
    bucket: "payment_init",
    max_hits: PAYMENT_STARTS_PER_WINDOW,
    window_seconds: PAYMENT_WINDOW_SECONDS,
  });
  if (limitError) throw fromDbError(limitError);
  if (!allowed) {
    throw new AppError("PAYMENT_FAILED", "Too many payment attempts. Please wait a few minutes and try again.");
  }

  // Validate + hold stock + create the PENDING payment with a DB-derived amount.
  const context = await reserveCheckout(input);

  try {
    return await initializeTransaction({
      email: user.email,
      amountKobo: toKobo(context.amount),
      reference: context.reference,
      callbackUrl: new URL("/checkout/complete", publicEnv.NEXT_PUBLIC_APP_URL).toString(),
    });
  } catch (error) {
    // No Paystack transaction: free the stock immediately.
    await releaseReservation(context.paymentId).catch(() => undefined);
    console.error("[payments] initialization failed", error instanceof PaystackError ? error.httpStatus : "unknown");
    throw new AppError("PAYMENT_FAILED", "We couldn't start the payment. Please try again.");
  }
}

export type PaymentOutcome =
  | { kind: "CONFIRMED"; orderNumber: string; userId: string | null }
  | { kind: "PENDING" }
  | { kind: "FAILED" }
  | { kind: "REFUNDED_LATE"; userId: string | null }
  | { kind: "REJECTED"; reason: "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "REFERENCE_MISMATCH" }
  | { kind: "UNKNOWN_REFERENCE" }
  | { kind: "VERIFICATION_UNAVAILABLE" };

type ConfirmResult = {
  outcome:
    | "CREATED"
    | "ALREADY_PROCESSED"
    | "REFUND_REQUIRED"
    | "REFUND_ALREADY_REQUESTED"
    | "AMOUNT_MISMATCH"
    | "CURRENCY_MISMATCH"
    | "UNKNOWN_REFERENCE";
  order_id?: string;
  order_number?: string;
  user_id?: string;
  refund_id?: string;
  amount?: number;
};

/**
 * Verifies a transaction with Paystack and applies the result exactly once.
 * Safe to call repeatedly and concurrently (webhook retries, refreshes, the
 * webhook and the return page together).
 */
export async function processPayment(reference: string): Promise<PaymentOutcome> {
  const admin = createSupabaseAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .select("id, reference, amount, status, order_id, user_id")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!payment) return { kind: "UNKNOWN_REFERENCE" };

  // Fast path: already an order (no need to call Paystack again).
  if (payment.order_id) {
    const { data: order } = await admin.from("orders").select("order_number").eq("id", payment.order_id).single();
    scheduleConfirmationEmail(payment.order_id);
    return { kind: "CONFIRMED", orderNumber: order!.order_number, userId: payment.user_id };
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    console.error("[payments] verification unavailable", reference);
    return { kind: "VERIFICATION_UNAVAILABLE" };
  }

  const classification = classifyVerification(verified, reference);
  if (classification === "REFERENCE_MISMATCH") {
    console.error("[payments] reference mismatch", reference);
    return { kind: "REJECTED", reason: "REFERENCE_MISMATCH" };
  }
  if (classification === "PENDING") return { kind: "PENDING" };
  if (classification === "UNSUCCESSFUL") {
    const { error: failError } = await admin.rpc("fail_payment", {
      payment_reference: reference,
      provider_status: verified.status,
    });
    if (failError) throw fromDbError(failError);
    return { kind: "FAILED" };
  }

  // Paystack says success: the database checks amount/currency/lateness and
  // creates the order atomically and idempotently.
  const { data, error: confirmError } = await admin.rpc("confirm_payment_order", {
    payment_reference: reference,
    verified_amount_kobo: verified.amountKobo,
    verified_currency: verified.currency,
    verified_paid_at: verified.paidAt ?? new Date().toISOString(),
    provider_transaction_id: verified.transactionId,
  });
  if (confirmError) throw fromDbError(confirmError);
  const result = data as unknown as ConfirmResult;

  switch (result.outcome) {
    case "CREATED":
    case "ALREADY_PROCESSED":
      scheduleConfirmationEmail(result.order_id!);
      return { kind: "CONFIRMED", orderNumber: result.order_number!, userId: result.user_id! };
    case "REFUND_REQUIRED":
    case "REFUND_ALREADY_REQUESTED":
      await requestLateRefund(reference, result.refund_id!);
      return { kind: "REFUNDED_LATE", userId: result.user_id! };
    case "AMOUNT_MISMATCH":
    case "CURRENCY_MISMATCH":
      console.error("[payments] verification mismatch", result.outcome, reference);
      return { kind: "REJECTED", reason: result.outcome };
    default:
      return { kind: "UNKNOWN_REFERENCE" };
  }
}

/**
 * Sends the confirmation email after the response (never delays the customer's
 * redirect or Paystack's acknowledgement). Exactly-once and retry-safe: the
 * database claim ignores repeats, and an earlier failed send is retried here.
 */
function scheduleConfirmationEmail(orderId: string) {
  after(async () => {
    await sendOrderConfirmationOnce(orderId);
  });
}

/**
 * Asks Paystack to refund a refused late payment (owner decision: automatic).
 * Idempotent: a refund already sent to Paystack is not requested again.
 * The refund stays NOT_REFUNDED until Paystack confirms it (Milestone 14).
 */
async function requestLateRefund(reference: string, refundId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: refund } = await admin
    .from("refunds")
    .select("paystack_refund_id, amount")
    .eq("id", refundId)
    .single();
  if (!refund || refund.paystack_refund_id) return;

  try {
    const result = await createRefund({ transactionReference: reference, amountKobo: toKobo(Number(refund.amount)) });
    await admin.rpc("record_refund_request", {
      target_refund_id: refundId,
      provider_refund_id: result.refundId,
      provider_status: result.status,
    });
  } catch {
    // Recorded so it can be retried (next webhook/return, or by an admin).
    await admin.rpc("record_refund_request", {
      target_refund_id: refundId,
      provider_refund_id: null as unknown as string,
      provider_status: "request_failed",
    });
    console.error("[payments] late-payment refund request failed", reference);
  }
}
