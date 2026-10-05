import { NextResponse, type NextRequest } from "next/server";

import { authorizeUrl, GOOGLE_CALLBACK_PATH, GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_MAX_AGE_SECONDS, newFlow, serializeFlow } from "@/lib/auth/google-flow";
import { safeRedirectPath } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import { getGoogleEnv } from "@/lib/env.server";
import { clientIpFrom } from "@/lib/security/client-ip";
import { consumeRateLimits, RATE_LIMITS } from "@/lib/security/rate-limit";

// GET /auth/google?next=/checkout — starts "Sign in with Google" on OUR domain
// (owner decision, G1), so Google's screen shows this site instead of
// <ref>.supabase.co. Issues state + PKCE + nonce in a short-lived httpOnly
// cookie, then sends the customer to Google.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "/");
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const failure = () => NextResponse.redirect(new URL(`/login?error=oauth&next=${encodeURIComponent(next)}`, appUrl));

  const google = getGoogleEnv();
  if (!google) return failure();
  const ip = clientIpFrom(request.headers);
  if (!(await consumeRateLimits([{ bucket: "google_sign_in_ip", subject: ip, ...RATE_LIMITS.googleSignInPerIp }]))) {
    return failure();
  }

  const flow = newFlow(next);
  const response = NextResponse.redirect(
    authorizeUrl(google.authorizeUrl, {
      clientId: google.clientId,
      redirectUri: new URL(GOOGLE_CALLBACK_PATH, appUrl).toString(),
      flow,
    })
  );
  response.cookies.set(GOOGLE_FLOW_COOKIE, serializeFlow(flow), {
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax", // sent on Google's top-level redirect back to us
    path: "/auth/google",
    maxAge: GOOGLE_FLOW_MAX_AGE_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
