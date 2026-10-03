// Pure payment rules (no I/O) — unit tested.

/** Naira → kobo (Paystack amounts are in the lowest currency unit). */
export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

export type VerificationClass = "SUCCESS" | "PENDING" | "UNSUCCESSFUL" | "REFERENCE_MISMATCH";

/**
 * Interprets Paystack's verify response. Amount and currency are checked
 * against the server amount inside the database (confirm_payment_order).
 */
export function classifyVerification(
  verified: { status: string; reference: string },
  expectedReference: string
): VerificationClass {
  if (verified.reference !== expectedReference) return "REFERENCE_MISMATCH";
  switch (verified.status) {
    case "success":
      return "SUCCESS";
    case "failed":
    case "abandoned":
    case "reversed":
      return "UNSUCCESSFUL";
    default:
      // pending, ongoing, processing, queued, … — not final yet.
      return "PENDING";
  }
}

/** Paystack transaction references we issue: SAMY-<32 hex>. */
export function isOurReference(value: unknown): value is string {
  return typeof value === "string" && /^SAMY-[0-9A-F]{32}$/.test(value);
}
