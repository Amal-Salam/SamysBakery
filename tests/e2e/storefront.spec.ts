import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

// Customer discovery (AGENTS.md §47: Homepage → Weekly Menu → Product).
// Read-only against the fixture menu published by storefront.setup.ts.

type Fixture = { menuId: string; products: Record<string, { name: string; slug: string }> };

// Written by the setup project, so read it lazily (test files load before setup runs).
let products: Fixture["products"];
test.beforeAll(() => {
  products = (JSON.parse(readFileSync("tests/e2e/.storefront-fixture.json", "utf8")) as Fixture).products;
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
}

test("homepage presents the bakery and this week's menu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Something delicious is always baking." })).toBeVisible();
  await expect(page.getByText("Small-batch bakes, exciting flavours, and artisanal treats made fresh for your week.")).toBeVisible();
  await expect(page.getByRole("img", { name: `${products.sourdough.name} on a board` }).first()).toBeVisible();

  const thisWeek = page.getByRole("region", { name: "This Week's Menu" });
  await expect(thisWeek.getByText("Fresh this week. Available Tuesday–Saturday.")).toBeVisible();
  await expect(thisWeek.getByRole("listitem")).toHaveCount(4);
  await expect(thisWeek.getByRole("link", { name: "View This Week's Menu" })).toBeVisible();

  const about = page.locator("#about");
  await expect(about.getByRole("heading", { name: "A Little About Samy's" })).toBeVisible();
  await expect(about.getByText("No permanent menu. No boring routine.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Your next favourite bake might be waiting." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the Menu" })).toHaveAttribute("href", "/menu");

  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("footer shows approved content only", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Artisanal bakes. Exciting flavours. Fresh every week.")).toBeVisible();
  await expect(footer.getByText("Tuesday – Saturday: 8:00 AM – 6:00 PM")).toBeVisible();
  for (const label of ["This Week's Menu", "About Us", "My Account", "Instagram", "TikTok", "WhatsApp"]) {
    await expect(footer.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  // Out of scope / pending content (owner decisions).
  await expect(footer.getByRole("textbox")).toHaveCount(0);
  await expect(footer.getByRole("button", { name: /subscribe/i })).toHaveCount(0);
  await expect(footer.getByText(/\+234|@samysbakery/)).toHaveCount(0);
  await expect(footer.getByText(/Privacy Policy|Terms of Service|FAQs/)).toHaveCount(0);
  await expect(footer.getByText(`© ${new Date().getFullYear()} Samy's Bakery. All rights reserved.`)).toBeVisible();
});

test("menu groups products by category with clear availability", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore This Week's Menu" }).click();
  await expect(page).toHaveURL("/menu");
  await expect(page.getByRole("heading", { level: 1, name: "This Week's Menu" })).toBeVisible();
  await expect(page.getByText(/^Tue \d+ \w+ – Sat \d+ \w+ \d{4}$/).filter({ visible: true })).toHaveCount(1);

  const headings = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(headings).toHaveText(["Cakes", "Bread", "Pastries", "Also this week"]);

  const card = (name: string) => page.getByRole("article").filter({ hasText: name });
  await expect(card(products.sourdough.name).getByText("10 available")).toBeVisible();
  await expect(card(products.sourdough.name).getByText("₦6,500")).toBeVisible();
  await expect(card(products.cake.name).getByText("Only 2 left")).toBeVisible();
  await expect(card(products.croissant.name).getByText("SOLD OUT")).toBeVisible();
  await expect(card(products.banana.name).getByText("5 available")).toBeVisible();

  // Customers never see products outside the published menu.
  await expect(page.getByText(products.hidden.name)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("product page shows details, exact availability and ingredients", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("link", { name: products.sourdough.name }).click();
  await expect(page).toHaveURL(`/menu/${products.sourdough.slug}`);
  await expect(page).toHaveTitle(`${products.sourdough.name} | Samy's Bakery`);

  await expect(page.getByRole("heading", { level: 1, name: products.sourdough.name })).toBeVisible();
  await expect(page.getByText(`Description of ${products.sourdough.name}.`)).toBeVisible();
  await expect(page.getByText("₦6,500")).toBeVisible();
  await expect(page.getByText("10 available")).toBeVisible();

  const ingredients = page.getByText(`Ingredients of ${products.sourdough.name}`);
  await expect(ingredients).toBeHidden();
  await page.getByText("Ingredients", { exact: true }).click();
  await expect(ingredients).toBeVisible();

  await page.getByRole("link", { name: "Continue Browsing" }).click();
  await expect(page).toHaveURL("/menu");
  await expectNoHorizontalOverflow(page);
});

test("sold-out product stays visible and says so", async ({ page }) => {
  await page.goto(`/menu/${products.croissant.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: products.croissant.name })).toBeVisible();
  await expect(page.getByText("SOLD OUT", { exact: true })).toBeVisible();
  await expect(page.getByText("This bake is sold out for this week.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Weekly Menu" })).toBeVisible();
});

test("products outside the published menu are not found", async ({ page }) => {
  for (const slug of [products.hidden.slug, "does-not-exist"]) {
    const response = await page.goto(`/menu/${slug}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This product isn't on this week's menu.")).toBeVisible();
  }
});

test("About links go to the About section", async ({ page }, testInfo) => {
  await page.goto("/menu");
  if (testInfo.project.name === "storefront-mobile") {
    // On phones the header keeps Menu / Sign in / Cart; About lives in the footer.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About" })).toBeHidden();
    await page.getByRole("contentinfo").getByRole("link", { name: "About Us" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About" }).click();
  }
  await expect(page).toHaveURL("/#about");
  await expect(page.getByRole("heading", { name: "A Little About Samy's" })).toBeInViewport();
});
