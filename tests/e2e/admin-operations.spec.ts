import { expect, test } from "@playwright/test";

import { createAccount, service, signInAsAdmin, uniqueSuffix, type Account } from "./helpers";

// Admin operations (Milestone 16): order search, customer lookup and history.
// Inventory runs in the serial admin-menu project (admin-weekly-menu.spec.ts),
// because it needs the single current menu.

async function createOrder(customer: Account, name: string, deliveryDate: string) {
  const { data, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: deliveryDate, recipient_name: name, phone: "0803",
      email: customer.email, delivery_address: "8 Lookup Lane", delivery_city: "Abuja", delivery_state: "FCT",
      subtotal: 4000, paid_at: new Date().toISOString(),
    } as never)
    .select("order_number")
    .single();
  expect(error).toBeNull();
  return data!.order_number as string;
}

test("admin finds an order by number and filters by delivery date", async ({ page }) => {
  const admin = await createAccount("Search Admin", "ADMIN");
  const customer = await createAccount("Search Customer");
  const first = await createOrder(customer, "Search Customer", "2030-01-08"); // Tuesday
  const second = await createOrder(customer, "Search Customer", "2030-01-09");

  await signInAsAdmin(page, admin);
  await page.goto("/admin/orders");
  const search = page.getByRole("search", { name: "Find orders" });

  // Lower-case and without the prefix both work.
  await search.getByLabel("Order number").fill(first.replace("SAM-", ""));
  await search.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: first })).toBeVisible();
  await expect(page.getByRole("link", { name: second })).toHaveCount(0);
  await page.getByRole("link", { name: first }).click();
  await expect(page.getByRole("heading", { level: 1, name: first })).toBeVisible();

  await page.goto("/admin/orders?q=not-an-order");
  await expect(page.getByRole("alert").filter({ hasText: "Enter an order number like SAM-1001." })).toBeVisible();
  await expect(page.getByText("No orders match.")).toBeVisible();

  await page.goto("/admin/orders?date=2030-01-09");
  await expect(page.getByRole("link", { name: second })).toBeVisible();
  await expect(page.getByRole("link", { name: first })).toHaveCount(0);

  // An impossible date is ignored rather than breaking the page.
  await page.goto("/admin/orders?date=2030-13-45");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
});

test("admin looks up a customer and sees their order history", async ({ page }) => {
  const admin = await createAccount("Lookup Admin", "ADMIN");
  const sfx = uniqueSuffix();
  const customer = await createAccount(`Lookup Ngozi ${sfx}`);
  await service.from("profiles").update({ phone: `0807${sfx.replace(/\D/g, "").padEnd(7, "1").slice(0, 7)}` }).eq("id", customer.id);
  const order = await createOrder(customer, `Lookup Ngozi ${sfx}`, "2030-01-10");
  await createAccount(`Lookup Other ${sfx}`);

  await signInAsAdmin(page, admin);
  await page.goto("/admin/customers");
  await page.getByLabel("Name, email or phone").fill(`ngozi ${sfx}`);
  await page.getByRole("button", { name: "Search" }).click();

  const row = page.getByRole("row").filter({ hasText: `Lookup Ngozi ${sfx}` });
  await expect(row).toContainText(customer.email);
  await expect(row.getByRole("cell").nth(3)).toHaveText("1");
  await expect(row.getByRole("link", { name: order })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: `Lookup Other ${sfx}` })).toHaveCount(0);

  // Search by email, then open the customer.
  await page.goto(`/admin/customers?q=${encodeURIComponent(customer.email)}`);
  await page.getByRole("link", { name: `Lookup Ngozi ${sfx}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Lookup Ngozi ${sfx}` })).toBeVisible();
  await expect(page.getByText(customer.email)).toBeVisible();
  const history = page.getByRole("region", { name: "Order history" });
  await expect(history.getByRole("link", { name: order })).toBeVisible();

  // From the order back to the customer.
  await history.getByRole("link", { name: order }).click();
  await page.getByRole("link", { name: `Lookup Ngozi ${sfx}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Lookup Ngozi ${sfx}` })).toBeVisible();

  await page.goto("/admin/customers/not-a-uuid");
  await expect(page.getByText("Page not found.")).toBeVisible();
  await page.goto(`/admin/customers/${admin.id}`); // admins are not customer records
  await expect(page.getByText("Page not found.")).toBeVisible();
});

test("customers cannot open admin operations pages", async ({ page }) => {
  const customer = await createAccount("Curious Customer");
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  for (const path of ["/admin/inventory", "/admin/customers", `/admin/customers/${customer.id}`]) {
    await page.goto(path);
    await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
    await expect(page.getByText(customer.email)).toHaveCount(0);
  }
});
