import { expect, test } from "@playwright/test";

// Signed-out behaviour. Signed-in journeys (customer + admin) live in
// auth-session.spec.ts and need a linked Supabase project with test users.

test.describe("route protection (signed out)", () => {
  test("account redirects to login and preserves the return path", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL("/login?next=%2Faccount");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("checkout redirects to login with a checkout prompt", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL("/login?next=%2Fcheckout");
    await expect(page.getByText("Sign in to continue to checkout.")).toBeVisible();
  });

  test("admin redirects to the admin login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  });

  test("cart stays public for guests", async ({ page }) => {
    const response = await page.goto("/cart");
    expect(page.url()).not.toContain("/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Your Cart" })).toBeVisible();
  });
});

test.describe("login page", () => {
  test("offers email sign-in, registration, Google and password reset", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();

    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL("/reset-password");
  });

  test("shows validation errors without contacting the server for bad input", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });

  test("rejects wrong credentials with a generic message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody-e2e@example.com");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /Incorrect email or password|Too many attempts/ })
    ).toBeVisible();
  });

  test("ignores off-site return paths", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    const nextValue = await page.locator('input[name="next"]').first().inputValue();
    expect(nextValue).toBe("/");
  });

  test("update-password without a recovery session shows link-expired", async ({ page }) => {
    await page.goto("/update-password");
    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  });
});

test.describe("Google OAuth", () => {
  test("Continue with Google hands off to Google's sign-in page", async ({ page }) => {
    // The local Supabase stack has no Google provider configured; this check runs
    // only when E2E targets a hosted project.
    test.skip(
      /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "Google provider is only configured on the hosted project"
    );
    await page.goto("/login?next=%2Fcheckout");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 });
    expect(new URL(page.url()).hostname).toBe("accounts.google.com");
  });
});
