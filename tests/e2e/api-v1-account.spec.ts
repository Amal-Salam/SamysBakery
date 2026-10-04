import { expect, test } from "@playwright/test";

import { accessTokenFor, createAccount, service } from "./helpers";

// Account API for the mobile app (A1): profile, addresses and account deletion,
// reusing the website's rules. Customers only ever touch their own data.

const as = (token: string) => ({ authorization: `Bearer ${token}` });
const address = (label: string, extra: Record<string, string> = {}) => ({
  label, recipientName: "Ada Obi", phone: "0803 123 4567", addressLine: `${label} Street 1`, city: "Abuja", state: "FCT", additionalInfo: "", ...extra,
});

test("account endpoints require sign-in", async ({ request }) => {
  const id = "00000000-0000-4000-8000-000000000000";
  for (const [method, path] of [
    ["patch", "/api/v1/me"], ["delete", "/api/v1/me"], ["get", "/api/v1/addresses"], ["post", "/api/v1/addresses"],
    ["patch", `/api/v1/addresses/${id}`], ["delete", `/api/v1/addresses/${id}`], ["post", `/api/v1/addresses/${id}/default`],
  ] as const) {
    expect((await request[method](path, { data: {} })).status(), `${method} ${path}`).toBe(401);
  }
});

test("profile: edit name and phone; role can't be changed", async ({ request }) => {
  const ada = await createAccount("Profile Ada");
  const token = await accessTokenFor(ada);

  let response = await request.patch("/api/v1/me", { headers: as(token), data: { fullName: "  Ada Okafor ", phone: "0803 555 0101", role: "ADMIN" } });
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toEqual({ id: ada.id, email: ada.email, fullName: "Ada Okafor", phone: "0803 555 0101", role: "CUSTOMER" });
  const { data: row } = await service.from("profiles").select("full_name, phone, role").eq("id", ada.id).single();
  expect(row).toEqual({ full_name: "Ada Okafor", phone: "0803 555 0101", role: "CUSTOMER" });
  expect((await (await request.get("/api/v1/me", { headers: as(token) })).json()).data.fullName).toBe("Ada Okafor");

  // Phone is optional; validation matches the website.
  response = await request.patch("/api/v1/me", { headers: as(token), data: { fullName: "Ada Okafor", phone: "" } });
  expect((await response.json()).data.phone).toBeNull();
  for (const data of [{ fullName: "", phone: "" }, { fullName: "Ada", phone: "not a phone" }, { fullName: "x".repeat(121), phone: "" }]) {
    expect((await request.patch("/api/v1/me", { headers: as(token), data })).status()).toBe(400);
  }
});

test("addresses: add, edit, default, delete — and never someone else's", async ({ request }) => {
  const [ada, bayo] = await Promise.all([createAccount("Address Ada"), createAccount("Address Bayo")]);
  const [adaToken, bayoToken] = await Promise.all([accessTokenFor(ada), accessTokenFor(bayo)]);

  // First address becomes the default; the second doesn't.
  let list = (await (await request.post("/api/v1/addresses", { headers: as(adaToken), data: address("Home") })).json()).data;
  expect(list).toEqual([expect.objectContaining({ label: "Home", isDefault: true, addressLine: "Home Street 1" })]);
  list = (await (await request.post("/api/v1/addresses", { headers: as(adaToken), data: address("Office", { additionalInfo: "Gate B" }) })).json()).data;
  const home = list.find((a: { label: string }) => a.label === "Home");
  const office = list.find((a: { label: string }) => a.label === "Office");
  expect(office).toMatchObject({ isDefault: false, additionalInfo: "Gate B" });

  // Validation.
  expect((await request.post("/api/v1/addresses", { headers: as(adaToken), data: address("Bad", { phone: "abc" }) })).status()).toBe(400);
  expect((await request.post("/api/v1/addresses", { headers: as(adaToken), data: address("Bad", { city: "" }) })).status()).toBe(400);
  expect((await request.patch("/api/v1/addresses/not-a-uuid", { headers: as(adaToken), data: address("X") })).status()).toBe(400);

  // Edit and set default.
  list = (await (await request.patch(`/api/v1/addresses/${office.id}`, { headers: as(adaToken), data: address("Office", { city: "Lagos" }) })).json()).data;
  expect(list.find((a: { id: string }) => a.id === office.id).city).toBe("Lagos");
  list = (await (await request.post(`/api/v1/addresses/${office.id}/default`, { headers: as(adaToken) })).json()).data;
  expect(list[0]).toMatchObject({ id: office.id, isDefault: true });
  expect(list.find((a: { id: string }) => a.id === home.id).isDefault).toBe(false);

  // Bayo can't see, edit, default or delete Ada's address.
  expect((await (await request.get("/api/v1/addresses", { headers: as(bayoToken) })).json()).data).toEqual([]);
  expect((await request.patch(`/api/v1/addresses/${home.id}`, { headers: as(bayoToken), data: address("Hacked") })).status()).toBe(404);
  expect((await request.post(`/api/v1/addresses/${home.id}/default`, { headers: as(bayoToken) })).status()).toBe(404);
  expect((await request.delete(`/api/v1/addresses/${home.id}`, { headers: as(bayoToken) })).status()).toBe(404);
  const { data: untouched } = await service.from("addresses").select("label").eq("id", home.id).single();
  expect(untouched?.label).toBe("Home");

  // Deleting the default promotes the remaining address.
  list = (await (await request.delete(`/api/v1/addresses/${office.id}`, { headers: as(adaToken) })).json()).data;
  expect(list).toEqual([expect.objectContaining({ id: home.id, isDefault: true })]);
});

test("delete account: confirmation required, blocked while an order is in progress, then gone", async ({ request }) => {
  const customer = await createAccount("Leaving Customer");
  const token = await accessTokenFor(customer);
  await request.post("/api/v1/addresses", { headers: as(token), data: address("Home") });
  const { data: order } = await service
    .from("orders")
    .insert({
      user_id: customer.id, delivery_date: "2030-01-08", recipient_name: "Leaving Customer", phone: "0803", email: customer.email,
      delivery_address: "1 Exit Road", delivery_city: "Abuja", delivery_state: "FCT", subtotal: 3000, paid_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();

  let response = await request.delete("/api/v1/me", { headers: as(token), data: { confirmation: "delete" } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.message).toBe("Type DELETE to confirm.");

  response = await request.delete("/api/v1/me", { headers: as(token), data: { confirmation: "DELETE" } });
  expect(response.status()).toBe(409);
  expect((await response.json()).error.message).toMatch(/still being prepared or delivered/);

  await service.from("orders").update({ order_status: "DELIVERED", delivered_at: new Date().toISOString() } as never).eq("id", order!.id);
  response = await request.delete("/api/v1/me", { headers: as(token), data: { confirmation: "DELETE" } });
  expect(response.status()).toBe(200);

  // The login is gone; the same token no longer works; the past order is kept, anonymized.
  expect((await request.get("/api/v1/me", { headers: as(token) })).status()).toBe(401);
  const { data: user } = await service.auth.admin.getUserById(customer.id);
  expect(user.user).toBeNull();
  const { data: kept } = await service.from("orders").select("user_id, recipient_name").eq("id", order!.id).single();
  expect(kept?.user_id).toBeNull();
  expect(kept?.recipient_name).not.toBe("Leaving Customer");
  const { count } = await service.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", customer.id);
  expect(count).toBe(0);
});
