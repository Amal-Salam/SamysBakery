import { expect, test } from "@playwright/test";

import { addDays, isoWeekday, lagosToday } from "@/lib/utils/dates";

import { createAccount, service, signInAsAdmin, uniqueSuffix, type Account } from "./helpers";

// Admin dashboard, order views and revenue (Milestone 15). Orders are created
// directly; assertions are scoped to this test's own order numbers/products,
// because other specs share the local database.

const isDeliveryDay = (date: string) => isoWeekday(date) >= 2 && isoWeekday(date) <= 6;
function nextDeliveryDayAfter(date: string) {
  let next = addDays(date, 1);
  while (!isDeliveryDay(next)) next = addDays(next, 1);
  return next;
}

async function createOrder(
  customer: Account,
  opts: { status: string; deliveryDate: string; product: string; quantity: number }
) {
  const unit = 2500;
  const { data: order, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: opts.deliveryDate, recipient_name: "Dashboard Customer", phone: "0803",
      email: customer.email, delivery_address: "5 Dashboard Road", delivery_city: "Abuja", delivery_state: "FCT",
      subtotal: unit * opts.quantity, paid_at: new Date().toISOString(), order_status: opts.status,
      cancelled_at: opts.status === "CANCELLED" ? new Date().toISOString() : null,
    } as never)
    .select("id, order_number")
    .single();
  expect(error).toBeNull();
  const { error: itemError } = await service.from("order_items").insert({
    order_id: order!.id, product_name: opts.product, unit_price: unit, quantity: opts.quantity, line_total: unit * opts.quantity,
  });
  expect(itemError).toBeNull();
  return order!.order_number as string;
}

test("dashboard shows operations, new orders, revenue, and refreshes itself", async ({ page }) => {
  const admin = await createAccount("Dashboard Admin", "ADMIN");
  const customer = await createAccount("Dashboard Customer");
  const sfx = uniqueSuffix();
  const product = `Dash Bun ${sfx}`;
  const today = lagosToday();
  const todayDeliverable = isDeliveryDay(today);
  const soon = todayDeliverable ? today : nextDeliveryDayAfter(today);
  const later = nextDeliveryDayAfter(soon);

  const newOrder = await createOrder(customer, { status: "PAID", deliveryDate: soon, product, quantity: 3 });
  const readyOrder = await createOrder(customer, { status: "READY", deliveryDate: later, product: `Dash Loaf ${sfx}`, quantity: 1 });
  const cancelled = await createOrder(customer, { status: "CANCELLED", deliveryDate: soon, product, quantity: 5 });

  await page.clock.install();
  await signInAsAdmin(page, admin);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  // Quick actions.
  const quick = page.getByRole("navigation", { name: "Quick actions" });
  for (const label of ["Create New Week", "Manage Current Menu", "View Orders", "Add Product"]) {
    await expect(quick.getByRole("link", { name: label })).toBeVisible();
  }

  // New paid order notification.
  const alert = page.getByRole("region", { name: /new paid orders? waiting to be received/ });
  await expect(alert.getByRole("link", { name: new RegExp(newOrder) })).toBeVisible();
  await expect(alert.getByRole("link", { name: new RegExp(readyOrder) })).toHaveCount(0);

  // Operational and business overview.
  for (const label of ["Today's orders", "Upcoming orders", "To prepare", "Ready for delivery"]) {
    await expect(page.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  for (const label of ["Paid", "Cancelled", "Refunded", "Net"]) {
    await expect(page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /^Low stock/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Sold out/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current weekly menu" })).toBeVisible();

  if (todayDeliverable) {
    const todaySection = page.getByRole("region", { name: "Today's orders by status" });
    await expect(todaySection.getByRole("region", { name: /^Paid/ }).getByRole("link", { name: newOrder })).toBeVisible();
    await expect(todaySection.getByRole("region", { name: /^Cancelled/ }).getByRole("link", { name: cancelled })).toBeVisible();
  }

  // A new paid order appears on the next automatic refresh (every 60 s).
  const arriving = await createOrder(customer, { status: "PAID", deliveryDate: later, product, quantity: 1 });
  await expect(alert.getByRole("link", { name: new RegExp(arriving) })).toHaveCount(0);
  await page.clock.fastForward("01:01");
  await expect(alert.getByRole("link", { name: new RegExp(arriving) })).toBeVisible({ timeout: 15_000 });
});

test("operational order views and approved revenue figures", async ({ page }) => {
  const admin = await createAccount("Views Admin", "ADMIN");
  const customer = await createAccount("Views Customer");
  const sfx = uniqueSuffix();
  const today = lagosToday();
  const later = nextDeliveryDayAfter(today);
  const paid = await createOrder(customer, { status: "BAKING", deliveryDate: later, product: `View Cake ${sfx}`, quantity: 2 });
  const ready = await createOrder(customer, { status: "READY", deliveryDate: later, product: `View Cake ${sfx}`, quantity: 1 });
  const cancelled = await createOrder(customer, { status: "CANCELLED", deliveryDate: later, product: `View Cake ${sfx}`, quantity: 4 });

  await signInAsAdmin(page, admin);

  await page.goto("/admin/orders?view=upcoming");
  await expect(page.getByRole("heading", { level: 1, name: "Upcoming Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: paid })).toBeVisible();
  await expect(page.getByRole("link", { name: ready })).toBeVisible();
  await expect(page.getByRole("link", { name: cancelled })).toHaveCount(0);

  await page.goto("/admin/orders?view=preparing");
  await expect(page.getByRole("heading", { level: 1, name: "Orders to Prepare" })).toBeVisible();
  await expect(page.getByRole("link", { name: paid })).toBeVisible();
  await expect(page.getByRole("link", { name: ready })).toHaveCount(0);

  await page.goto("/admin/orders?view=ready");
  await expect(page.getByRole("heading", { level: 1, name: "Ready for Delivery" })).toBeVisible();
  await expect(page.getByRole("link", { name: ready })).toBeVisible();
  await expect(page.getByRole("link", { name: paid })).toHaveCount(0);

  await page.goto("/admin/orders?view=today");
  await expect(page.getByRole("heading", { level: 1, name: "Today's Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: paid })).toHaveCount(0); // delivery is later

  // Revenue: products sold excludes the cancelled order (2 + 1 units, not 7).
  await page.goto("/admin/revenue?period=today");
  await expect(page.getByRole("heading", { level: 1, name: "Revenue" })).toBeVisible();
  const periods = page.getByRole("navigation", { name: "Revenue period" });
  await expect(periods.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("row").filter({ hasText: `View Cake ${sfx}` })).toContainText("3");
  for (const label of ["Paid", "Cancelled", "Refunded", "Net"]) {
    await expect(page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) }).first()).toBeVisible();
  }

  await periods.getByRole("link", { name: "All time" }).click();
  await expect(periods.getByRole("link", { name: "All time" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("All orders ever paid")).toBeVisible();
});

test("customers cannot open the dashboard or revenue", async ({ page }) => {
  const customer = await createAccount("Nosy Customer");
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  for (const path of ["/admin", "/admin/revenue", "/admin/orders?view=today"]) {
    await page.goto(path);
    await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
    await expect(page.getByText("Revenue details")).toHaveCount(0);
  }
});
