import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createAccount, service, uniqueSuffix, type Account } from "./helpers";

// Payments (AGENTS.md §51) through the full redirect flow against the local
// Paystack mock (tests/e2e/mock-paystack.mjs). Each test uses its own product
// so stock never interferes between tests.

const MOCK = "http://127.0.0.1:3999";
const SECRET = "sk_test_mock_e2e";
type Fixture = { menuId: string };
let menuId: string;

test.beforeAll(() => {
  menuId = (JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture).menuId;
});

async function productWithStock(stock: number, price = 5000) {
  const suffix = uniqueSuffix();
  const name = `Pay Loaf ${suffix}`;
  const { data: product } = await service
    .from("products")
    .insert({ name, slug: `pay-loaf-${suffix}`, description: "For payment tests.", ingredients: "Flour" })
    .select("id")
    .single();
  const { data: wmp, error } = await service
    .from("weekly_menu_products")
    .insert({ weekly_menu_id: menuId, product_id: product!.id, name_snapshot: name, price, weekly_quantity: stock })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { id: wmp!.id, name };
}

async function customerWithCart(productId: string, quantity: number): Promise<Account> {
  const customer = await createAccount("Pay Tester");
  await service.from("addresses").insert({
    user_id: customer.id, label: "Home", recipient_name: "Pay Tester", phone: "0803 000 0000",
    address_line: "5 Test Close", city: "Abuja", state: "FCT", is_default: true,
  });
  const { data: cart } = await service.from("carts").insert({ user_id: customer.id }).select("id").single();
  await service.from("cart_items").insert({ cart_id: cart!.id, weekly_menu_product_id: productId, quantity });
  return customer;
}

/** Signs in, goes through checkout and lands on the mock Paystack page. Returns the reference. */
async function goToPaystack(page: Page, customer: Account): Promise<string> {
  await page.goto("/login?next=%2Fcheckout");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/checkout");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: "Pay with Paystack" }).click();
  await expect(page.getByRole("heading", { name: "Mock Paystack Checkout" })).toBeVisible();
  return page.url().split("/pay/")[1];
}

async function control(request: APIRequestContext, reference: string, overrides: Record<string, unknown>) {
  const response = await request.post(`${MOCK}/__control`, { data: { reference, ...overrides } });
  expect(response.ok()).toBe(true);
}

async function mockState(request: APIRequestContext) {
  return (await (await request.get(`${MOCK}/__state`)).json()) as {
    transactions: { reference: string; amount: number }[];
    refunds: { transaction: string; amount: number }[];
  };
}

function signedWebhook(reference: string, secret = SECRET) {
  const body = JSON.stringify({ event: "charge.success", data: { reference } });
  return { body, signature: createHmac("sha512", secret).update(body).digest("hex") };
}

async function paymentByReference(reference: string) {
  const { data } = await service
    .from("payments")
    .select("id, status, order_id, amount")
    .eq("reference", reference)
    .single();
  return data!;
}

async function reservationsFor(paymentId: string) {
  const { data } = await service
    .from("inventory_reservations")
    .select("reservation_type, status, quantity")
    .eq("payment_id", paymentId);
  return data ?? [];
}

test("successful payment creates exactly one order; duplicate webhooks and refreshes are harmless", async ({ page, request }) => {
  const product = await productWithStock(5, 6500);
  const customer = await customerWithCart(product.id, 2);
  const reference = await goToPaystack(page, customer);

  // The amount sent to Paystack was calculated by the server (2 × ₦6,500).
  const initialized = (await mockState(request)).transactions.find((tx) => tx.reference === reference);
  expect(initialized?.amount).toBe(1_300_000);

  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/SAM-\d{4,}$/);
  const orderNumber = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: "Order Confirmed" })).toBeVisible();
  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText(product.name)).toBeVisible();
  await expect(page.getByText("₦13,000").first()).toBeVisible();

  // Database state.
  const payment = await paymentByReference(reference);
  expect(payment.status).toBe("PAID");
  const { data: order } = await service
    .from("orders")
    .select("id, order_number, user_id, subtotal, payment_status, order_status, order_items(product_name, quantity, unit_price)")
    .eq("id", payment.order_id!)
    .single();
  expect(order).toMatchObject({
    order_number: orderNumber, user_id: customer.id, subtotal: 13000, payment_status: "PAID", order_status: "PAID",
  });
  expect(order!.order_items).toEqual([{ product_name: product.name, quantity: 2, unit_price: 6500 }]);
  const { data: confirmed } = await service
    .from("inventory_reservations").select("status, quantity").eq("order_id", order!.id).eq("reservation_type", "ORDER_CONFIRMED");
  expect(confirmed).toEqual([{ status: "ACTIVE", quantity: 2 }]);
  expect((await reservationsFor(payment.id)).map((r) => r.status)).toEqual(["CONVERTED"]);
  const { data: wmp } = await service.from("weekly_menu_products").select("locked_at").eq("id", product.id).single();
  expect(wmp?.locked_at).not.toBeNull(); // first order locks name/price/quantity
  const { count: cartLines } = await service
    .from("cart_items").select("id", { count: "exact", head: true }).eq("weekly_menu_product_id", product.id);
  expect(cartLines).toBe(0);

  // Duplicate webhook / webhook retries: always 200, never a second order.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { body, signature } = signedWebhook(reference);
    const response = await request.post("/api/paystack/webhook", {
      data: body, headers: { "content-type": "application/json", "x-paystack-signature": signature },
    });
    expect(response.status()).toBe(200);
  }
  // Customer refreshes / returns again: same order.
  await page.goto(`/checkout/complete?reference=${reference}`);
  await expect(page).toHaveURL(`/order-confirmation/${orderNumber}`);

  const { count } = await service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(count).toBe(1);
  const { count: audits } = await service
    .from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "ORDER_CREATED").eq("entity_id", order!.id);
  expect(audits).toBe(1);
});

for (const outcome of [
  { button: "Simulate failed payment", label: "failed" },
  { button: "Cancel payment", label: "abandoned" },
]) {
  test(`${outcome.label} payment creates no order and releases the stock`, async ({ page }) => {
    const product = await productWithStock(1);
    const customer = await customerWithCart(product.id, 1);
    const reference = await goToPaystack(page, customer);

    await page.getByRole("button", { name: outcome.button }).click();
    await expect(page.getByText("Payment was not completed.")).toBeVisible();

    const payment = await paymentByReference(reference);
    expect(payment).toMatchObject({ status: "FAILED", order_id: null });
    expect((await reservationsFor(payment.id)).map((r) => r.status)).toEqual(["RELEASED"]);
    const { data: available } = await service.rpc("get_published_menu_availability");
    expect((available as { weekly_menu_product_id: string; available_quantity: number }[])
      .find((row) => row.weekly_menu_product_id === product.id)?.available_quantity).toBe(1);

    // The customer can retry: the cart is intact.
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(page.getByRole("button", { name: "Continue to delivery" })).toBeVisible();
  });
}

test("webhook rejects invalid or missing signatures", async ({ request }) => {
  const product = await productWithStock(1);
  const customer = await customerWithCart(product.id, 1);
  const forged = signedWebhook("SAMY-00000000000000000000000000000000", "sk_test_wrong_secret");

  const bad = await request.post("/api/paystack/webhook", {
    data: forged.body, headers: { "content-type": "application/json", "x-paystack-signature": forged.signature },
  });
  expect(bad.status()).toBe(401);
  const missing = await request.post("/api/paystack/webhook", {
    data: forged.body, headers: { "content-type": "application/json" },
  });
  expect(missing.status()).toBe(401);

  // A tampered body with a signature for different bytes is rejected too.
  const valid = signedWebhook("SAMY-00000000000000000000000000000000");
  const tampered = await request.post("/api/paystack/webhook", {
    data: valid.body.replace("charge.success", "charge.success "),
    headers: { "content-type": "application/json", "x-paystack-signature": valid.signature },
  });
  expect(tampered.status()).toBe(401);

  const { count } = await service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(count).toBe(0);
});

for (const mismatch of [
  { label: "amount mismatch", overrides: { verify_amount: 100 }, audit: "PAYMENT_AMOUNT_MISMATCH" },
  { label: "currency mismatch", overrides: { verify_currency: "USD" }, audit: "PAYMENT_CURRENCY_MISMATCH" },
]) {
  test(`${mismatch.label}: no paid order is created`, async ({ page, request }) => {
    const product = await productWithStock(2);
    const customer = await customerWithCart(product.id, 1);
    const reference = await goToPaystack(page, customer);
    await control(request, reference, { ...mismatch.overrides, skipWebhook: true });

    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page.getByText("We couldn't confirm this payment.")).toBeVisible();

    const payment = await paymentByReference(reference);
    expect(payment.order_id).toBeNull();
    expect(payment.status).toBe("FAILED");
    const { count } = await service
      .from("audit_logs").select("id", { count: "exact", head: true }).eq("action", mismatch.audit).eq("entity_id", payment.id);
    expect(count).toBe(1);
  });
}

test("verification failure (reference mismatch) never creates an order", async ({ page, request }) => {
  const product = await productWithStock(2);
  const customer = await customerWithCart(product.id, 1);
  const reference = await goToPaystack(page, customer);
  await control(request, reference, { verify_reference: "SOMEONE-ELSES-REFERENCE", skipWebhook: true });

  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("We couldn't confirm this payment.")).toBeVisible();
  const payment = await paymentByReference(reference);
  expect(payment).toMatchObject({ order_id: null, status: "PENDING" });
});

test("late payment (after the hold expired) is refused and refunded automatically", async ({ page, request }) => {
  const product = await productWithStock(2, 4000);
  const customer = await customerWithCart(product.id, 1);
  const reference = await goToPaystack(page, customer);
  // Paystack reports the payment as completed 20 minutes later (hold is 15).
  const late = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  await control(request, reference, { paid_at_override: late, skipWebhook: true });

  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("Your payment arrived too late to hold your items.")).toBeVisible();

  const payment = await paymentByReference(reference);
  expect(payment).toMatchObject({ order_id: null, status: "PAID" });
  const { data: refund } = await service
    .from("refunds").select("status, reason, paystack_refund_id, amount").eq("payment_id", payment.id).single();
  expect(refund).toMatchObject({ status: "NOT_REFUNDED", reason: "LATE_PAYMENT", amount: 4000 });
  expect(refund?.paystack_refund_id).toBeTruthy(); // requested, not marked complete
  const refunds = (await mockState(request)).refunds.filter((r) => r.transaction === reference);
  expect(refunds).toEqual([expect.objectContaining({ amount: 400_000 })]);

  // Processing again doesn't request a second refund.
  await page.goto(`/checkout/complete?reference=${reference}`);
  await expect(page.getByText("Your payment arrived too late to hold your items.")).toBeVisible();
  expect((await mockState(request)).refunds.filter((r) => r.transaction === reference)).toHaveLength(1);
});

test("customer closes the browser after paying: the webhook still creates the order", async ({ page, request }) => {
  const product = await productWithStock(3);
  const customer = await customerWithCart(product.id, 1);
  const reference = await goToPaystack(page, customer);

  // Complete payment on Paystack without following the redirect back.
  await page.close();
  const paid = await request.post(`${MOCK}/pay/${reference}/success`, { maxRedirects: 0 });
  expect(paid.status()).toBe(302);

  await expect.poll(async () => (await paymentByReference(reference)).order_id, { timeout: 15_000 }).not.toBeNull();
  const payment = await paymentByReference(reference);
  expect(payment.status).toBe("PAID");
});
