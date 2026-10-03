import { expect, test } from "@playwright/test";

import {
  TINY_PNG,
  createAccount,
  service,
  signInAsAdmin,
  uniqueSuffix,
  type Account,
} from "./helpers";

// Admin journey (AGENTS.md §48, Product Library part): runs on the local stack.

let admin: Account;
let customer: Account;

test.beforeAll(async () => {
  admin = await createAccount("E2E Admin", "ADMIN");
  customer = await createAccount("E2E Customer");
});

test("admin creates, edits, photographs and deletes a product", async ({ page }) => {
  const name = `E2E Brioche ${uniqueSuffix()}`;
  await signInAsAdmin(page, admin);

  // Navigate via the admin sidebar.
  const nav = page.getByRole("navigation", { name: "Admin" }).filter({ visible: true });
  if (!(await nav.isVisible())) await page.getByText("Admin menu").click();
  await page
    .getByRole("navigation", { name: "Admin" })
    .filter({ visible: true })
    .getByRole("link", { name: "Product Library" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Product Library" })).toBeVisible();

  // Create
  await page.getByRole("link", { name: "Add product" }).first().click();
  await expect(page).toHaveURL("/admin/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Bread" });
  await page.getByLabel("Description", { exact: true }).fill("Soft, buttery and rich.");
  await page.getByLabel("Ingredients", { exact: true }).fill("Flour, butter, eggs, sugar, salt, yeast");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created. Add photos below.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Not yet on a menu")).toBeVisible();

  const productId = page.url().split("/admin/products/")[1].split("?")[0];
  const { data: created } = await service.from("products").select("slug, category_id").eq("id", productId).single();
  expect(created?.slug).toMatch(/^e2e-brioche-/);
  expect(created?.category_id).not.toBeNull();

  // Edit
  await page.getByLabel("Description", { exact: true }).fill("Soft, buttery and golden.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved." })).toBeVisible();

  // Upload validation: wrong file type is rejected server-side.
  const photos = page.getByRole("region", { name: "Photos" });
  await photos.getByLabel("Photo", { exact: true }).setInputFiles({
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
  });
  await photos.getByLabel("Photo description (alt text)").last().fill("Not really a photo");
  await photos.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload a JPEG, PNG, WebP or AVIF photo." })).toBeVisible();

  // Upload a real photo.
  await photos.getByLabel("Photo", { exact: true }).setInputFiles({
    name: "brioche.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await photos.getByLabel("Photo description (alt text)").last().fill(`${name} on a board`);
  await photos.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo uploaded." })).toBeVisible();
  await expect(page.getByRole("img", { name: `${name} on a board` })).toBeVisible();

  const { data: images } = await service
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);
  expect(images).toHaveLength(1);
  const storagePath = images![0].storage_path;
  expect(storagePath).toMatch(new RegExp(`^products/${productId}/[0-9a-f-]+\\.png$`));

  // Remove the photo (through the Storage API with the admin's session).
  await photos.getByRole("button", { name: "Remove photo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove photo" }).click();
  await expect(photos.getByText("No photos yet.")).toBeVisible();
  const { data: remaining } = await service.storage
    .from("product-images")
    .list(`products/${productId}`);
  expect(remaining ?? []).toHaveLength(0);
  expect(storagePath).toBeTruthy();

  // Library list shows the product.
  await page.getByRole("link", { name: "← Product Library" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

  // Delete (archive) with explicit confirmation.
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await page.getByRole("button", { name: "Delete product" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("It will be removed from the Product Library")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Delete product" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, delete product" }).click();

  await expect(page).toHaveURL("/admin/products?deleted=1");
  await expect(page.getByText("Product deleted.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);

  const { data: archived } = await service.from("products").select("deleted_at").eq("id", productId).single();
  expect(archived?.deleted_at).not.toBeNull();
  const { data: audit } = await service
    .from("audit_logs")
    .select("action, actor_user_id")
    .eq("entity_id", productId);
  expect(audit).toEqual([{ action: "PRODUCT_DELETED", actor_user_id: admin.id }]);
});

test("admin manages categories", async ({ page }) => {
  const category = `E2E Category ${uniqueSuffix()}`;
  await signInAsAdmin(page, admin);
  await page.goto("/admin/products");

  const section = page.getByRole("region", { name: "Categories" });
  await section.getByLabel("New category").fill(category);
  await section.getByRole("button", { name: "Add category" }).click();
  const row = section.getByRole("listitem").filter({ has: page.locator(`input[value="${category}"]`) });
  await expect(row).toBeVisible();

  await row.getByLabel("Category name").fill(`${category} Renamed`);
  await row.getByRole("button", { name: "Rename" }).click();
  const renamed = section
    .getByRole("listitem")
    .filter({ has: page.locator(`input[value="${category} Renamed"]`) });
  await expect(renamed).toBeVisible();

  await renamed.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete category" }).click();
  await expect(renamed).toHaveCount(0);
});

test("customers cannot reach the Product Library", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/admin/products");
  await expect(page.getByText("Your account does not have access to the admin area.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product Library" })).toHaveCount(0);
});
