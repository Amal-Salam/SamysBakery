import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// E2E helpers. playwright.config.ts points process.env at the local Supabase
// stack, so these service-role calls never touch the hosted project.

export const service = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export type Account = { id: string; email: string; password: string };

export async function createAccount(
  fullName: string,
  role: "CUSTOMER" | "ADMIN" = "CUSTOMER"
): Promise<Account> {
  const email = `sb-e2e-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error("createUser failed");
  if (role === "ADMIN") {
    const { error: promoteError } = await service
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", data.user.id);
    if (promoteError) throw new Error("promote failed");
  }
  return { id: data.user.id, email, password };
}

export async function signInAsAdmin(page: Page, account: Account) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/admin");
}

export const uniqueSuffix = () => randomUUID().slice(0, 8);

/** A real 1×1 PNG. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
