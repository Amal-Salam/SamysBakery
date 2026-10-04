import { expect, test } from "@playwright/test";

import { createAccount, service, signInAsAdmin, type Account } from "./helpers";

// Admin journey (AGENTS.md §48): Customer Orders → View Order → Update Status.
// Orders are created directly in the local database (payment-created orders
// are covered by payment.spec.ts).

let admin: Account;
let customer: Account;

test.beforeAll(async () => {
  admin = await createAccount("E2E Orders Admin", "ADMIN");
  customer = await createAccount("Order Customer");
});

async function createOrder(): Promise<string> {
  const { data, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id,
      delivery_date: "2030-01-03", // a Thursday
      recipient_name: "Order Customer",
      phone: "0803 111 2222",
      email: customer.email,
      delivery_address: "7 Status Street",
      delivery_city: "Abuja",
      delivery_state: "FCT",
      special_notes: "Leave at reception",
      subtotal: 9000,
      paid_at: new Date().toISOString(),
    })
    .select("id, order_number")
    .single();
  expect(error).toBeNull();
  await service.from("order_items").insert({
    order_id: data!.id, product_name: "Status Sourdough", unit_price: 4500, quantity: 2, line_total: 9000,
  });
  return data!.order_number;
}

test("admin views an order and moves it through the lifecycle", async ({ page }) => {
  const orderNumber = await createOrder();
  await signInAsAdmin(page, admin);

  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: orderNumber });
  await expect(row.getByText("Order Customer")).toBeVisible();
  await expect(row.getByText("₦9,000")).toBeVisible();
  await row.getByRole("link", { name: orderNumber }).click();

  // Full operational detail.
  await expect(page.getByRole("heading", { level: 1, name: orderNumber })).toBeVisible();
  for (const text of [customer.email, "0803 111 2222", "7 Status Street, Abuja, FCT", "Leave at reception", "Status Sourdough", "2 × ₦4,500"]) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
  await expect(page.getByText("Current status: Paid")).toBeVisible();

  const control = page.getByRole("region", { name: "Order status" });
  const select = control.getByLabel("Change status to");

  // Forward, one step.
  await select.selectOption({ label: "Received" });
  await control.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Current status: Received")).toBeVisible();

  // Forward, skipping steps (owner decision).
  await select.selectOption({ label: "Ready" });
  await control.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Current status: Ready")).toBeVisible();

  // Only one step back is offered, and it needs a reason.
  await expect(select.locator("option", { hasText: "Back to Received" })).toHaveCount(0);
  await select.selectOption({ label: "Back to Baking/Preparing" });
  await expect(control.getByLabel("Reason for the correction")).toBeVisible();
  await control.getByRole("button", { name: "Update status" }).click();
  await expect(control.getByRole("alert")).toContainText("needs a short reason");
  await expect(page.getByText("Current status: Ready")).toBeVisible();

  await select.selectOption({ label: "Back to Baking/Preparing" });
  await control.getByLabel("Reason for the correction").fill("Marked ready too early");
  await control.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Current status: Baking/Preparing")).toBeVisible();

  // History and audit.
  const history = page.getByRole("region", { name: "Activity" });
  await expect(history.getByText("(correction)")).toBeVisible();
  await expect(history.getByText("Reason: Marked ready too early")).toBeVisible();
  const { data: audit } = await service
    .from("audit_logs")
    .select("metadata")
    .eq("action", "ORDER_STATUS_CHANGED")
    .eq("actor_user_id", admin.id)
    .contains("metadata", { order_number: orderNumber });
  expect(audit).toHaveLength(3);
});

test("cancelled orders are distinct and cannot change status", async ({ page }) => {
  const orderNumber = await createOrder();
  await service.from("orders").update({ order_status: "CANCELLED", cancelled_at: new Date().toISOString() }).eq("order_number", orderNumber);
  await signInAsAdmin(page, admin);

  await page.goto("/admin/orders?status=CANCELLED");
  await expect(page.getByRole("row").filter({ hasText: orderNumber }).getByText("Cancelled")).toBeVisible();
  await page.goto(`/admin/orders/${orderNumber}`);
  await expect(page.getByText("This order is cancelled; its status can't change.")).toBeVisible();
  await expect(page.getByLabel("Change status to")).toHaveCount(0);
});

test("customers cannot see admin orders", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin/orders");
  await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
});
