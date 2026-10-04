import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { accessTokenFor, createAccount, service, uniqueSuffix } from "./helpers";

// Checkout, payment and orders API (mobile M3) through the Paystack test mock.
// Amounts come from the database, status from server-side verification, and
// customers only ever reach their own payments and orders.

const MOCK = "http://127.0.0.1:3999";
const as = (token: string) => ({ authorization: `Bearer ${token}` });

async function productWithStock(stock: number, price: number) {
  const { menuId } = JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as { menuId: string };
  const suffix = uniqueSuffix();
  const { data: product } = await service
    .from("products").insert({ name: `App Loaf ${suffix}`, slug: `app-loaf-${suffix}` }).select("id").single();
  const { data: wmp } = await service
    .from("weekly_menu_products")
    .insert({ weekly_menu_id: menuId, product_id: product!.id, name_snapshot: `App Loaf ${suffix}`, price, weekly_quantity: stock })
    .select("id").single();
  return wmp!.id as string;
}

async function customerReady(name: string) {
  const account = await createAccount(name);
  const { data: address } = await service
    .from("addresses")
    .insert({
      user_id: account.id, label: "Home", recipient_name: name, phone: "0803 000 0000",
      address_line: "9 App Street", city: "Abuja", state: "FCT", is_default: true,
    })
    .select("id").single();
  return { account, addressId: address!.id as string, token: await accessTokenFor(account) };
}

async function mockTransaction(request: APIRequestContext, reference: string) {
  const state = (await (await request.get(`${MOCK}/__state`)).json()) as {
    transactions: { reference: string; amount: number; callback_url?: string }[];
  };
  return state.transactions.find((tx) => tx.reference === reference);
}

test("checkout, payment and order endpoints require sign-in", async ({ request }) => {
  for (const [method, path] of [
    ["get", "/api/v1/checkout"], ["post", "/api/v1/checkout/review"], ["post", "/api/v1/payments"],
    ["get", "/api/v1/payments/SAMY-0123456789ABCDEF0123456789ABCDEF"], ["get", "/api/v1/orders"],
    ["get", "/api/v1/orders/SAM-1001"], ["post", "/api/v1/orders/SAM-1001/cancel"],
  ] as const) {
    expect((await request[method](path, { data: {} })).status(), `${method} ${path}`).toBe(401);
  }
});

test("review, pay, verify, list and cancel — all server-decided", async ({ page, request }) => {
  const loaf = await productWithStock(4, 3500);
  const ada = await customerReady("App Ada");
  const bayo = await customerReady("App Bayo");

  await request.post("/api/v1/cart/items", { headers: as(ada.token), data: { productId: loaf, quantity: 2 } });

  // Checkout context: saved address and database-chosen delivery dates.
  const context = (await (await request.get("/api/v1/checkout", { headers: as(ada.token) })).json()).data;
  expect(context.addresses.map((a: { id: string }) => a.id)).toEqual([ada.addressId]);
  expect(context.deliveryDates.length).toBeGreaterThan(0);
  const deliveryDate = context.deliveryDates[0] as string;
  for (const date of context.deliveryDates as string[]) {
    expect([0, 1]).not.toContain(new Date(`${date}T12:00:00Z`).getUTCDay()); // never Sun/Mon
  }

  // Review: the server's numbers; tampering is refused.
  let response = await request.post("/api/v1/checkout/review", {
    headers: as(ada.token), data: { deliveryDate, addressId: ada.addressId, specialNotes: "Ring twice", subtotal: 1 },
  });
  expect(response.status()).toBe(200);
  const summary = (await response.json()).data;
  expect(summary).toMatchObject({ subtotal: 7000, currency: "NGN", deliveryDate, specialNotes: "Ring twice" });
  response = await request.post("/api/v1/checkout/review", {
    headers: as(ada.token), data: { deliveryDate, addressId: bayo.addressId, specialNotes: "" },
  });
  expect(response.status()).toBe(404); // someone else's address
  response = await request.post("/api/v1/checkout/review", {
    headers: as(ada.token), data: { deliveryDate: "2030-01-06", addressId: ada.addressId, specialNotes: "" }, // a Sunday
  });
  expect((await response.json()).error.code).toBe("DELIVERY_DATE_INVALID");

  // Start payment: the amount sent to Paystack is the database's, and it returns to the app page.
  response = await request.post("/api/v1/payments", {
    headers: as(ada.token), data: { deliveryDate, addressId: ada.addressId, amount: 100 },
  });
  expect(response.status()).toBe(200);
  const { authorizationUrl, reference } = (await response.json()).data;
  expect(reference).toMatch(/^SAMY-[0-9A-F]{32}$/);
  expect(authorizationUrl).toBe(`${MOCK}/pay/${reference}`);
  const tx = await mockTransaction(request, reference);
  expect(tx?.amount).toBe(700_000);
  expect(tx?.callback_url).toMatch(/\/payment-return$/);

  // Before paying: pending. Another customer can't see (or trigger processing of) it.
  expect((await (await request.get(`/api/v1/payments/${reference}`, { headers: as(ada.token) })).json()).data).toEqual({ status: "PENDING" });
  expect((await request.get(`/api/v1/payments/${reference}`, { headers: as(bayo.token) })).status()).toBe(404);
  expect((await request.get("/api/v1/payments/not-a-reference", { headers: as(ada.token) })).status()).toBe(400);

  // The customer pays in the browser tab and lands on the static return page.
  await page.goto(authorizationUrl);
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page).toHaveURL(/\/payment-return/);
  await expect(page.getByText("Payment submitted.")).toBeVisible();
  await expect(page.getByText(/SAM-\d+/)).toHaveCount(0); // the page shows no order data

  // The app asks for the verified status.
  const status = (await (await request.get(`/api/v1/payments/${reference}`, { headers: as(ada.token) })).json()).data;
  expect(status).toEqual({ status: "CONFIRMED", orderNumber: expect.stringMatching(/^SAM-\d{4,}$/) });
  const orderNumber = status.orderNumber as string;

  // Orders: listed for Ada only; details; not found for Bayo.
  const orders = (await (await request.get("/api/v1/orders", { headers: as(ada.token) })).json()).data;
  expect(orders[0]).toMatchObject({ orderNumber, subtotal: 7000, orderStatus: "PAID" });
  expect((await (await request.get("/api/v1/orders", { headers: as(bayo.token) })).json()).data).toEqual([]);
  const detail = (await (await request.get(`/api/v1/orders/${orderNumber}`, { headers: as(ada.token) })).json()).data;
  expect(detail).toMatchObject({ orderNumber, canCancel: true, address: "9 App Street, Abuja, FCT" });
  expect((await request.get(`/api/v1/orders/${orderNumber}`, { headers: as(bayo.token) })).status()).toBe(404);
  expect((await request.post(`/api/v1/orders/${orderNumber}/cancel`, { headers: as(bayo.token) })).status()).toBe(404);
  expect((await request.get("/api/v1/orders/not-an-order", { headers: as(ada.token) })).status()).toBe(400);

  // Cancel: released stock, no refund, can't cancel twice.
  response = await request.post(`/api/v1/orders/${orderNumber}/cancel`, { headers: as(ada.token) });
  expect((await response.json()).data).toMatchObject({ orderStatus: "CANCELLED", paymentStatus: "PAID", canCancel: false });
  const { data: order } = await service.from("orders").select("id").eq("order_number", orderNumber).single();
  const { data: held } = await service
    .from("inventory_reservations").select("status").eq("order_id", order!.id).eq("reservation_type", "ORDER_CONFIRMED");
  expect(held).toEqual([{ status: "RELEASED" }]);
  response = await request.post(`/api/v1/orders/${orderNumber}/cancel`, { headers: as(ada.token) });
  expect(response.status()).toBe(409);
});

test("an abandoned payment reports FAILED and creates no order", async ({ page, request }) => {
  const loaf = await productWithStock(3, 2000);
  const customer = await customerReady("App Quitter");
  await request.post("/api/v1/cart/items", { headers: as(customer.token), data: { productId: loaf, quantity: 1 } });
  const { deliveryDates } = (await (await request.get("/api/v1/checkout", { headers: as(customer.token) })).json()).data;
  const { authorizationUrl, reference } = (
    await (await request.post("/api/v1/payments", {
      headers: as(customer.token), data: { deliveryDate: deliveryDates[0], addressId: customer.addressId },
    })).json()
  ).data;

  await page.goto(authorizationUrl);
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await expect(page).toHaveURL(/\/payment-return/);

  const status = (await (await request.get(`/api/v1/payments/${reference}`, { headers: as(customer.token) })).json()).data;
  expect(status).toEqual({ status: "FAILED" });
  expect((await (await request.get("/api/v1/orders", { headers: as(customer.token) })).json()).data).toEqual([]);
  // The cart is kept so the customer can try again.
  const cart = (await (await request.get("/api/v1/cart", { headers: as(customer.token) })).json()).data;
  expect(cart.itemCount).toBe(1);
});


