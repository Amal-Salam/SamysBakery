import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { publicEnv } from "@/lib/env";
import { getRateLimitHashKey } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { clientIpFrom } from "./client-ip";

export { clientIpFrom };

// Rate limits for signed-out, high-risk operations (API contract §37; owner
// decision M18). Server actions call Supabase Auth from our server, so its own
// per-IP limits see a single IP — these limits are per visitor instead.
// Fixed windows in Postgres (consume_public_rate_limit); no extra infrastructure.

export type RateLimitRule = {
  bucket: string;
  /** What the limit is keyed on (IP, email, or both). Hashed before storage. */
  subject: string;
  max: number;
  windowSeconds: number;
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** Owner-approved limits. */
export const RATE_LIMITS = {
  signInPerAccount: { max: 10, windowSeconds: 15 * MINUTE },
  signInPerIp: { max: 30, windowSeconds: 15 * MINUTE },
  adminSignIn: { max: 5, windowSeconds: 15 * MINUTE },
  signUpPerIp: { max: 5, windowSeconds: HOUR },
  passwordResetPerEmail: { max: 3, windowSeconds: HOUR },
  webhookPerIp: { max: 300, windowSeconds: MINUTE },
} as const;

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/** Keyed hash so raw IPs and emails are never stored. */
export function rateLimitSubject(...parts: string[]): string {
  return createHmac("sha256", getRateLimitHashKey())
    .update(parts.map((part) => part.trim().toLowerCase()).join("|"))
    .digest("hex");
}

/**
 * E2E runs sign in hundreds of times from one machine. The bypass works only
 * when the app points at the LOCAL Supabase stack, so it can never weaken a
 * hosted deployment.
 */
function bypassForLocalTests(): boolean {
  const host = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname;
  return process.env.E2E_DISABLE_RATE_LIMITS === "1" && (host === "127.0.0.1" || host === "localhost");
}

/**
 * Counts one attempt against every rule; false if any limit is exceeded.
 * Fails open (logged) if the limiter itself is unavailable, so an outage
 * can't lock every customer out; Supabase's own limits still apply.
 */
export async function consumeRateLimits(rules: RateLimitRule[]): Promise<boolean> {
  if (bypassForLocalTests()) return true;
  const supabase = createSupabaseAdminClient();
  const results = await Promise.all(
    rules.map(async (rule) => {
      const { data, error } = await supabase.rpc("consume_public_rate_limit", {
        bucket: rule.bucket,
        subject: rateLimitSubject(rule.subject),
        max_hits: rule.max,
        window_seconds: rule.windowSeconds,
      });
      if (error) {
        console.error("[rate-limit] limiter unavailable", { bucket: rule.bucket, code: error.code });
        return true;
      }
      return data === true;
    })
  );
  return results.every(Boolean);
}

export const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a few minutes and try again.";
