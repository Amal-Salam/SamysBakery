import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { accessTokenFor, createAccount, type Account } from "./helpers";

// Live cart sync between the website and the mobile app (mobile M2).
// The "phone" is simulated with the API (to change the cart) and a Supabase
// Realtime subscription made with the customer's own token (to listen).

type Fixture = { products: Record<string, { name: string; slug: string }> };
const fixture = () => JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture;

function phoneListener(token: string, userId: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.realtime.setAuth(token);
  const events: string[] = [];
  const subscribed = new Promise<void>((resolve) => {
    client
      .channel(`test-${userId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${userId}` }, (payload) => {
        events.push(payload.eventType);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
  });
  return { client, events, subscribed };
}

async function signInOnWeb(page: import("@playwright/test").Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("a cart change on the phone appears on the website without reloading", async ({ page, request }) => {
  const { products } = fixture();
  const customer = await createAccount("Sync Web Customer");
  const token = await accessTokenFor(customer);
  const banana = (await (await request.get(`/api/v1/menu/${products.banana.slug}`)).json()).data.id;

  await signInOnWeb(page, customer);
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  await page.waitForTimeout(1500); // let the live subscription connect

  // "Phone" adds to the cart through the API.
  await request.post("/api/v1/cart/items", { headers: { authorization: `Bearer ${token}` }, data: { productId: banana, quantity: 2 } });
  await expect(page.getByText(products.banana.name).first()).toBeVisible({ timeout: 10_000 });

  // "Phone" clears it again.
  await request.delete("/api/v1/cart", { headers: { authorization: `Bearer ${token}` } });
  await expect(page.getByText("Your cart is empty.")).toBeVisible({ timeout: 10_000 });
});

test("a cart change on the website reaches the phone, and never another customer", async ({ page, request }) => {
  const { products } = fixture();
  const [customer, other] = await Promise.all([createAccount("Sync Phone Customer"), createAccount("Sync Snooper")]);
  const [token, otherToken] = await Promise.all([accessTokenFor(customer), accessTokenFor(other)]);

  const phone = phoneListener(token, customer.id);
  // Another customer tries to listen to this customer's cart by filtering on their id.
  const snooper = phoneListener(otherToken, customer.id);
  await Promise.all([phone.subscribed, snooper.subscribed]);
  // Realtime reports SUBSCRIBED slightly before change delivery is active.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await signInOnWeb(page, customer);
  await page.goto(`/menu/${products.sourdough.slug}`);
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();

  await expect.poll(() => phone.events.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const cart = (await (await request.get("/api/v1/cart", { headers: { authorization: `Bearer ${token}` } })).json()).data;
  expect(cart.items).toEqual([expect.objectContaining({ name: products.sourdough.name, quantity: 1 })]);

  await page.waitForTimeout(1500);
  expect(snooper.events).toEqual([]); // RLS: not their cart

  await Promise.all([phone.client.removeAllChannels(), snooper.client.removeAllChannels()]);
});
