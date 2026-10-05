import { NextResponse, type NextRequest } from "next/server";

import { mergeGuestCartIntoAccount } from "@/features/cart/service";
import { GOOGLE_CALLBACK_PATH, GOOGLE_FLOW_COOKIE, parseFlow, stateMatches } from "@/lib/auth/google-flow";
import { publicEnv } from "@/lib/env";
import { getGoogleEnv } from "@/lib/env.server";
import { clientIpFrom } from "@/lib/security/client-ip";
import { consumeRateLimits, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/google/callback?code&state — Google returns here (our domain).
// Checks the one-time flow cookie and state, exchanges the code (with the PKCE
// verifier and our client secret, server-side) for Google's ID token, then
// signs in with Supabase, which verifies the token's signature, audience and
// nonce. Never logs codes or tokens.
export const dynamic = "force-dynamic";

const TOKEN_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const params = request.nextUrl.searchParams;
  const flow = parseFlow(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  const next = flow?.next ?? "/";

  const finish = (url: string) => {
    const response = NextResponse.redirect(new URL(url, appUrl));
    // One-time: the flow cookie is always cleared, success or not.
    response.cookies.set(GOOGLE_FLOW_COOKIE, "", { path: "/auth/google", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  const failure = (reason: string) => {
    console.warn("[auth/google] sign-in refused", { reason });
    const key = reason === "google_cancelled" ? "oauth_cancelled" : "oauth";
    return finish(`/login?error=${key}&next=${encodeURIComponent(next)}`);
  };

  const ip = clientIpFrom(request.headers);
  if (!(await consumeRateLimits([{ bucket: "google_sign_in_ip", subject: ip, ...RATE_LIMITS.googleSignInPerIp }]))) {
    return failure("rate_limited");
  }
  if (!flow) return failure("missing_or_expired_flow");
  if (!stateMatches(flow.state, params.get("state"))) return failure("state_mismatch");
  if (params.get("error")) return failure(params.get("error") === "access_denied" ? "google_cancelled" : "google_error");
  const code = params.get("code");
  if (!code || code.length > 2048) return failure("missing_code");

  const google = getGoogleEnv();
  if (!google) return failure("not_configured");

  // Code → tokens (server-to-server, with the PKCE verifier and client secret).
  let idToken: string;
  try {
    const response = await fetch(google.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: new URL(GOOGLE_CALLBACK_PATH, appUrl).toString(),
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
    if (!response.ok || typeof body?.id_token !== "string") return failure("token_exchange_failed");
    idToken = body.id_token;
  } catch {
    return failure("token_exchange_unreachable");
  }

  // Supabase verifies Google's signature, the audience (our client ID) and the nonce.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: flow.nonce });
  if (error || !data.user) return failure("supabase_rejected");

  try {
    await mergeGuestCartIntoAccount(supabase, data.user.id);
  } catch {
    // Bringing the guest cart along must never block a successful sign-in.
    console.error("[cart] guest cart merge failed");
  }
  return finish(next);
}
