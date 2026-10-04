import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { accessTokenFor, createAccount } from "./helpers";

// Cart API (mobile M2): same rules as the website, server-evaluated prices,
// each customer only ever touches their own cart.

type Fixture = { products: Record<string, { name: string; slug: string }> };
const fixture = () => JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture;

async function productId(request: APIRequestContext, slug: string): Promise<string> {
  return (await (await request.get(`/api/v1/menu/${slug}`)).json()).data.id;
}

function as(token: string) {
  return { authorization: `Bearer ${token}` };
}

test("the cart API requires sign-in", async ({ request }) => {
  for (const [method, path] of [["get", "/api/v1/cart"], ["delete", "/api/v1/cart"], ["post", "/api/v1/cart/items"]] as const) {
    const response = await request[method](path, { data: {} });
    expect(response.status(), `${method} ${path}`).toBe(401);
  }
});

test("add, combine, update, remove and clear with server prices and stock rules", async ({ request }) => {
  const { products } = fixture();
  const [sourdough, banana, croissant] = await Promise.all([
    productId(request, products.sourdough.slug),
    productId(request, products.banana.slug),
    productId(request, products.croissant.slug),
  ]);
  const token = await accessTokenFor(await createAccount("Cart API Customer"));
  const headers = as(token);

  // Add; a client-sent price is ignored (server prices only).
  let response = await request.post("/api/v1/cart/items", { headers, data: { productId: sourdough, quantity: 2, price: 1 } });
  expect(response.status()).toBe(200);
  let cart = (await response.json()).data;
  expect(cart).toMatchObject({ itemCount: 2, subtotal: 13000, canCheckout: true });
  expect(cart.items[0]).toMatchObject({ productId: sourdough, quantity: 2, unitPrice: 6500, lineTotal: 13000, issue: null });

  // Same product combines.
  cart = (await (await request.post("/api/v1/cart/items", { headers, data: { productId: sourdough, quantity: 1 } })).json()).data;
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0].quantity).toBe(3);

  // Stock rules: more than available, sold out, not on the menu.
  response = await request.patch(`/api/v1/cart/items/${sourdough}`, { headers, data: { quantity: 11 } });
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toEqual({ code: "OUT_OF_STOCK", message: "Only 10 available." });
  response = await request.post("/api/v1/cart/items", { headers, data: { productId: croissant, quantity: 1 } });
  expect((await response.json()).error.code).toBe("OUT_OF_STOCK");
  response = await request.post("/api/v1/cart/items", {
    headers, data: { productId: "00000000-0000-4000-8000-000000000000", quantity: 1 },
  });
  expect((await response.json()).error.code).toBe("PRODUCT_UNAVAILABLE");

  // Validation.
  for (const data of [{ productId: sourdough, quantity: 0 }, { productId: sourdough, quantity: 1.5 }, { productId: "nope", quantity: 1 }]) {
    expect((await request.post("/api/v1/cart/items", { headers, data })).status()).toBe(400);
  }
  response = await request.post("/api/v1/cart/items", { headers: { ...headers, "content-type": "application/json" }, data: "{not json" });
  expect(response.status()).toBe(400);
  expect((await request.patch("/api/v1/cart/items/not-a-uuid", { headers, data: { quantity: 1 } })).status()).toBe(400);

  // Update, add another, remove one, clear.
  cart = (await (await request.patch(`/api/v1/cart/items/${sourdough}`, { headers, data: { quantity: 1 } })).json()).data;
  expect(cart.subtotal).toBe(6500);
  cart = (await (await request.post("/api/v1/cart/items", { headers, data: { productId: banana, quantity: 2 } })).json()).data;
  expect(cart).toMatchObject({ itemCount: 3, subtotal: 14500 });
  cart = (await (await request.delete(`/api/v1/cart/items/${sourdough}`, { headers })).json()).data;
  expect(cart.items.map((item: { productId: string }) => item.productId)).toEqual([banana]);
  cart = (await (await request.delete("/api/v1/cart", { headers })).json()).data;
  expect(cart).toMatchObject({ items: [], itemCount: 0, subtotal: 0, canCheckout: false });
});

test("customers only ever see and change their own cart", async ({ request }) => {
  const { products } = fixture();
  const sourdough = await productId(request, products.sourdough.slug);
  const banana = await productId(request, products.banana.slug);
  const [ada, bayo] = await Promise.all([createAccount("Cart Ada"), createAccount("Cart Bayo")]);
  const [adaToken, bayoToken] = await Promise.all([accessTokenFor(ada), accessTokenFor(bayo)]);

  await request.post("/api/v1/cart/items", { headers: as(bayoToken), data: { productId: banana, quantity: 2 } });
  await request.post("/api/v1/cart/items", { headers: as(adaToken), data: { productId: sourdough, quantity: 1 } });

  // Ada removes "banana" and clears — only her own cart is affected.
  await request.delete(`/api/v1/cart/items/${banana}`, { headers: as(adaToken) });
  await request.delete("/api/v1/cart", { headers: as(adaToken) });

  const bayoCart = (await (await request.get("/api/v1/cart", { headers: as(bayoToken) })).json()).data;
  expect(bayoCart.items).toEqual([expect.objectContaining({ productId: banana, quantity: 2 })]);
  const adaCart = (await (await request.get("/api/v1/cart", { headers: as(adaToken) })).json()).data;
  expect(adaCart.items).toEqual([]);
});
