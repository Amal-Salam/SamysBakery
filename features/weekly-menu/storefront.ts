import "server-only";

import { cache } from "react";

import type { AvailabilityStatus } from "@/features/inventory/rules";
import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public storefront reads (getPublishedWeeklyMenu / getProduct in the API
// contract). Run as the visitor; RLS returns only the current published menu,
// and availability comes from the server-side function — never computed here.

export type StorefrontProduct = {
  id: string; // weekly-menu product id (what the cart will reference)
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  price: number;
  image: { path: string; alt: string } | null;
  category: { name: string; displayOrder: number } | null;
  availableQuantity: number;
  availabilityStatus: AvailabilityStatus;
};

export type StorefrontMenu = {
  weekStart: string;
  weekEnd: string;
  products: StorefrontProduct[];
};

type Row = {
  id: string;
  name_snapshot: string;
  description_snapshot: string;
  ingredients_snapshot: string;
  image_snapshot: string | null;
  price: number;
  created_at: string;
  products: {
    slug: string;
    categories: { name: string; display_order: number } | null;
    product_images: { storage_path: string; alt_text: string }[];
  } | null;
};

/** Cached per request: several page sections may read the menu. */
export const getPublishedMenu = cache(async (): Promise<StorefrontMenu | null> => {
  const supabase = await createSupabaseServerClient();

  const [menuResult, availabilityResult] = await Promise.all([
    supabase
      .from("weekly_menus")
      .select(
        `id, week_start, week_end,
         weekly_menu_products (
           id, name_snapshot, description_snapshot, ingredients_snapshot, image_snapshot, price, created_at,
           products ( slug, categories ( name, display_order ), product_images ( storage_path, alt_text ) )
         )`
      )
      .eq("status", "PUBLISHED")
      .maybeSingle(),
    supabase.rpc("get_published_menu_availability"),
  ]);
  if (menuResult.error) throw fromDbError(menuResult.error);
  if (availabilityResult.error) throw fromDbError(availabilityResult.error);
  if (!menuResult.data) return null;

  const availability = new Map(
    availabilityResult.data.map((row) => [
      row.weekly_menu_product_id,
      { available: row.available_quantity, status: row.availability_status as AvailabilityStatus },
    ])
  );

  const rows = menuResult.data.weekly_menu_products as unknown as Row[];
  const products = rows
    .filter((row) => row.products && availability.has(row.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row): StorefrontProduct => {
      const stock = availability.get(row.id)!;
      const imageAlt =
        row.products!.product_images.find((image) => image.storage_path === row.image_snapshot)?.alt_text ||
        row.name_snapshot;
      return {
        id: row.id,
        slug: row.products!.slug,
        name: row.name_snapshot,
        description: row.description_snapshot,
        ingredients: row.ingredients_snapshot,
        price: Number(row.price),
        image: row.image_snapshot ? { path: row.image_snapshot, alt: imageAlt } : null,
        category: row.products!.categories
          ? { name: row.products!.categories.name, displayOrder: row.products!.categories.display_order }
          : null,
        availableQuantity: stock.available,
        availabilityStatus: stock.status,
      };
    });

  return { weekStart: menuResult.data.week_start, weekEnd: menuResult.data.week_end, products };
});

export async function getMenuProduct(slug: string): Promise<StorefrontProduct | null> {
  const menu = await getPublishedMenu();
  return menu?.products.find((product) => product.slug === slug) ?? null;
}
