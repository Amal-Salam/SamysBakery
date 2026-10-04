import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// Mobile API menu content (mobile M1) against the storefront fixture menu:
// the same products, prices and availability the website shows.

type Fixture = { products: Record<string, { name: string; slug: string }> };

test("the app sees the same published menu as the website", async ({ request }) => {
  const { products } = JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture;
  const response = await request.get("/api/v1/menu");
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  expect(data.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const sourdough = data.products.find((p: { slug: string }) => p.slug === products.sourdough.slug);
  expect(sourdough).toMatchObject({
    name: products.sourdough.name,
    price: 6500,
    category: "Bread",
    availabilityStatus: "AVAILABLE",
  });
  expect(typeof sourdough.availableQuantity).toBe("number");
  if (sourdough.image) expect(sourdough.image.url).toMatch(/^https?:\/\/.+\/storage\/v1\/object\/public\/product-images\//);

  const one = await request.get(`/api/v1/menu/${products.sourdough.slug}`);
  expect((await one.json()).data).toEqual(sourdough);
});
