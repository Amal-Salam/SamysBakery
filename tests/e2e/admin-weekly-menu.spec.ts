import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  TINY_PNG,
  clearActiveMenus,
  createAccount,
  service,
  signInAsAdmin,
  uniqueSuffix,
  type Account,
} from "./helpers";

// Admin journey (AGENTS.md §48): Create Weekly Menu → Add Product → Set Price →
// Set Quantity → Publish. Runs serially in its own "admin-menu" project because
// only one DRAFT and one PUBLISHED menu can exist (see playwright.config.ts).

test.describe.configure({ mode: "serial" });

let admin: Account;
const suffix = uniqueSuffix();
const sourdough = `E2E Sourdough ${suffix}`;
const brioche = `E2E Brioche ${suffix}`;
let sourdoughId: string;

test.beforeAll(async () => {
  await clearActiveMenus();
  admin = await createAccount("E2E Menu Admin", "ADMIN");

  const { data: products } = await service
    .from("products")
    .insert([
      { name: sourdough, slug: `e2e-sourdough-${suffix}`, description: "Tangy, chewy crumb.", ingredients: "Flour, water, salt" },
      { name: brioche, slug: `e2e-brioche-${suffix}`, description: "Rich and buttery.", ingredients: "Flour, butter, eggs" },
    ])
    .select("id, name");
  sourdoughId = products!.find((product) => product.name === sourdough)!.id;

  const path = `products/${sourdoughId}/e2e.png`;
  await service.storage.from("product-images").upload(path, TINY_PNG, { contentType: "image/png" });
  await service.from("product_images").insert({ product_id: sourdoughId, storage_path: path, alt_text: `${sourdough} loaf` });
});

test.afterAll(async () => {
  await clearActiveMenus();
});

async function addToMenu(page: Page, name: string, price: string, quantity: string, threshold: string) {
  const form = page.getByRole("region", { name: "Add from Product Library" });
  await form.getByLabel("Product", { exact: true }).selectOption({ label: name });
  await form.getByLabel("Weekly price (₦)").fill(price);
  await form.getByLabel("Weekly quantity").fill(quantity);
  await form.getByLabel("Low-stock threshold").fill(threshold);
  await form.getByRole("button", { name: "Add to menu" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Product added to the menu." })).toBeVisible();
}

test("admin creates a week, adds products and publishes", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/menu");
  await expect(page.getByText("No current menu.")).toBeVisible();

  // Create New Week (dates calculated automatically).
  await page.getByRole("link", { name: "Create New Week" }).last().click();
  await expect(page).toHaveURL("/admin/menu/new");
  await expect(page.getByText(/This creates an empty draft menu for Tue .* – Sat .*/)).toBeVisible();
  await page.getByRole("button", { name: "Create week" }).click();
  await expect(page).toHaveURL("/admin/menu?created=1");
  await expect(page.getByText("Draft — not visible to customers")).toBeVisible();
  await expect(page.getByText("This menu is empty.")).toBeVisible();

  // A second week can't be created while this one is active.
  await page.goto("/admin/menu/new");
  await expect(page.getByText(/is already in draft/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create week" })).toHaveCount(0);

  // Publishing an empty menu is refused server-side.
  await page.goto("/admin/menu");
  await page.getByRole("button", { name: "Publish menu" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish menu" }).click();
  await expect(
    page.getByRole("alertdialog").getByText("Add at least one product before publishing.")
  ).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

  // Validation: invalid price is rejected.
  const form = page.getByRole("region", { name: "Add from Product Library" });
  await form.getByLabel("Product", { exact: true }).selectOption({ label: sourdough });
  await form.getByLabel("Weekly price (₦)").fill("free");
  await form.getByLabel("Weekly quantity").fill("20");
  await form.getByRole("button", { name: "Add to menu" }).click();
  await expect(form.getByText("Enter a price in naira, e.g. 6500.")).toBeVisible();

  // Add from the Product Library, set price and quantity.
  await addToMenu(page, sourdough, "6,500", "20", "3");
  await addToMenu(page, brioche, "5000", "8", "2");

  const products = page.getByRole("list", { name: "Products on this menu" });
  const sourdoughRow = products.getByRole("listitem").filter({ hasText: sourdough });
  await expect(sourdoughRow.getByText("₦6,500")).toBeVisible();
  await expect(sourdoughRow.getByRole("img", { name: `${sourdough} loaf` })).toBeVisible();

  // The Product Library shows it on the draft menu and blocks deletion.
  await page.goto(`/admin/products/${sourdoughId}`);
  await expect(page.getByText("On draft menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete product" })).toBeDisabled();

  // Customers can't see a draft.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  expect((await anon.from("weekly_menu_products").select("id")).data).toEqual([]);

  // Publish with confirmation.
  await page.goto("/admin/menu");
  await page.getByRole("button", { name: "Publish menu" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish menu" }).click();
  await expect(page.getByText("Published — customers can order")).toBeVisible();

  const { data: visible } = await anon.from("weekly_menu_products").select("name_snapshot, price");
  expect(visible?.map((row) => row.name_snapshot).sort()).toEqual([brioche, sourdough].sort());

  const { data: audit } = await service
    .from("audit_logs")
    .select("action")
    .eq("actor_user_id", admin.id)
    .in("action", ["MENU_CREATED", "MENU_PUBLISHED"]);
  expect(audit?.map((row) => row.action).sort()).toEqual(["MENU_CREATED", "MENU_PUBLISHED"]);
});

test("admin edits, removes and unpublishes while there are no orders", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/menu");
  const products = page.getByRole("list", { name: "Products on this menu" });

  // Edit price (allowed: no orders yet).
  const briocheRow = products.getByRole("listitem").filter({ hasText: brioche });
  await briocheRow.getByText(`Edit ${brioche}`).click();
  await briocheRow.getByLabel("Weekly price (₦)").fill("5500");
  await briocheRow.getByRole("button", { name: "Save changes" }).click();
  await expect(briocheRow.getByRole("status").filter({ hasText: "Menu product saved." })).toBeVisible();
  await expect(briocheRow.getByText("₦5,500")).toBeVisible();

  // Remove it from the menu.
  await briocheRow.getByRole("button", { name: "Remove from menu" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove from menu" }).click();
  await expect(products.getByRole("listitem").filter({ hasText: brioche })).toHaveCount(0);

  // Unpublish → draft, then publish again.
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Unpublish menu" }).click();
  await expect(page.getByText("Draft — not visible to customers")).toBeVisible();
  await page.getByRole("button", { name: "Publish menu" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish menu" }).click();
  await expect(page.getByText("Published — customers can order")).toBeVisible();
});

test("after the first order, name, price and quantity are locked", async ({ page }) => {
  // The first order locks the product (order creation arrives in Milestone 11).
  await service.from("weekly_menu_products").update({ locked_at: new Date().toISOString() }).eq("name_snapshot", sourdough);

  await signInAsAdmin(page, admin);
  await page.goto("/admin/menu");
  await expect(page.getByText("This menu has orders, so it can't be unpublished.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);

  const row = page.getByRole("list", { name: "Products on this menu" }).getByRole("listitem").filter({ hasText: sourdough });
  await expect(row.getByText("Has orders — partly locked")).toBeVisible();
  await row.getByText(`Edit ${sourdough}`).click();
  await expect(row.getByText(/Locked: this product has orders/)).toBeVisible();
  await expect(row.getByLabel("Weekly price (₦)")).toHaveAttribute("readonly", "");
  await expect(row.getByLabel("Weekly quantity")).toHaveAttribute("readonly", "");
  await expect(row.getByLabel("Name on this menu")).toHaveAttribute("readonly", "");
  await expect(row.getByRole("button", { name: "Remove from menu" })).toHaveCount(0);

  // Even if the read-only field is tampered with, the server refuses.
  await row.getByLabel("Weekly price (₦)").evaluate((input: HTMLInputElement) => {
    input.removeAttribute("readonly");
    input.value = "1";
  });
  await row.getByRole("button", { name: "Save changes" }).click();
  await expect(row.getByRole("alert").filter({ hasText: "Its name, price and weekly quantity are locked." })).toBeVisible();

  // Description stays editable.
  await page.reload();
  const fresh = page.getByRole("list", { name: "Products on this menu" }).getByRole("listitem").filter({ hasText: sourdough });
  await fresh.getByText(`Edit ${sourdough}`).click();
  await fresh.getByLabel("Description").fill("Tangy, chewy crumb with a blistered crust.");
  await fresh.getByRole("button", { name: "Save changes" }).click();
  await expect(fresh.getByRole("status").filter({ hasText: "Menu product saved." })).toBeVisible();

  const { data } = await service
    .from("weekly_menu_products")
    .select("price, description_snapshot")
    .eq("name_snapshot", sourdough)
    .single();
  expect(Number(data?.price)).toBe(6500);
  expect(data?.description_snapshot).toBe("Tangy, chewy crumb with a blistered crust.");
});

test("admin changes the ordering cutoff (audited)", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/menu");
  const section = page.getByRole("region", { name: "Ordering cutoff" });
  await expect(section.getByLabel("Same-day cutoff")).toHaveValue("17:00");
  await section.getByLabel("Same-day cutoff").fill("16:30");
  await section.getByRole("button", { name: "Save cutoff" }).click();
  await expect(section.getByRole("status").filter({ hasText: "Ordering cutoff saved." })).toBeVisible();

  const { data: audit } = await service
    .from("audit_logs")
    .select("metadata")
    .eq("action", "ORDER_CUTOFF_CHANGED")
    .eq("actor_user_id", admin.id)
    .single();
  expect(audit?.metadata).toMatchObject({ from: "17:00", to: "16:30" });

  // Restore the owner's value for the rest of the suite.
  await section.getByLabel("Same-day cutoff").fill("17:00");
  await section.getByRole("button", { name: "Save cutoff" }).click();
  await expect(section.getByRole("status").filter({ hasText: "Ordering cutoff saved." })).toBeVisible();
});

