"use server";

import { redirect } from "next/navigation";

import { mapAuthError } from "@/features/auth/errors";
import { mergeGuestCartIntoAccount } from "@/features/cart/service";
import { ADMIN_HOME_PATH, safeRedirectPath } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import { fail, ok, validationFailure } from "@/lib/errors";
import { getCurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/schemas/auth";
import type { ActionResult } from "@/types/api";

// Absolute callback URL built from configuration, never from request headers.
function callbackUrl(next: string) {
  const url = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

function readForm(formData: FormData, ...keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key) ?? ""]));
}

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(readForm(formData, "email", "password"));
  if (!parsed.success) return validationFailure(parsed.error);
  const next = safeRedirectPath(formData.get("next"), "/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { success: false, error: mapAuthError(error) };

  await mergeGuestCartSafely(supabase, data.user.id);
  redirect(next);
}

/** Bringing the guest cart along must never block a successful sign-in. */
async function mergeGuestCartSafely(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  try {
    await mergeGuestCartIntoAccount(supabase, userId);
  } catch {
    console.error("[cart] guest cart merge failed");
  }
}

export async function signUp(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData
): Promise<ActionResult<{ email: string }>> {
  const parsed = signUpSchema.safeParse(
    readForm(formData, "fullName", "email", "password")
  );
  if (!parsed.success) return validationFailure(parsed.error);
  const next = safeRedirectPath(formData.get("next"), "/");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: callbackUrl(next),
    },
  });
  if (error) return { success: false, error: mapAuthError(error) };

  // Same response whether or not the email already exists (no account enumeration).
  return ok({ email: parsed.data.email });
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeRedirectPath(formData.get("next"), "/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) {
    redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
  }

  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(readForm(formData, "email"));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/update-password"),
  });
  if (error && error.code?.startsWith("over_")) {
    return { success: false, error: mapAuthError(error) };
  }

  // Always report success so the form cannot be used to discover accounts.
  return ok(null);
}

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return fail("UNAUTHENTICATED", "Your reset link has expired. Please request a new one.");
  }

  const parsed = updatePasswordSchema.safeParse(
    readForm(formData, "password", "confirmPassword")
  );
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { success: false, error: mapAuthError(error) };

  return ok(null);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function adminSignIn(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(readForm(formData, "email", "password"));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { success: false, error: mapAuthError(error) };

  // A valid login is not enough: the profile role must be ADMIN.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.role !== "ADMIN") {
    await supabase.auth.signOut();
    return fail("FORBIDDEN", "This account does not have admin access.");
  }

  redirect(ADMIN_HOME_PATH);
}
