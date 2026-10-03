import { NextResponse, type NextRequest } from "next/server";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, appUrl));
    }
  }

  // Covers cancelled OAuth, expired/used links, and links opened in a different
  // browser (the email is still verified; the user just needs to sign in).
  const failure = new URL("/login", appUrl);
  failure.searchParams.set("error", "callback");
  failure.searchParams.set("next", next);
  return NextResponse.redirect(failure);
}
