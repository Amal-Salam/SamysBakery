import { expect, test, type Page } from "@playwright/test";

import { clearActiveMenus, createAccount, service, signInAsAdmin, uniqueSuffix, type Account } from "./helpers";

// The mandatory admin journey (AGENTS.md §48; Implementation Spec §39) as ONE
// continuous flow through the real UI:
// Admin Login → Dashboard → Product Library → Create Product → Create Weekly
// Menu → Add Product → Set Price → Set Quantity → Publish → Customer Orders →
// View Order → Update Status (Received → Preparing → Ready → Handed to
// Delivery → Delivered) → Inventory.
// Runs serially in its own project (it needs the single current-menu slot).

test.describe.configure({ mode: "serial" });

let admin: Account;
const sfx = uniqueSuffix();
const product = `Journey Brioche ${sfx}`;

test.beforeAll(async () => {
  await clearActiveMenus();
  admin = await createAccount(`Journey Admin ${sfx}`, "ADMIN");
});

test.afterAll(async () => {
  await clearActiveMenus();
});

async function nav(page: Page, label: string) {
  const sidebar = page.getByRole("navigation", { name: "Admin" }).filter({ visible: true });
  if (!(await sidebar.isVisible())) await page.getByText("Admin menu").click();
  await page.getByRole("navigation", { name: "Admin" }).filter({ visible: true }).getByRole("link", { name: label, exact: true }).click();
}

test("admin builds and publishes the week, then fulfils an order end to end", async ({ page }) => {
  test.setTimeout(120_000);

  // Admin Login → Dashboard.
  await signInAsAdmin(page, admin);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  // Product Library → Create Product.
  await nav(page, "Product Library");
  await page.getByRole("link", { name: "Add product" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill(product);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Bread" });
  await page.getByLabel("Description", { exact: true }).fill("Buttery and golden.");
  await page.getByLabel("Ingredients", { exact: true }).fill("Flour, butter, eggs");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("heading", { level: 1, name: product })).toBeVisible();

  // Create Weekly Menu → Add Product → Set Price → Set Quantity → Publish.
  await nav(page, "Create New Week");
  await page.getByRole("button", { name: "Create week" }).click();
  await expect(page).toHaveURL("/admin/menu?created=1");
  const form = page.getByRole("region", { name: "Add from Product Library" });
  await form.getByLabel("Product", { exact: true }).selectOption({ label: `${product} (Bread)` });
  await form.getByLabel("Weekly price (₦)").fill("7,000");
  await form.getByLabel("Weekly quantity").fill("10");
  await form.getByLabel("Low-stock threshold").fill("2");
  await form.getByRole("button", { name: "Add to menu" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Product added to the menu." })).toBeVisible();
  await page.getByRole("button", { name: "Publish menu" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish menu" }).click();
  await expect(page.getByText("Published — customers can order")).toBeVisible();

  // A customer orders 3 (the customer side is customer-journey.spec.ts).
  const customer = await createAccount(`Journey Buyer ${sfx}`);
  const { data: wmp } = await service.from("weekly_menu_products").select("id").eq("name_snapshot", product).single();
  const { data: order } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: "2030-01-08", recipient_name: `Journey Buyer ${sfx}`, phone: "0803",
      email: customer.email, delivery_address: "4 Fulfil Way", delivery_city: "Abuja", delivery_state: "FCT",
      subtotal: 21000, paid_at: new Date().toISOString(),
    } as never)
    .select("id, order_number")
    .single();
  await service.from("order_items").insert({
    order_id: order!.id, weekly_menu_product_id: wmp!.id, product_name: product, unit_price: 7000, quantity: 3, line_total: 21000,
  });
  await service.from("inventory_reservations").insert({
    weekly_menu_product_id: wmp!.id, order_id: order!.id, quantity: 3, reservation_type: "ORDER_CONFIRMED",
  });

  // Customer Orders → View Order.
  await nav(page, "Orders");
  await page.getByRole("link", { name: order!.order_number }).click();
  await expect(page.getByRole("heading", { level: 1, name: order!.order_number })).toBeVisible();
  await expect(page.getByText("Current status: Paid")).toBeVisible();

  // Update Status through the whole lifecycle.
  const select = page.getByLabel("Change status to");
  for (const status of ["Received", "Baking/Preparing", "Ready", "Handed to delivery", "Delivered"]) {
    await select.selectOption({ label: status });
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(`Current status: ${status}`)).toBeVisible();
  }
  const activity = page.getByRole("region", { name: "Activity" });
  await expect(activity.getByText("Status changed: Handed to delivery → Delivered")).toBeVisible();
  const { data: delivered } = await service.from("orders").select("order_status, delivered_at").eq("id", order!.id).single();
  expect(delivered?.order_status).toBe("DELIVERED");
  expect(delivered?.delivered_at).not.toBeNull();

  // Inventory: 10 made, 3 sold → 7 available.
  await nav(page, "Inventory");
  const row = page.getByRole("row").filter({ hasText: product });
  await expect(row.getByRole("cell")).toHaveText([product, "10", "0", "0", "3", "7", "2", "Available"]);
});
