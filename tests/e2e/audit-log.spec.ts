import { expect, test } from "@playwright/test";

import { createAccount, service, signInAsAdmin, uniqueSuffix } from "./helpers";

// Audit log page (Milestone 17 owner decision): read-only, filterable, linked
// from the Business navigation group. Admin only.

test("admins browse and filter the audit log; entries link to their records", async ({ page }) => {
  const sfx = uniqueSuffix();
  const admin = await createAccount(`Audit Admin ${sfx}`, "ADMIN"); // promotion is itself audited
  const customer = await createAccount(`Audit Customer ${sfx}`);
  const { data: order } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: "2030-01-08", recipient_name: "Audit", phone: "0803", email: customer.email,
      delivery_address: "2 Ledger Lane", delivery_city: "Abuja", delivery_state: "FCT", subtotal: 3000,
      paid_at: new Date().toISOString(),
    } as never)
    .select("order_number")
    .single();

  await signInAsAdmin(page, admin);
  await page.goto(`/admin/orders/${order!.order_number}`);
  await page.getByLabel("Change status to").selectOption({ label: "Received" });
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Current status: Received")).toBeVisible();

  // Through the navigation.
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" }).filter({ visible: true });
  if (!(await nav.isVisible())) await page.getByText("Admin menu").click();
  await page.getByRole("navigation", { name: "Admin" }).filter({ visible: true }).getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await expect(page.getByText("Entries can't be edited or deleted.")).toBeVisible();

  // Filter: role changes include this admin's promotion by the operator script.
  const filter = page.getByRole("search", { name: "Filter the audit log" });
  await filter.getByLabel("Event").selectOption({ label: "Account role changed" });
  await filter.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/action=ACCOUNT_ADMIN_ACTION/);
  const promotion = page.getByRole("listitem").filter({ hasText: `Role changed: Customer → Admin (Audit Admin ${sfx})` });
  await expect(promotion).toContainText("Changed by the operator script");
  await expect(promotion).toContainText("System");

  // Filter: status changes; the entry names the admin and links to the order.
  await filter.getByLabel("Event").selectOption({ label: "Order status changed" });
  await filter.getByRole("button", { name: "Filter" }).click();
  const change = page.getByRole("listitem").filter({ hasText: `Audit Admin ${sfx}` }).first();
  await expect(change).toContainText("Status changed: Paid → Received");
  await change.getByRole("link", { name: order!.order_number }).click();
  await expect(page.getByRole("heading", { level: 1, name: order!.order_number })).toBeVisible();
  await expect(page.getByRole("region", { name: "Activity" }).getByText("Status changed: Paid → Received")).toBeVisible();
});

test("the audit log pages through older entries", async ({ page }) => {
  // 55 real events (Product Library edits by the operator) → more than one page.
  const sfx = uniqueSuffix();
  const { data: product } = await service
    .from("products")
    .insert({ name: `Paging Loaf ${sfx}`, slug: `paging-loaf-${sfx}` })
    .select("id")
    .single();
  for (let i = 1; i <= 55; i += 1) {
    await service.from("products").update({ description: `Edit ${i}` }).eq("id", product!.id);
  }
  // Keep it out of the Product Library list.
  await service.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", product!.id);

  const admin = await createAccount("Paging Admin", "ADMIN");
  await signInAsAdmin(page, admin);
  await page.goto("/admin/audit?action=PRODUCT_UPDATED");
  const times = () => page.locator("li time").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("datetime")!));
  const firstPage = await times();
  expect(firstPage).toHaveLength(50);

  await page.getByRole("link", { name: "Older entries" }).click();
  await expect(page).toHaveURL(/action=PRODUCT_UPDATED&at=.*&id=/);
  await expect(page.getByRole("link", { name: "Newest" })).toBeVisible();
  const secondPage = await times();
  expect(secondPage.length).toBeGreaterThan(0);
  expect(new Date(secondPage[0]).getTime()).toBeLessThanOrEqual(new Date(firstPage[firstPage.length - 1]).getTime());
});

test("customers cannot see the audit log", async ({ page }) => {
  const customer = await createAccount("Audit Snoop");
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin/audit");
  await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit log" })).toHaveCount(0);
});
