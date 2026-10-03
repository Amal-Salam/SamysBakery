import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Signed-in journeys against the local Supabase stack (see playwright.config.ts).
// Creates pre-confirmed throwaway users (@example.com — no email is sent).

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type Account = { id: string; email: string; password: string };

async function createAccount(fullName: string, role: "CUSTOMER" | "ADMIN"): Promise<Account> {
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

async function deleteAccount(account: Account | undefined) {
  if (!account) return;
  await service.from("profiles").delete().eq("id", account.id);
  await service.auth.admin.deleteUser(account.id);
}

async function signIn(page: Page, account: Account) {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.configure({ mode: "serial" });

let customer: Account;
let admin: Account;

test.beforeAll(async () => {
  customer = await createAccount("E2E Customer", "CUSTOMER");
  admin = await createAccount("E2E Admin", "ADMIN");
});

test.afterAll(async () => {
  await deleteAccount(customer);
  await deleteAccount(admin);
});

test("customer signs in, session survives navigation, and signs out", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL("/login?next=%2Faccount");

  await signIn(page, customer);
  await expect(page).toHaveURL("/account");
  await expect(page.getByText("E2E Customer")).toBeVisible();

  // Session persists across navigation; header switches to "Account".
  await page.goto("/");
  const mainNav = page.getByRole("navigation", { name: "Main" });
  await expect(mainNav.getByRole("link", { name: "Account" })).toBeVisible();
  await mainNav.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL("/account");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("login from checkout returns the customer to checkout", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL("/login?next=%2Fcheckout");

  await signIn(page, customer);
  // /checkout is built in Milestone 8; reaching its URL proves the return path.
  await expect(page).toHaveURL("/checkout");
});

test("customer is forbidden from the admin area", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, customer);
  await expect(page).toHaveURL("/");

  await page.goto("/admin");
  await expect(page.getByText("Forbidden")).toBeVisible();
  await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
});

test("customer credentials are rejected by the admin login", async ({ page }) => {
  await page.goto("/admin/login");
  await signIn(page, customer);
  await expect(
    page.getByRole("alert").filter({ hasText: "This account does not have admin access." })
  ).toBeVisible();

  // The rejected login must not leave a customer session behind.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("admin signs in to the admin area and signs out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  await signIn(page, admin);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
