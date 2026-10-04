import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { ADMIN_LOGIN_PATH, LOGIN_PATH, safeRedirectPath } from "@/lib/auth/routes";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/domain";

export type CurrentUser = {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  phone: string | null;
};

/**
 * Resolves the signed-in user from a verified JWT, plus their profile (read
 * through RLS). Role always comes from `profiles.role`, never from the session.
 * Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profileError) {
    throw new AppError("INTERNAL_ERROR", "Could not load your account.");
  }
  if (!profile) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    role: profile.role,
    fullName: profile.full_name,
    phone: profile.phone,
  };
});

// ---- Page guards (Server Components): redirect on failure ----

export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = safeRedirectPath(returnTo, "/account");
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export type AdminCheck =
  | { status: "ok"; user: CurrentUser }
  | { status: "forbidden"; user: CurrentUser };

/** Redirects signed-out visitors; reports non-admins so the caller can render FORBIDDEN. */
export async function checkAdminPage(): Promise<AdminCheck> {
  const user = await getCurrentUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);
  return user.role === "ADMIN"
    ? { status: "ok", user }
    : { status: "forbidden", user };
}

/**
 * For admin pages. The admin layout already redirects signed-out visitors and
 * shows Forbidden to customers, but Next renders a segment's page alongside its
 * layout — so pages return early unless the viewer is an admin, and no admin
 * query ever runs for anyone else. Cached per request.
 */
export async function isAdminViewer(): Promise<boolean> {
  return (await getCurrentUser())?.role === "ADMIN";
}

// ---- Action guards (Server Actions / Route Handlers): throw AppError ----

export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  }
  return user;
}
