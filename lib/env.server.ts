import "server-only";

import { z } from "zod";

// Server-only secrets. Read lazily so a missing secret fails the operation that
// needs it with a clear configuration error, without leaking its value.
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Invalid or missing server environment configuration: ${missing.join(", ")}`
    );
  }
  return parsed.data;
}

const PAYSTACK_DEFAULT_BASE = "https://api.paystack.co";

const paystackEnvSchema = z.object({
  PAYSTACK_SECRET_KEY: z.string().regex(/^sk_(test|live)_[A-Za-z0-9_]+$/, "must be a Paystack secret key"),
  // Only the real Paystack API, or a local mock for automated tests.
  PAYSTACK_API_BASE: z
    .string()
    .default(PAYSTACK_DEFAULT_BASE)
    .refine(
      (value) => value === PAYSTACK_DEFAULT_BASE || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value),
      "must be https://api.paystack.co (or a localhost mock in tests)"
    ),
});

export function getPaystackEnv() {
  const parsed = paystackEnvSchema.safeParse({
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_API_BASE: process.env.PAYSTACK_API_BASE || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Invalid or missing Paystack configuration: ${fields.join(", ")}`);
  }
  return parsed.data;
}
