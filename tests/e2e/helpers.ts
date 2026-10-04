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

/**
 * Frees the single DRAFT/PUBLISHED menu slots on the LOCAL stack by moving any
 * active menus to unique, long-past expired weeks. Refuses to run elsewhere.
 */
export async function clearActiveMenus() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    throw new Error("clearActiveMenus only runs against the local Supabase stack");
  }
  const { data: active } = await service
    .from("weekly_menus")
    .select("id")
    .in("status", ["DRAFT", "PUBLISHED"]);
  for (const menu of active ?? []) {
    // A random Tuesday in the 1990s keeps week_start unique.
    const weeks = Math.floor(Math.random() * 500);
    const start = new Date(Date.UTC(1990, 0, 2 + weeks * 7));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
    await service
      .from("weekly_menus")
      .update({
        status: "EXPIRED",
        expired_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        week_start: start.toISOString().slice(0, 10),
        week_end: end.toISOString().slice(0, 10),
      })
      .eq("id", menu.id);
  }
}

/** Local Supabase captures auth emails (verification, password reset) in Mailpit. */
const MAILPIT = "http://127.0.0.1:54324";

/** Polls the local mail catcher for the newest Supabase auth link sent to `to`. */
export async function latestAuthLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string; Text: string };
      const match = `${message.HTML}\n${message.Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/);
      if (match) return match[0].replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("No auth email arrived");
}

/** Signs in through Supabase Auth as the mobile app would and returns the access token. */
export async function accessTokenFor(account: Account): Promise<string> {
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw new Error("sign-in failed");
  return data.session.access_token;
}
