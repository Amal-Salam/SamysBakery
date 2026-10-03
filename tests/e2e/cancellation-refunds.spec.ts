import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createAccount, service, signInAsAdmin, type Account } from "./helpers";

// Cancellation & refunds (Milestone 14). Separate, explicit operations;
// refunds reconciled from Paystack (signed webhook or "Check refund status").
// Orders are created directly; reservation release is covered by pgTAP.

const MOCK = "http://127.0.0.1:3999";
let admin: Account;

test.beforeAll(async () => {
  admin = await createAccount("Refund Admin", "ADMIN");
});

async function paidOrder(customer: Account, status: string) {
  const reference = `SAMY-${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const { data: order, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: "2030-01-03", recipient_name: "Refund Customer", phone: "0803",
      email: customer.email, delivery_address: "3 Refund Road", delivery_city: "Abuja", delivery_state: "FCT",
      subtotal: 7500, paid_at: new Date().toISOString(), order_status: status,
    } as never)
    .select("id, order_number")
    .single();
  expect(error).toBeNull();
  await service.from("order_items").insert({
    order_id: order!.id, product_name: "Refund Cake", unit_price: 7500, quantity: 1, line_total: 7500,
  });
  await service.from("payments").insert({
    order_id: order!.id, user_id: customer.id, reference, amount: 7500, status: "PAID",
    paid_at: new Date().toISOString(), checkout_snapshot: {},
  });
  return { orderNumber: order!.order_number as string, orderId: order!.id as string, reference };
}

async function refundState(orderId: string) {
  const { data } = await service
    .from("refunds").select("status, provider_status, paystack_refund_id").eq("order_id", orderId).maybeSingle();
  return data;
}

async function cancelAsAdmin(page: Page, orderNumber: string) {
  await page.goto(`/admin/orders/${orderNumber}`);
  await page.getByRole("button", { name: "Cancel order" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("No refund is made automatically.")).toBeVisible();
  await dialog.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(page.getByText("Current status: Cancelled")).toBeVisible();
}

async function requestRefund(page: Page) {
  await page.getByRole("button", { name: /^Refund ₦/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, request refund" }).click();
  await expect(page.getByText(/Refund requested — Paystack status: pending/)).toBeVisible();
}

async function paystackRefund(request: APIRequestContext, transaction: string, status: string, sendWebhook: boolean) {
  const response = await request.post(`${MOCK}/__refund`, { data: { transaction, status, sendWebhook } });
  expect(response.ok()).toBe(true);
}

test("customer cancels their own order before it's ready", async ({ page }) => {
  const customer = await createAccount("Cancelling Customer");
  const baking = await paidOrder(customer, "BAKING");
  const ready = await paidOrder(customer, "READY");

  await page.goto(`/login?next=${encodeURIComponent(`/account/orders/${baking.orderNumber}`)}`);
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, cancel my order" }).click();
  await expect(page.getByText("This order was cancelled.")).toBeVisible();
  await expect(page.getByText("Any refund is handled by the bakery")).toBeVisible();

  const { data } = await service.from("orders").select("order_status, payment_status").eq("id", baking.orderId).single();
  expect(data).toEqual({ order_status: "CANCELLED", payment_status: "PAID" }); // no automatic refund
  expect(await refundState(baking.orderId)).toBeNull();

  // A READY order offers no cancellation.
  await page.goto(`/account/orders/${ready.orderNumber}`);
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});

test("admin cancels, then refunds; the signed refund webhook confirms it", async ({ page, request }) => {
  const customer = await createAccount("Webhook Refund Customer");
  const order = await paidOrder(customer, "PAID");
  await signInAsAdmin(page, admin);
  await cancelAsAdmin(page, order.orderNumber);

  await expect(page.getByText("Refund status: Not refunded")).toBeVisible();
  await requestRefund(page);
  // Requested is not refunded.
  expect(await refundState(order.orderId)).toMatchObject({ status: "NOT_REFUNDED", provider_status: "pending" });
  const { data: stillPaid } = await service.from("orders").select("payment_status").eq("id", order.orderId).single();
  expect(stillPaid?.payment_status).toBe("PAID");

  // Paystack processes it and notifies us.
  await paystackRefund(request, order.reference, "processed", true);
  await expect.poll(async () => (await refundState(order.orderId))?.status, { timeout: 15_000 }).toBe("REFUNDED");
  const { data: refunded } = await service.from("orders").select("payment_status").eq("id", order.orderId).single();
  expect(refunded?.payment_status).toBe("REFUNDED");

  await page.reload();
  await expect(page.getByText("Refund status: Refunded")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Refund ₦/ })).toHaveCount(0);
});

test("admin checks refund status manually when no webhook arrives", async ({ page, request }) => {
  const customer = await createAccount("Manual Refund Customer");
  const order = await paidOrder(customer, "RECEIVED");
  await signInAsAdmin(page, admin);
  await cancelAsAdmin(page, order.orderNumber);
  await requestRefund(page);

  await paystackRefund(request, order.reference, "processed", false);
  await page.getByRole("button", { name: "Check refund status" }).click();
  await expect(page.getByText("Refund status: Refunded")).toBeVisible();
  expect(await refundState(order.orderId)).toMatchObject({ status: "REFUNDED", provider_status: "processed" });
});

test("a failed refund can be retried", async ({ page, request }) => {
  const customer = await createAccount("Failed Refund Customer");
  const order = await paidOrder(customer, "PAID");
  await signInAsAdmin(page, admin);
  await cancelAsAdmin(page, order.orderNumber);
  await requestRefund(page);

  await paystackRefund(request, order.reference, "failed", true);
  await expect.poll(async () => (await refundState(order.orderId))?.provider_status, { timeout: 15_000 }).toBe("failed");
  await page.reload();
  await expect(page.getByText(/Refund failed at Paystack/)).toBeVisible();

  await requestRefund(page);
  expect(await refundState(order.orderId)).toMatchObject({ status: "NOT_REFUNDED", provider_status: "pending" });
  const { count } = await service.from("refunds").select("id", { count: "exact", head: true }).eq("order_id", order.orderId);
  expect(count).toBe(1);
});

test("orders can't be cancelled once ready, and refund needs cancellation first", async ({ page }) => {
  const customer = await createAccount("Ready Customer");
  const order = await paidOrder(customer, "READY");
  await signInAsAdmin(page, admin);
  await page.goto(`/admin/orders/${order.orderNumber}`);
  await expect(page.getByText("Orders can only be cancelled before they're ready.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Refund ₦/ })).toHaveCount(0);
});
