import "server-only";

import { createHash } from "node:crypto";

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

const RESEND_DEFAULT_BASE = "https://api.resend.com";

const resendEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  // e.g. "Samy's Bakery <orders@your-verified-domain.com>"
  RESEND_FROM_EMAIL: z.string().min(3),
  RESEND_API_BASE: z
    .string()
    .default(RESEND_DEFAULT_BASE)
    .refine(
      (value) => value === RESEND_DEFAULT_BASE || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value),
      "must be https://api.resend.com (or a localhost mock in tests)"
    ),
});

/** Null when email isn't configured; the caller logs and skips (orders never depend on email). */
export function getResendEnv() {
  const parsed = resendEnvSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_API_BASE: process.env.RESEND_API_BASE || undefined,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Key for hashing rate-limit subjects (IPs, emails), derived from an existing
 * server secret so no extra variable is needed and raw values never reach the
 * database. Not the service-role key itself.
 */
export function getRateLimitHashKey(): string {
  return createHash("sha256").update(`samys-rate-limit:${getServerEnv().SUPABASE_SERVICE_ROLE_KEY}`).digest("hex");
}

// Google sign-in on our own domain (owner decision, G1). The client secret is
// server-only. GOOGLE_OAUTH_BASE exists only for automated tests (a localhost
// mock); production always uses Google's real endpoints.
const googleEnvSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_BASE: z
    .string()
    .regex(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "must be a localhost mock (tests only)")
    .optional(),
});

/** Google sign-in settings, or null when not configured (sign-in then reports unavailable). */
export function getGoogleEnv() {
  const parsed = googleEnvSchema.safeParse({
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_BASE: process.env.GOOGLE_OAUTH_BASE || undefined,
  });
  if (!parsed.success) return null;
  const base = parsed.data.GOOGLE_OAUTH_BASE;
  return {
    clientId: parsed.data.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_OAUTH_CLIENT_SECRET,
    authorizeUrl: base ? `${base}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: base ? `${base}/token` : "https://oauth2.googleapis.com/token",
  };
}
