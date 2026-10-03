import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { createAccount, service, type Account } from "./helpers";

// Checkout preparation (Milestone 8), customer journey AGENTS.md §47:
// … Add to Cart → Login/Register → Checkout → Address → Delivery Date → Review.
// Fixture menu from storefront.setup.ts; cutoff pinned to 23:59 there.

type Fixture = { menuId: string; products: Record<string, { name: string; slug: string }> };
let products: Fixture["products"];
test.beforeAll(() => {
  products = (JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture).products;
});

async function addToCart(page: Page, slug: string, quantity: number) {
  await page.goto(`/menu/${slug}`);
  await page.getByLabel("Quantity", { exact: true }).fill(String(quantity));
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
}

async function signIn(page: Page, account: Account) {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("guest is sent to login and returned to checkout; full checkout preparation", async ({ page }) => {
  const customer = await createAccount("Ada Checkout");

  // Guest adds to cart, then checks out → login → straight back to checkout.
  await addToCart(page, products.sourdough.slug, 2);
  await addToCart(page, products.banana.slug, 1);
  await page.goto("/cart");
  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL("/login?next=%2Fcheckout");
  await expect(page.getByText("Sign in to continue to checkout.")).toBeVisible();
  await signIn(page, customer);
  await expect(page).toHaveURL("/checkout");

  // Step 1 — Customer
  await expect(page.getByRole("navigation", { name: "Checkout progress" })).toBeVisible();
  await expect(page.getByText("Ada Checkout")).toBeVisible();
  await expect(page.getByText(customer.email)).toBeVisible();
  await page.getByRole("button", { name: "Continue to delivery" }).click();

  // Step 2 — Delivery: no saved addresses yet, so a new address form.
  await expect(page.getByText("Enter your delivery address")).toBeVisible();
  await expect(page.getByText(/Delivery fee is handled separately by our delivery partner/).first()).toBeVisible();
  const dates = page.getByRole("group", { name: "Delivery date" }).getByRole("radio");
  expect(await dates.count()).toBeGreaterThan(0);
  for (const label of await page.getByRole("group", { name: "Delivery date" }).locator("label").allTextContents()) {
    expect(label).not.toMatch(/Sun|Mon/);
  }

  // Validation: missing phone.
  await page.getByLabel("Phone number").fill("");
  await page.getByLabel("Street address").fill("12 Aminu Kano Crescent, Wuse 2");
  await page.getByLabel("City").fill("Abuja");
  await page.getByLabel("State").fill("FCT");
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(page.getByText("Enter a phone number for delivery.")).toBeVisible();

  await page.getByLabel("Phone number").fill("0803 123 4567");
  await page.getByLabel("Special notes (optional)").fill("Please call on arrival.");
  await expect(page.getByText("23/500 characters")).toBeVisible();
  const chosenDate = await dates.last().getAttribute("value");
  await dates.last().check();
  await page.getByRole("button", { name: "Review order" }).click();

  // Step 3 — Review: authoritative server summary.
  const review = page.getByRole("region", { name: "Review your order" });
  await expect(review).toBeVisible();
  await expect(review.getByText(products.sourdough.name)).toBeVisible();
  await expect(review.getByText("2 × ₦6,500")).toBeVisible();
  await expect(review.getByText("1 × ₦4,000")).toBeVisible();
  await expect(review.getByText("₦17,000")).toBeVisible(); // 13,000 + 4,000
  await expect(review.getByText("12 Aminu Kano Crescent, Wuse 2, Abuja, FCT")).toBeVisible();
  await expect(review.getByText("Please call on arrival.")).toBeVisible();
  await expect(review.getByText(/Delivery fee is handled separately/)).toBeVisible();
  await expect(review.getByRole("button", { name: "Pay with Paystack" })).toBeEnabled(); // Milestone 10

  // The new address was saved to the account (owner decision) as the default.
  const { data: saved } = await service.from("addresses").select("id, is_default, label").eq("user_id", customer.id);
  expect(saved).toHaveLength(1);
  expect(saved![0]).toMatchObject({ is_default: true, label: "Home" });

  // Going back keeps the choices and doesn't save the address twice.
  await review.getByRole("button", { name: "Change delivery details" }).click();
  await expect(page.getByRole("radio", { name: /Home/ })).toBeChecked();
  expect(chosenDate).toBeTruthy();
  await expect(page.locator(`input[name="deliveryDate"][value="${chosenDate}"]`)).toBeChecked();
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(review).toBeVisible();
  const { count } = await service.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(count).toBe(1);

  // No order or payment exists yet (checkout preparation only).
  const { count: orders } = await service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  const { count: payments } = await service.from("payments").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(orders).toBe(0);
  expect(payments).toBe(0);
});

test("a tampered delivery date is rejected by the server", async ({ page }) => {
  const customer = await createAccount("Tamper Test");
  await service.from("addresses").insert({
    user_id: customer.id, label: "Home", recipient_name: "T", phone: "0803 000 0000",
    address_line: "1 Road", city: "Abuja", state: "FCT", is_default: true,
  });
  await page.goto("/login?next=%2Fcheckout");
  await signIn(page, customer);
  await expect(page).toHaveURL("/checkout");
  await addToCart(page, products.banana.slug, 1);
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Continue to delivery" }).click();

  // Pretend the browser offered a Monday.
  const firstDate = page.getByRole("group", { name: "Delivery date" }).getByRole("radio").first();
  await firstDate.evaluate((input: HTMLInputElement) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    input.value = monday.toISOString().slice(0, 10);
  });
  await firstDate.check();
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Please choose one of the available delivery days" })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Review your order" })).toHaveCount(0);
});

test("checkout is blocked while the cart has problems", async ({ page }) => {
  const customer = await createAccount("Blocked Checkout");
  const { data: cake } = await service
    .from("weekly_menu_products").select("id").eq("name_snapshot", products.cake.name).single();
  const { data: cart } = await service.from("carts").insert({ user_id: customer.id }).select("id").single();
  // More cakes than are available (2).
  await service.from("cart_items").insert({ cart_id: cart!.id, weekly_menu_product_id: cake!.id, quantity: 5 });

  await page.goto("/login?next=%2Fcheckout");
  await signIn(page, customer);
  await expect(page).toHaveURL("/checkout");
  await expect(page.getByText("Some items in your cart need attention.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to delivery" })).toHaveCount(0);
});
