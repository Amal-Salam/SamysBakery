import { expect, test } from "@playwright/test";

import { accessTokenFor, createAccount } from "./helpers";

// Mobile API foundation (mobile M1): bearer-token authentication, the standard
// envelope, no caching, no CORS. Menu content is covered in api-v1-menu.spec.ts.

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test("GET /api/v1/me requires a valid bearer token and returns only the caller", async ({ request }) => {
  const ada = await createAccount("API Ada");
  const bayo = await createAccount("API Bayo");
  const [adaToken, bayoToken] = await Promise.all([accessTokenFor(ada), accessTokenFor(bayo)]);

  const anonymous = await request.get("/api/v1/me");
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.json()).toEqual({
    success: false,
    error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
  });

  const asAda = await request.get("/api/v1/me", { headers: bearer(adaToken) });
  expect(asAda.status()).toBe(200);
  expect(await asAda.json()).toEqual({
    success: true,
    data: { id: ada.id, email: ada.email, fullName: "API Ada", phone: null, role: "CUSTOMER" },
  });
  expect(asAda.headers()["cache-control"]).toBe("no-store");
  expect(asAda.headers()["access-control-allow-origin"]).toBeUndefined();

  const asBayo = await request.get("/api/v1/me", { headers: bearer(bayoToken) });
  expect((await asBayo.json()).data.id).toBe(bayo.id);
});

test("malformed, forged or tampered tokens are refused", async ({ request }) => {
  const ada = await createAccount("API Tamper");
  const token = await accessTokenFor(ada);
  const [header, payload] = token.split(".");
  // Same header and claims, different signature.
  const forgedSignature = `${header}.${payload}.${Buffer.from("forged-signature").toString("base64url")}`;
  // Claims changed to another user, original signature kept.
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  const swapped = Buffer.from(JSON.stringify({ ...claims, sub: "00000000-0000-0000-0000-000000000000" })).toString("base64url");
  const tamperedClaims = `${header}.${swapped}.${token.split(".")[2]}`;

  for (const authorization of [
    "Bearer",
    "Bearer not-a-jwt",
    `Basic ${token}`,
    `bearer ${token}`,
    `Bearer ${forgedSignature}`,
    `Bearer ${tamperedClaims}`,
  ]) {
    const response = await request.get("/api/v1/me", { headers: { authorization } });
    expect(response.status(), authorization.slice(0, 20)).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  }
});

test("a website session cookie alone does not authenticate the API", async ({ page }) => {
  const ada = await createAccount("API Cookie");
  await page.goto("/login");
  await page.getByLabel("Email").fill(ada.email);
  await page.getByLabel("Password").fill(ada.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // page.request shares the browser's cookies.
  const response = await page.request.get("/api/v1/me");
  expect(response.status()).toBe(401);
});

test("menu endpoints validate input and use the standard envelope", async ({ request }) => {
  const menu = await request.get("/api/v1/menu");
  expect(menu.status()).toBe(200);
  const body = await menu.json();
  expect(body.success).toBe(true);
  expect(body).toHaveProperty("data");

  const invalid = await request.get("/api/v1/menu/NOT_valid!");
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error.code).toBe("VALIDATION_ERROR");

  const missing = await request.get("/api/v1/menu/no-such-product-on-this-menu");
  expect(missing.status()).toBe(404);
  expect((await missing.json()).error).toEqual({ code: "NOT_FOUND", message: "This product isn't on this week's menu." });
});
