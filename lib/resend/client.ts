import "server-only";

import { getResendEnv } from "@/lib/env.server";

// Resend integration: decides HOW an email is sent. The notifications feature
// decides WHEN (Project Structure §16, §31). The API key is never logged.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend de-duplicates sends with the same key (belt and braces with our DB claim). */
  idempotencyKey: string;
};

export type SendResult = { sent: true; id: string } | { sent: false; reason: "NOT_CONFIGURED" | "FAILED" };

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = getResendEnv();
  if (!env) return { sent: false, reason: "NOT_CONFIGURED" };

  try {
    const response = await fetch(`${env.RESEND_API_BASE}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!response.ok || !body?.id) {
      console.error("[email] send failed", response.status);
      return { sent: false, reason: "FAILED" };
    }
    return { sent: true, id: body.id };
  } catch {
    console.error("[email] send failed (network)");
    return { sent: false, reason: "FAILED" };
  }
}
