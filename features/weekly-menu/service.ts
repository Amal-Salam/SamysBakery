import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AddMenuProductInput, UpdateMenuProductInput } from "@/schemas/weekly-menu";

// Weekly-menu mutations. Callers have passed assertAdmin(); RLS, the lifecycle
// functions and the weekly_menu_products trigger enforce the rules again in
// the database.

const MENU_MESSAGES = {
  MENU_ALREADY_ACTIVE:
    "A weekly menu is already active. A new week can be created once the current week has ended.",
  WEEK_ALREADY_EXISTS: "A menu for that week already exists.",
  MENU_EMPTY: "Add at least one product before publishing.",
  MENU_NOT_DRAFT: "Only a draft menu can be published.",
  MENU_WEEK_ENDED: "This week has already ended.",
  MENU_ALREADY_PUBLISHED: "Another menu is already published.",
  MENU_NOT_PUBLISHED: "This menu isn't published.",
  MENU_HAS_ORDERS: "This menu has orders, so it can't be unpublished.",
  MENU_EXPIRED: "This menu has ended and can't be changed.",
  PRODUCT_ARCHIVED: "That product has been deleted from the Product Library.",
  WEEKLY_PRODUCT_LOCKED:
    "This product has orders. Its name, price and weekly quantity are locked.",
  WEEKLY_PRODUCT_HAS_ORDERS: "This product has orders, so it can't be removed from the menu.",
  P0002: "That menu could not be found.",
  "23505": "That product is already on this menu.",
} as const;

export async function createWeek(): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_weekly_menu");
  if (error) throw fromDbError(error, MENU_MESSAGES);
  return { id: data as string };
}

export async function publishMenu(menuId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_weekly_menu", { target_menu_id: menuId });
  if (error) throw fromDbError(error, MENU_MESSAGES);
}

export async function unpublishMenu(menuId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unpublish_weekly_menu", { target_menu_id: menuId });
  if (error) throw fromDbError(error, MENU_MESSAGES);
}

/** Adds a Product Library product, copying its details into the weekly snapshot. */
export async function addProductFromLibrary(input: AddMenuProductInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("name, description, ingredients, deleted_at, product_images ( storage_path, display_order )")
    .eq("id", input.productId)
    .maybeSingle();
  if (productError) throw fromDbError(productError);
  if (!product || product.deleted_at) {
    throw new AppError("NOT_FOUND", "That product could not be found.");
  }

  const mainPhoto = [...product.product_images].sort((a, b) => a.display_order - b.display_order)[0];

  const { error } = await supabase.from("weekly_menu_products").insert({
    weekly_menu_id: input.menuId,
    product_id: input.productId,
    name_snapshot: product.name,
    description_snapshot: product.description,
    ingredients_snapshot: product.ingredients,
    image_snapshot: mainPhoto?.storage_path ?? null,
    price: input.price,
    weekly_quantity: input.weeklyQuantity,
    low_stock_threshold: input.lowStockThreshold,
  });
  if (error) throw fromDbError(error, MENU_MESSAGES);
}

/**
 * Updates a weekly-menu product. Once locked (has orders), any attempt to change
 * name, price or weekly quantity is rejected — never silently ignored.
 */
export async function updateMenuProduct(input: UpdateMenuProductInput): Promise<{ menuId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: current, error: loadError } = await supabase
    .from("weekly_menu_products")
    .select(
      "weekly_menu_id, name_snapshot, price, weekly_quantity, locked_at, products ( product_images ( storage_path ) )"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (loadError) throw fromDbError(loadError);
  if (!current) throw new AppError("NOT_FOUND", "That menu product could not be found.");

  const locked = current.locked_at !== null;
  if (
    locked &&
    (input.name !== current.name_snapshot ||
      input.price !== Number(current.price) ||
      input.weeklyQuantity !== current.weekly_quantity)
  ) {
    throw new AppError("CONFLICT", MENU_MESSAGES.WEEKLY_PRODUCT_LOCKED);
  }

  const libraryPaths = new Set(
    ((current.products as unknown as { product_images: { storage_path: string }[] } | null)
      ?.product_images ?? []).map((image) => image.storage_path)
  );
  if (input.imageSnapshot && !libraryPaths.has(input.imageSnapshot)) {
    throw new AppError("VALIDATION_ERROR", "Choose one of this product's library photos.");
  }

  const { error } = await supabase
    .from("weekly_menu_products")
    .update({
      ...(locked
        ? {}
        : { name_snapshot: input.name, price: input.price, weekly_quantity: input.weeklyQuantity }),
      low_stock_threshold: input.lowStockThreshold,
      description_snapshot: input.description,
      ingredients_snapshot: input.ingredients,
      image_snapshot: input.imageSnapshot || null,
    })
    .eq("id", input.id);
  if (error) throw fromDbError(error, MENU_MESSAGES);
  return { menuId: current.weekly_menu_id };
}

export async function removeMenuProduct(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("weekly_menu_products").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error, MENU_MESSAGES);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That menu product could not be found.");
}

/** Ordering cutoff (system setting). Audited in the database; admin only. */
export async function setOrderCutoff(cutoff: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_order_cutoff", { new_cutoff: cutoff });
  if (error) throw fromDbError(error, { INVALID_CUTOFF: "Enter a time like 17:00." });
}

export async function getOrderCutoff(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("order_cutoff_time");
  if (error) throw fromDbError(error);
  return String(data).slice(0, 5);
}
