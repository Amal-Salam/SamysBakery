import "server-only";

import { z } from "zod";

import { getPaystackEnv } from "@/lib/env.server";

// Paystack REST integration (server only). The rest of the app reasons in
// terms of payments and references; only this module knows Paystack's API.
// Secrets are never logged or returned.

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ status: z.boolean(), message: z.string().optional(), data });

async function paystackRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<z.infer<T>> {
  const { PAYSTACK_SECRET_KEY, PAYSTACK_API_BASE } = getPaystackEnv();
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaystackError("Paystack could not be reached");
  }

  const json: unknown = await response.json().catch(() => null);
  const parsed = envelope(schema).safeParse(json);
  if (!response.ok || !parsed.success || !parsed.data.status) {
    throw new PaystackError(`Paystack request failed (${path.split("/")[1]})`, response.status);
  }
  return (parsed.data as { data: z.infer<T> }).data;
}

// ---------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await paystackRequest(
    "/transaction/initialize",
    z.object({ authorization_url: z.url(), reference: z.string() }),
    {
      method: "POST",
      body: {
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        // Metadata is informational only and is never trusted on the way back.
        metadata: { source: "samys-bakery" },
      },
    }
  );
  if (data.reference !== input.reference) throw new PaystackError("Paystack returned a different reference");
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export type VerifiedTransaction = {
  status: string; // success | failed | abandoned | pending | ongoing | reversed | …
  reference: string;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  transactionId: string;
};

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    z.object({
      status: z.string(),
      reference: z.string(),
      amount: z.number().int(),
      currency: z.string(),
      paid_at: z.string().nullable().optional(),
      paidAt: z.string().nullable().optional(),
      id: z.union([z.number(), z.string()]),
    }),
    { method: "GET" }
  );
  return {
    status: data.status,
    reference: data.reference,
    amountKobo: data.amount,
    currency: data.currency,
    paidAt: data.paid_at ?? data.paidAt ?? null,
    transactionId: String(data.id),
  };
}

// ---------------------------------------------------------------------
// Refunds (full refunds only)
// ---------------------------------------------------------------------

export async function createRefund(input: {
  transactionReference: string;
  amountKobo: number;
}): Promise<{ refundId: string; status: string }> {
  const data = await paystackRequest(
    "/refund",
    z.object({ id: z.union([z.number(), z.string()]), status: z.string() }),
    { method: "POST", body: { transaction: input.transactionReference, amount: input.amountKobo } }
  );
  return { refundId: String(data.id), status: data.status };
}

export async function fetchRefund(refundId: string): Promise<{ status: string; transactionReference: string | null }> {
  const data = await paystackRequest(
    `/refund/${encodeURIComponent(refundId)}`,
    z.object({
      status: z.string(),
      transaction: z.union([z.object({ reference: z.string().optional() }).passthrough(), z.number(), z.string()]).optional(),
    }),
    { method: "GET" }
  );
  const transaction = data.transaction;
  const reference = typeof transaction === "object" && transaction ? (transaction.reference ?? null) : null;
  return { status: data.status, transactionReference: reference };
}
