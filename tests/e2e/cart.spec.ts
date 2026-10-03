import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { createAccount, service } from "./helpers";

// Cart (Milestone 7) against the fixture menu from storefront.setup.ts:
//   sourdough 10 available · cake 2 (low stock) · croissant sold out · banana 5.
// The cart never reserves stock, so these tests leave availability unchanged.

type Fixture = { menuId: string; products: Record<string, { name: string; slug: string }> };
let products: Fixture["products"];
test.beforeAll(() => {
  products = (JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture).products;
});

const cartButton = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /^Cart/ });

async function addFromProductPage(page: Page, slug: string, quantity: number) {
  await page.goto(`/menu/${slug}`);
  await page.getByLabel("Quantity", { exact: true }).fill(String(quantity));
  await page.getByRole("button", { name: "Add to Cart" }).click();
}

async function weeklyMenuProductId(name: string) {
  const { data } = await service.from("weekly_menu_products").select("id").eq("name_snapshot", name).single();
  return data!.id;
}

test("guest adds to cart, quantities combine, and stock limits are enforced", async ({ page }) => {
  await expect(async () => {
    await page.goto("/");
    await expect(cartButton(page)).toHaveAccessibleName("Cart, empty");
  }).toPass();

  await addFromProductPage(page, products.sourdough.slug, 2);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await expect(page).toHaveURL(`/menu/${products.sourdough.slug}`); // stays on the product page
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 2 items");

  // Same product again combines quantities.
  await page.getByLabel("Quantity", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 5 items");

  // Over the available stock (10) is refused server-side.
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Only 10 available, and you already have 5 in your cart." })
  ).toBeVisible();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 5 items");

  // The cart survives navigation; the drawer summarises it.
  await page.goto("/menu");
  await cartButton(page).click();
  const drawer = page.getByRole("dialog", { name: "Your Cart" });
  await expect(drawer.getByText(products.sourdough.name)).toBeVisible();
  await expect(drawer.getByText("5 × ₦6,500")).toBeVisible();
  await expect(drawer.getByText("₦32,500").first()).toBeVisible();
  await drawer.getByRole("link", { name: "View Cart" }).click();
  await expect(page).toHaveURL("/cart");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("sold-out products cannot be added", async ({ page }) => {
  await page.goto(`/menu/${products.croissant.slug}`);
  await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add to Cart" })).toHaveCount(0);
});

test("cart page manages quantities, removal and clearing", async ({ page }) => {
  await addFromProductPage(page, products.cake.slug, 1);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await addFromProductPage(page, products.banana.slug, 2);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Your Cart" })).toBeVisible();
  const cake = page.getByRole("listitem").filter({ hasText: products.cake.name });
  const banana = page.getByRole("listitem").filter({ hasText: products.banana.name });

  // ₦25,000 × 1 + ₦4,000 × 2
  await expect(page.getByRole("complementary").getByText("₦33,000")).toBeVisible();

  // Cake has only 2 available: + stops there.
  await cake.getByRole("button", { name: `Increase quantity of ${products.cake.name}` }).click();
  await expect(cake.getByLabel("Quantity 2")).toBeVisible();
  await expect(cake.getByRole("button", { name: `Increase quantity of ${products.cake.name}` })).toBeDisabled();
  await expect(page.getByRole("complementary").getByText("₦58,000")).toBeVisible();

  await banana.getByRole("button", { name: `Decrease quantity of ${products.banana.name}` }).click();
  await expect(banana.getByLabel("Quantity 1")).toBeVisible();

  await banana.getByRole("button", { name: `Remove ${products.banana.name}` }).click();
  await expect(page.getByRole("listitem").filter({ hasText: products.banana.name })).toHaveCount(0);
  await expect(page.getByRole("complementary").getByText("₦50,000")).toBeVisible();

  await page.getByRole("button", { name: "Clear cart" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clear cart" }).click();
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View This Week's Menu" })).toBeVisible();
});

test("a tampered or stale guest cart is never trusted", async ({ page, context, baseURL }) => {
  const sourdoughId = await weeklyMenuProductId(products.sourdough.name);
  const unknownId = "30000000-0000-4000-8000-0000000000ff";
  await context.addCookies([
    {
      name: "samys_cart",
      // Injected price is ignored; the unknown product is shown as unavailable.
      value: encodeURIComponent(JSON.stringify([{ p: sourdoughId, q: 1, price: 1 }, { p: unknownId, q: 2 }])),
      url: baseURL!,
    },
  ]);
  await page.goto("/cart");
  const sourdough = page.getByRole("listitem").filter({ hasText: products.sourdough.name });
  await expect(sourdough.getByText("₦6,500").first()).toBeVisible();
  await expect(page.getByText("No longer available — please remove it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(page.getByText("Fix the items marked in your cart before checking out.")).toBeVisible();

  await context.addCookies([{ name: "samys_cart", value: "garbage", url: baseURL! }]);
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});

test("guests are asked to sign in at checkout", async ({ page }) => {
  await addFromProductPage(page, products.banana.slug, 1);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await page.goto("/cart");
  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL("/login?next=%2Fcheckout");
});

test("signing in merges the guest cart, capping at availability", async ({ page }) => {
  const customer = await createAccount("E2E Cart Customer");
  const cakeId = await weeklyMenuProductId(products.cake.name);

  // The account already has 1 cake saved from an earlier visit.
  const { data: cart } = await service.from("carts").insert({ user_id: customer.id }).select("id").single();
  await service.from("cart_items").insert({ cart_id: cart!.id, weekly_menu_product_id: cakeId, quantity: 1 });

  // As a guest, add 2 cakes (the most available) and 1 banana bread.
  await addFromProductPage(page, products.cake.slug, 2);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await addFromProductPage(page, products.banana.slug, 1);
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();

  await page.goto("/login?next=%2Fcart");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/cart");

  // 1 + 2 = 3 cakes, capped to the 2 available, and the customer is told.
  await expect(page.getByText("We updated your cart when you signed in.")).toBeVisible();
  await expect(page.getByText(`Reduced to the quantity still available: ${products.cake.name}.`)).toBeVisible();
  const { data: lines } = await service
    .from("cart_items")
    .select("weekly_menu_product_id, quantity")
    .eq("cart_id", cart!.id);
  const banana = await weeklyMenuProductId(products.banana.name);
  expect(lines?.sort((a, b) => a.quantity - b.quantity)).toEqual([
    { weekly_menu_product_id: banana, quantity: 1 },
    { weekly_menu_product_id: cakeId, quantity: 2 },
  ]);

  // The guest cookie is gone and the notice shows only once.
  expect((await page.context().cookies()).some((cookie) => cookie.name === "samys_cart")).toBe(false);
  await page.reload();
  await expect(page.getByText("We updated your cart when you signed in.")).toHaveCount(0);
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 3 items");

  // Signed-in changes go to the database cart.
  await page
    .getByRole("listitem")
    .filter({ hasText: products.banana.name })
    .getByRole("button", { name: `Increase quantity of ${products.banana.name}` })
    .click();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 4 items");
  const { data: after } = await service
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart!.id)
    .eq("weekly_menu_product_id", banana)
    .single();
  expect(after?.quantity).toBe(2);
});
