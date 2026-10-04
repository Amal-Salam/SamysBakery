import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { latestAuthLink, service, uniqueSuffix } from "./helpers";

// The mandatory customer journey (AGENTS.md §47; Implementation Spec §39) as
// ONE continuous flow through the real UI, nothing seeded for the customer:
// Homepage → Weekly Menu → Product → Add to Cart → Register (+ email
// verification) → Checkout → Address → Delivery Date → Review → Paystack →
// Verified Payment → Order Confirmation (+ email) → Order History → Cancel →
// Reservation Released.

const MOCK_RESEND = "http://127.0.0.1:3998";

async function confirmationEmails(request: APIRequestContext, to: string) {
  return (await (await request.get(`${MOCK_RESEND}/__emails?to=${encodeURIComponent(to)}`)).json()) as {
    subject: string;
    text: string;
  }[];
}

test("a new customer goes from the homepage to a paid, confirmed, then cancelled order", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { menuId } = JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as { menuId: string };
  const sfx = uniqueSuffix();
  const cake = `Journey Cake ${sfx}`;
  const { data: product } = await service
    .from("products")
    .insert({ name: cake, slug: `journey-cake-${sfx}`, description: "A celebration sponge.", ingredients: "Flour, eggs, butter" })
    .select("id")
    .single();
  const { data: wmp } = await service
    .from("weekly_menu_products")
    .insert({ weekly_menu_id: menuId, product_id: product!.id, name_snapshot: cake, price: 4500, weekly_quantity: 3 })
    .select("id")
    .single();
  const email = `sb-e2e-journey-${sfx}@example.com`;
  const password = `pw-journey-${sfx}`;

  // Homepage → Weekly Menu → Product → Add to Cart (as a guest).
  await page.goto("/");
  await page.getByRole("link", { name: "Explore This Week's Menu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "This Week's Menu" })).toBeVisible();
  await page.getByRole("link", { name: cake }).click();
  await expect(page.getByRole("heading", { level: 1, name: cake })).toBeVisible();
  await expect(page.getByText("3 available")).toBeVisible();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();

  // Cart → Checkout → Register.
  await page.goto("/cart");
  await expect(page.getByText(cake).first()).toBeVisible();
  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL("/login?next=%2Fcheckout");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill(`Journey Customer ${sfx}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  // Email verification: the link signs them in and returns them to checkout,
  // bringing the guest cart along.
  await page.goto(await latestAuthLink(email));
  await expect(page).toHaveURL("/checkout");

  // Checkout: Customer → Delivery (new address, delivery date) → Review.
  await expect(page.getByText(`Journey Customer ${sfx}`)).toBeVisible();
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await page.getByLabel("Phone number").fill("0803 555 0101");
  await page.getByLabel("Street address").fill("7 Journey Close, Maitama");
  await page.getByLabel("City").fill("Abuja");
  await page.getByLabel("State").fill("FCT");
  await page.getByRole("group", { name: "Delivery date" }).getByRole("radio").first().check();
  await page.getByRole("button", { name: "Review order" }).click();
  const review = page.getByRole("region", { name: "Review your order" });
  await expect(review.getByText("2 × ₦4,500")).toBeVisible();
  await expect(review.getByText("₦9,000").last()).toBeVisible(); // line total and subtotal
  await expect(review.getByText("7 Journey Close, Maitama, Abuja, FCT")).toBeVisible();

  // Paystack (test mock) → verified payment → confirmation.
  await review.getByRole("button", { name: "Pay with Paystack" }).click();
  await expect(page.getByRole("heading", { name: "Mock Paystack Checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/SAM-\d{4,}$/);
  const orderNumber = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: "Order Confirmed" })).toBeVisible();
  await expect(page.getByText(cake).first()).toBeVisible();

  // Confirmation email with the order details.
  await expect.poll(async () => (await confirmationEmails(request, email)).length, { timeout: 15_000 }).toBe(1);
  const [confirmation] = await confirmationEmails(request, email);
  for (const detail of [orderNumber, cake, "₦9,000", "7 Journey Close, Maitama, Abuja, FCT"]) {
    expect(confirmation.text).toContain(detail);
  }

  // Order history → order details.
  await page.goto("/account/orders");
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByRole("heading", { level: 1, name: orderNumber })).toBeVisible();

  // Cancel the eligible order → its stock is released (no automatic refund).
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, cancel my order" }).click();
  await expect(page.getByText("This order was cancelled.")).toBeVisible();
  const { data: order } = await service
    .from("orders").select("id, order_status, payment_status").eq("order_number", orderNumber).single();
  expect(order).toMatchObject({ order_status: "CANCELLED", payment_status: "PAID" });
  const { data: held } = await service
    .from("inventory_reservations").select("status").eq("order_id", order!.id).eq("weekly_menu_product_id", wmp!.id)
    .eq("reservation_type", "ORDER_CONFIRMED");
  expect(held).toEqual([{ status: "RELEASED" }]);

  // Back on sale in full.
  await page.goto(`/menu/journey-cake-${sfx}`);
  await expect(page.getByText("3 available")).toBeVisible();
});
