import { writeFileSync } from "node:fs";

import { expect, test as setup } from "@playwright/test";

import { TINY_PNG, clearActiveMenus, service, uniqueSuffix } from "./helpers";

// Publishes a fixture menu for the read-only storefront tests (local stack only).
export const FIXTURE_FILE = "tests/e2e/.storefront-fixture.json";

// The empty-state check clears menus, so it must run before publishing.
setup.describe.configure({ mode: "serial" });

setup("storefront shows the empty state when no menu is published", async ({ page }) => {
  await clearActiveMenus();
  await page.goto("/");
  await expect(page.getByText("No products are currently available.")).toBeVisible();
  await page.goto("/menu");
  await expect(page.getByText("No products are currently available.")).toBeVisible();
});

setup("publish the storefront fixture menu", async () => {
  // Deterministic delivery dates whatever the time of day (restored in teardown).
  await service.from("system_settings").upsert({ key: "ORDER_CUTOFF_TIME", value: "23:59" });

  const suffix = uniqueSuffix();
  const { data: categories } = await service.from("categories").select("id, slug");
  const categoryId = (slug: string) => categories!.find((category) => category.slug === slug)?.id ?? null;

  const fixtures = [
    { key: "sourdough", name: `Store Sourdough ${suffix}`, category: "bread", price: 6500, quantity: 10, threshold: 2, photo: true },
    { key: "cake", name: `Store Chocolate Cake ${suffix}`, category: "cakes", price: 25000, quantity: 2, threshold: 3, photo: false },
    { key: "croissant", name: `Store Croissant ${suffix}`, category: "pastries", price: 2000, quantity: 0, threshold: 2, photo: false },
    { key: "banana", name: `Store Banana Bread ${suffix}`, category: null, price: 4000, quantity: 5, threshold: 0, photo: false },
  ];

  const { data: products, error } = await service
    .from("products")
    .insert(
      fixtures.map((fixture) => ({
        name: fixture.name,
        slug: `store-${fixture.key}-${suffix}`,
        category_id: fixture.category ? categoryId(fixture.category) : null,
        description: `Description of ${fixture.name}.`,
        ingredients: `Ingredients of ${fixture.name}`,
      }))
    )
    .select("id, name, slug");
  expect(error).toBeNull();

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const { data: weekStart } = await service.rpc("menu_week_start_for", { today });
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 4);

  const { data: menu } = await service
    .from("weekly_menus")
    .insert({
      week_start: weekStart as string,
      week_end: end.toISOString().slice(0, 10),
      status: "PUBLISHED",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const result: Record<string, { name: string; slug: string }> = {};
  for (const fixture of fixtures) {
    const product = products!.find((row) => row.name === fixture.name)!;
    let imagePath: string | null = null;
    if (fixture.photo) {
      imagePath = `products/${product.id}/store.png`;
      await service.storage.from("product-images").upload(imagePath, TINY_PNG, { contentType: "image/png" });
      await service.from("product_images").insert({ product_id: product.id, storage_path: imagePath, alt_text: `${fixture.name} on a board` });
    }
    const { error: wmpError } = await service.from("weekly_menu_products").insert({
      weekly_menu_id: menu!.id,
      product_id: product.id,
      name_snapshot: fixture.name,
      description_snapshot: `Description of ${fixture.name}.`,
      ingredients_snapshot: `Ingredients of ${fixture.name}`,
      image_snapshot: imagePath,
      price: fixture.price,
      weekly_quantity: fixture.quantity,
      low_stock_threshold: fixture.threshold,
    });
    expect(wmpError).toBeNull();
    result[fixture.key] = { name: fixture.name, slug: product.slug };
  }

  // A library-only product (never on the published menu) must not be reachable.
  const { data: hidden } = await service
    .from("products")
    .insert({ name: `Store Hidden ${suffix}`, slug: `store-hidden-${suffix}`, description: "", ingredients: "" })
    .select("slug")
    .single();
  result.hidden = { name: `Store Hidden ${suffix}`, slug: hidden!.slug };

  writeFileSync(FIXTURE_FILE, JSON.stringify({ menuId: menu!.id, products: result }, null, 2));
});
