import "server-only";

import { randomUUID } from "node:crypto";

import { AppError, fromDbError } from "@/lib/errors";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductInput } from "@/schemas/product";

import { MAX_IMAGE_BYTES, detectImageType, slugify, uniqueSlug } from "./rules";

// Product Library mutations. Callers must already have passed assertAdmin();
// every query also runs as the signed-in user, so RLS re-checks the ADMIN role.

const SLUG_TAKEN = "That URL slug is already used by another product.";

async function takenSlugs(table: "products" | "categories", base: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(table).select("slug").like("slug", `${base}%`);
  if (error) throw fromDbError(error);
  return new Set(data.map((row) => row.slug));
}

export async function createProduct(input: ProductInput): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();
  const base = input.slug || slugify(input.name);
  const slug = input.slug ? input.slug : uniqueSlug(base, await takenSlugs("products", base));

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      slug,
      category_id: input.categoryId,
      description: input.description,
      ingredients: input.ingredients,
    })
    .select("id")
    .single();
  if (error) throw fromDbError(error, { "23505": SLUG_TAKEN });
  return { id: data.id };
}

/**
 * Updates the Product Library record only. Weekly-menu snapshots and order
 * items are separate copies and are never changed by this.
 */
export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      // Blank slug on edit keeps the existing URL.
      ...(input.slug ? { slug: input.slug } : {}),
      category_id: input.categoryId,
      description: input.description,
      ingredients: input.ingredients,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw fromDbError(error, { "23505": SLUG_TAKEN });
  if (data.length === 0) throw new AppError("NOT_FOUND", "That product could not be found.");
}

/** "Delete" = archive (owner decision). Audited in the same database transaction. */
export async function archiveProduct(id: string): Promise<{ hadHistory: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("archive_product", { target_product_id: id });
  if (error) {
    throw fromDbError(error, {
      PRODUCT_ON_ACTIVE_MENU:
        "This product is on the current or draft weekly menu. Remove it from the menu before deleting it.",
      P0002: "That product could not be found.",
    });
  }
  const result = data as unknown as { had_history?: boolean } | null;
  return { hadHistory: Boolean(result?.had_history) };
}

// ---------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------

async function assertActiveProduct(productId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("NOT_FOUND", "That product could not be found.");
}

export async function addProductImage(
  productId: string,
  file: File,
  altText: string
): Promise<{ id: string }> {
  if (file.size === 0) throw new AppError("VALIDATION_ERROR", "Choose a photo to upload.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Photos must be 5 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    throw new AppError("VALIDATION_ERROR", "Upload a JPEG, PNG, WebP or AVIF photo.");
  }

  await assertActiveProduct(productId);
  const supabase = await createSupabaseServerClient();

  const storagePath = `products/${productId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, bytes, { contentType: type.mime, upsert: false });
  if (uploadError) {
    console.error("[storage] upload failed", uploadError.name);
    throw new AppError("INTERNAL_ERROR", "The photo could not be uploaded. Please try again.");
  }

  const { data: last } = await supabase
    .from("product_images")
    .select("display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText,
      display_order: (last?.display_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an orphaned file behind.
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
    throw fromDbError(error);
  }
  return { id: data.id };
}

export async function updateProductImageAlt(imageId: string, altText: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_images")
    .update({ alt_text: altText })
    .eq("id", imageId)
    .select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That photo could not be found.");
}

export async function moveProductImage(imageId: string, direction: "up" | "down"): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: image, error } = await supabase
    .from("product_images")
    .select("product_id")
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!image) throw new AppError("NOT_FOUND", "That photo could not be found.");

  const { data: siblings, error: listError } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", image.product_id)
    .order("display_order")
    .order("created_at");
  if (listError) throw fromDbError(listError);

  const ids = siblings.map((row) => row.id);
  const index = ids.indexOf(imageId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];

  // Rewrite a dense 0..n-1 order so gaps or ties never accumulate.
  for (const [order, id] of ids.entries()) {
    const { error: updateError } = await supabase
      .from("product_images")
      .update({ display_order: order })
      .eq("id", id);
    if (updateError) throw fromDbError(updateError);
  }
}

/**
 * Removes a photo from the Product Library. The stored file is kept if any
 * weekly-menu snapshot or historical order item still references it.
 */
export async function deleteProductImage(imageId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: image, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("storage_path")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!image) throw new AppError("NOT_FOUND", "That photo could not be found.");

  const [menuRefs, orderRefs] = await Promise.all([
    supabase
      .from("weekly_menu_products")
      .select("id", { count: "exact", head: true })
      .eq("image_snapshot", image.storage_path),
    supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_image", image.storage_path),
  ]);
  if (menuRefs.error || orderRefs.error) return; // Keep the file when unsure.
  if ((menuRefs.count ?? 0) + (orderRefs.count ?? 0) > 0) return;

  const { error: removeError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([image.storage_path]);
  if (removeError) console.error("[storage] remove failed", removeError.name);
}

// ---------------------------------------------------------------------
// Categories (owner decision: lightweight, admin-managed, optional)
// ---------------------------------------------------------------------

export async function createCategory(name: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const base = slugify(name);
  const slug = uniqueSlug(base || "category", await takenSlugs("categories", base || "category"));
  const { data: last } = await supabase
    .from("categories")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .insert({ name, slug, display_order: (last?.display_order ?? 0) + 1 });
  if (error) throw fromDbError(error, { "23505": "A category with that name already exists." });
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .select("id");
  if (error) throw fromDbError(error, { "23505": "A category with that name already exists." });
  if (data.length === 0) throw new AppError("NOT_FOUND", "That category could not be found.");
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("categories")
    .select("id")
    .order("display_order")
    .order("name");
  if (error) throw fromDbError(error);

  const ids = rows.map((row) => row.id);
  const index = ids.indexOf(id);
  if (index === -1) throw new AppError("NOT_FOUND", "That category could not be found.");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];

  for (const [order, rowId] of ids.entries()) {
    const { error: updateError } = await supabase
      .from("categories")
      .update({ display_order: order + 1 })
      .eq("id", rowId);
    if (updateError) throw fromDbError(updateError);
  }
}

/** Deleting a category leaves its products uncategorized (FK ON DELETE SET NULL). */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That category could not be found.");
}
