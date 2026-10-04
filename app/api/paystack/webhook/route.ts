import { NextResponse, type NextRequest } from "next/server";

import { handleRefundEvent } from "@/features/payments/refunds";
import { processPayment } from "@/features/payments/service";
import { isOurReference } from "@/features/payments/rules";
import { getPaystackEnv } from "@/lib/env.server";
import { isValidPaystackSignature } from "@/lib/paystack/webhook";
import { clientIpFrom, consumeRateLimits, RATE_LIMITS } from "@/lib/security/rate-limit";

// POST /api/paystack/webhook — public, authenticated by Paystack's signature
// (not by a user session). API contract §15–16.
export const dynamic = "force-dynamic";

/** Paystack events are a few KB; anything far larger is not from Paystack. */
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  // 0. Cheap rejections before any work: per-IP rate limit and body size.
  const ip = clientIpFrom(request.headers);
  if (!(await consumeRateLimits([{ bucket: "paystack_webhook_ip", subject: ip, ...RATE_LIMITS.webhookPerIp }]))) {
    return NextResponse.json({ received: false }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ received: false }, { status: 413 });
  }

  // 1. Raw body (the signature covers the exact bytes Paystack sent).
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ received: false }, { status: 413 });
  }

  // 2–3. Validate signature; reject before doing any work.
  const { PAYSTACK_SECRET_KEY } = getPaystackEnv();
  if (!isValidPaystackSignature(rawBody, request.headers.get("x-paystack-signature"), PAYSTACK_SECRET_KEY)) {
    return NextResponse.json({ received: false }, { status: 401 });
  }

  // 4. Parse event.
  let event: {
    event?: unknown;
    data?: { reference?: unknown; transaction_reference?: unknown; transaction?: { reference?: unknown } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  // Refund events (owner decision): identify our payment, then verify the
  // refund's status with Paystack's API rather than trusting the event body.
  if (typeof event.event === "string" && event.event.startsWith("refund.")) {
    const paymentReference = event.data?.transaction_reference ?? event.data?.transaction?.reference;
    if (isOurReference(paymentReference)) await handleRefundEvent(paymentReference);
    return NextResponse.json({ received: true });
  }

  // Everything else except successful charges is acknowledged and ignored.
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  // 5. Identify the transaction (only references we issued).
  const reference = event.data?.reference;
  if (!isOurReference(reference)) {
    return NextResponse.json({ received: true });
  }

  // 6–8. Verify with Paystack, idempotency, order transaction.
  const outcome = await processPayment(reference);
  if (outcome.kind === "VERIFICATION_UNAVAILABLE") {
    // Ask Paystack to retry later.
    return NextResponse.json({ received: false }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
