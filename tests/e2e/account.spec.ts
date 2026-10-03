import { expect, test, type Page } from "@playwright/test";

import { createAccount, service, type Account } from "./helpers";

// Customer account (Milestone 13): profile, addresses, order history/detail,
// and account deletion (delete + anonymize; owner decisions).

async function signIn(page: Page, account: Account, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

async function createOrder(account: Account, status: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("orders")
    .insert({
      user_id: account.id,
      delivery_date: "2030-01-03",
      recipient_name: "Account Tester",
      phone: "0803 222 3333",
      email: account.email,
      delivery_address: "21 History Lane",
      delivery_city: "Abuja",
      delivery_state: "FCT",
      special_notes: "Gate code 1234",
      subtotal: 11000,
      paid_at: new Date().toISOString(),
      order_status: status,
      ...(status === "DELIVERED" ? { delivered_at: new Date().toISOString() } : {}),
      ...extra,
    } as never)
    .select("id, order_number")
    .single();
  expect(error).toBeNull();
  await service.from("order_items").insert([
    { order_id: data!.id, product_name: "History Sourdough", unit_price: 4000, quantity: 2, line_total: 8000 },
    { order_id: data!.id, product_name: "History Bun", unit_price: 1500, quantity: 2, line_total: 3000 },
  ]);
  return data!.order_number;
}

test("customer updates their profile", async ({ page }) => {
  const customer = await createAccount("Profile Tester");
  await signIn(page, customer, "/account/profile");

  await page.getByLabel("Phone number (optional)").fill("abc");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter a valid phone number, e.g. 0803 123 4567.")).toBeVisible();

  await page.getByLabel("Full name").fill("Profile Tester Renamed");
  await page.getByLabel("Phone number (optional)").fill("0803 999 8888");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();

  const { data } = await service.from("profiles").select("full_name, phone, role").eq("id", customer.id).single();
  expect(data).toEqual({ full_name: "Profile Tester Renamed", phone: "0803 999 8888", role: "CUSTOMER" });
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Hello, Profile Tester Renamed" })).toBeVisible();
});

test("customer manages saved addresses", async ({ page }) => {
  const customer = await createAccount("Address Tester");
  await signIn(page, customer, "/account/addresses");
  await expect(page.getByText("No saved addresses yet.")).toBeVisible();

  const add = page.getByRole("region", { name: "Add an address" });
  async function addAddress(label: string, line: string) {
    await add.getByLabel("Label").fill(label);
    await add.getByLabel("Recipient's name").fill("Address Tester");
    await add.getByLabel("Phone number").fill("0803 444 5555");
    await add.getByLabel("Street address").fill(line);
    await add.getByLabel("City").fill("Abuja");
    await add.getByLabel("State").fill("FCT");
    await add.getByRole("button", { name: "Save address" }).click();
    await expect(add.getByRole("status").filter({ hasText: "Address saved." })).toBeVisible();
  }

  await addAddress("Home", "1 First Road");
  await addAddress("Office", "2 Second Road");
  const list = page.getByRole("list", { name: "Saved addresses" });
  const home = list.getByRole("listitem").filter({ hasText: "1 First Road" });
  const office = list.getByRole("listitem").filter({ hasText: "2 Second Road" });
  await expect(home.getByText("Default")).toBeVisible(); // first address becomes default

  await office.getByRole("button", { name: "Make default" }).click();
  await expect(office.getByText("Default")).toBeVisible();
  await expect(home.getByText("Default", { exact: true })).toHaveCount(0);

  await home.getByText("Edit Home").click();
  await home.getByLabel("Street address").fill("1 First Road, Flat 3");
  await home.getByRole("button", { name: "Save address" }).click();
  await expect(list.getByText("1 First Road, Flat 3, Abuja, FCT")).toBeVisible();

  // Deleting the default promotes the most recently added remaining address.
  await office.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete address" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByRole("listitem").getByText("Default")).toBeVisible();

  const { data } = await service.from("addresses").select("address_line, is_default").eq("user_id", customer.id);
  expect(data).toEqual([{ address_line: "1 First Road, Flat 3", is_default: true }]);
});

test("customer sees their order history and details, never another customer's", async ({ page }) => {
  const customer = await createAccount("History Tester");
  const other = await createAccount("Other Customer");
  const mine = await createOrder(customer, "BAKING");
  const theirs = await createOrder(other, "PAID");

  await signIn(page, customer, "/account/orders");
  const entry = page.getByRole("list", { name: "Your orders" }).getByRole("listitem").filter({ hasText: mine });
  await expect(entry.getByText("Baking/Preparing")).toBeVisible();
  await expect(entry.getByText("2 × History Sourdough, 2 × History Bun")).toBeVisible();
  await expect(entry.getByText("₦11,000")).toBeVisible();
  await expect(entry.getByText("Delivery: Thursday 3 January 2030")).toBeVisible();
  await expect(page.getByText(theirs)).toHaveCount(0);

  await entry.getByRole("link", { name: mine }).click();
  await expect(page.getByRole("heading", { level: 1, name: mine })).toBeVisible();
  for (const text of ["2 × ₦4,000", "₦8,000", "21 History Lane, Abuja, FCT", "Gate code 1234", "Paid"]) {
    await expect(page.getByText(text).first()).toBeVisible();
  }

  const response = await page.goto(`/account/orders/${theirs}`);
  expect(response?.status()).toBe(404);
});

test("account deletion is blocked while an order is in progress, then anonymizes", async ({ page }) => {
  const customer = await createAccount("Leaving Tester");
  const inProgress = await createOrder(customer, "READY");
  await service.from("addresses").insert({
    user_id: customer.id, label: "Home", recipient_name: "Leaving Tester", phone: "0803",
    address_line: "Secret Street", city: "Abuja", state: "FCT", is_default: true,
  });

  await signIn(page, customer, "/account/profile");
  const danger = page.getByRole("region", { name: "Delete account" });

  // Confirmation is required.
  await danger.getByRole("button", { name: "Delete my account" }).click();
  await expect(danger.getByText("Type DELETE to confirm.").first()).toBeVisible();

  // Blocked while an order is still in progress.
  await danger.getByLabel("Type DELETE to confirm").fill("DELETE");
  await danger.getByRole("button", { name: "Delete my account" }).click();
  await expect(danger.getByRole("alert")).toContainText("still being prepared or delivered");

  // Once it's delivered, deletion goes ahead.
  await service.from("orders").update({ order_status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("order_number", inProgress);
  await danger.getByLabel("Type DELETE to confirm").fill("DELETE");
  await danger.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL("/?account=deleted");
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign in" })).toBeVisible();

  // Data: login and profile gone, order kept but anonymized, address gone.
  const { data: authUser } = await service.auth.admin.getUserById(customer.id);
  expect(authUser.user).toBeNull();
  const { data: order } = await service
    .from("orders").select("user_id, recipient_name, email, delivery_address, special_notes, subtotal").eq("order_number", inProgress).single();
  expect(order).toEqual({
    user_id: null, recipient_name: "Deleted customer", email: "deleted-customer@invalid",
    delivery_address: "Removed", special_notes: null, subtotal: 11000,
  });
  const { count } = await service.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(count).toBe(0);

  // The old login no longer works.
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
});
