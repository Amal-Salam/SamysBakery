import { NextResponse, type NextRequest } from "next/server";

import { mergeGuestCartIntoAccount } from "@/features/cart/service";
import { safeRedirectPath } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles OAuth (Google), email-verification and password-recovery redirects
// from Supabase Auth (PKCE): exchanges the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), "/");
  const code = searchParams.get("code");
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        await mergeGuestCartIntoAccount(supabase, data.user.id);
      } catch {
        // Bringing the guest cart along must never block a successful sign-in.
        console.error("[cart] guest cart merge failed");
      }
      return NextResponse.redirect(new URL(next, appUrl));
    }
    console.warn("[auth/callback] code exchange failed", {
      code: error.code,
      status: error.status,
    });
  } else {
    // Provider/Supabase-reported failure (e.g. cancelled consent, bad provider config).
    // Never log the one-time code or tokens.
    console.warn("[auth/callback] no code", {
      error: searchParams.get("error"),
      errorCode: searchParams.get("error_code"),
      // Supabase may append part of the provider code after a colon; drop it.
      errorDescription: searchParams.get("error_description")?.split(":")[0] ?? null,
    });
  }

  // Covers cancelled OAuth, expired/used links, and links opened in a different
  // browser (the email is still verified; the user just needs to sign in).
  const failure = new URL("/login", appUrl);
  failure.searchParams.set("error", "callback");
  failure.searchParams.set("next", next);
  return NextResponse.redirect(failure);
}
