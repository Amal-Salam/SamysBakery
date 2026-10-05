import { expect, test } from "@playwright/test";

// Google sign-in on our own domain (G1), against a local mock of Google.
// The mock's ID token isn't signed by Google, so Supabase refuses it — that
// final step is checked manually with real Google. Everything else is here.

const MOCK_GOOGLE = "http://127.0.0.1:3997";

async function mockState(request: import("@playwright/test").APIRequestContext) {
  return (await (await request.get(`${MOCK_GOOGLE}/__state`)).json()) as {
    lastAuthorize: Record<string, string> | null;
    exchanges: { ok: boolean; verifierOk: boolean; redirectUri: string; clientSecretOk: boolean }[];
  };
}

test("Continue with Google sends customers to Google with our own domain as the return address", async ({ page, request, baseURL }) => {
  await page.goto("/login?next=%2Fcheckout");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("heading", { name: "Mock Google sign-in" })).toBeVisible();
  await expect(page.locator("#host")).toHaveText(new URL(baseURL!).host); // not <ref>.supabase.co

  const q = (await mockState(request)).lastAuthorize!;
  expect(q).toMatchObject({
    client_id: "mock-client.apps.googleusercontent.com",
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: `${baseURL}/auth/google/callback`,
    code_challenge_method: "S256",
  });
  expect(q.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(q.nonce).toMatch(/^[0-9a-f]{64}$/); // hashed nonce only
  expect(q.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

  const cookie = (await page.context().cookies()).find((c) => c.name === "samys_google_oauth");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/auth/google" });
});

test("cancelling on Google returns to sign-in with a clear message and keeps the destination", async ({ page }) => {
  await page.goto("/login?next=%2Fcheckout");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/login?error=oauth_cancelled&next=%2Fcheckout");
  await expect(page.getByRole("alert").filter({ hasText: "Google sign-in was cancelled." })).toBeVisible();
  expect((await page.context().cookies()).find((c) => c.name === "samys_google_oauth")).toBeUndefined();
});

test("the code is exchanged server-side with our secret and PKCE verifier; an unverified token is refused", async ({ page, request }) => {
  await page.goto("/login?next=%2Fcheckout");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Continue" }).click();
  // The mock token isn't signed by Google → Supabase refuses it → back to sign-in.
  await expect(page).toHaveURL("/login?error=oauth&next=%2Fcheckout");
  const last = (await mockState(request)).exchanges.at(-1)!;
  expect(last).toMatchObject({ ok: true, verifierOk: true, clientSecretOk: true });
  expect(last.redirectUri).toMatch(/\/auth\/google\/callback$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/); // not signed in
});

test("forged, replayed or cookie-less callbacks are refused", async ({ page, browser }) => {
  // No flow cookie at all (e.g. a link from someone else).
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto("/auth/google/callback?code=abc&state=xyz");
  await expect(strangerPage).toHaveURL("/login?error=oauth&next=%2F");
  await stranger.close();

  // Wrong state (CSRF attempt) — and the one-time cookie is then gone, so even the right state fails.
  await page.goto("/login?next=%2Faccount");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const continueUrl = new URL((await page.getByRole("link", { name: "Continue" }).getAttribute("href"))!);
  const forged = new URL(continueUrl);
  forged.searchParams.set("state", "forged-state");
  await page.goto(forged.toString());
  await expect(page).toHaveURL("/login?error=oauth&next=%2Faccount");
  await page.goto(continueUrl.toString());
  await expect(page).toHaveURL("/login?error=oauth&next=%2F");
});

test("an off-site destination is never used", async ({ page }) => {
  await page.goto("/auth/google?next=https%3A%2F%2Fevil.example%2Fsteal");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/login?error=oauth_cancelled&next=%2F");
});
