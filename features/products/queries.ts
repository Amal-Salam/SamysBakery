import "server-only";

import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { libraryStatus, type LibraryStatus } from "./rules";

// Admin Product Library reads. Run as the signed-in user, so RLS also enforces
// that only admins see the full library.

export type LibraryImage = {
  id: string;
  storagePath: string;
  altText: string;
  displayOrder: number;
};

export type LibraryProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  ingredients: string;
  categoryId: string | null;
  categoryName: string | null;
  images: LibraryImage[];
  status: LibraryStatus;
  timesOnMenu: number;
};

export type Category = { id: string; name: string; slug: string; displayOrder: number };

const PRODUCT_SELECT = `
  id, name, slug, description, ingredients, category_id,
  categories ( name ),
  product_images ( id, storage_path, alt_text, display_order ),
  weekly_menu_products ( weekly_menus ( status ) )
` as const;

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  ingredients: string;
  category_id: string | null;
  categories: { name: string } | null;
  product_images: { id: string; storage_path: string; alt_text: string; display_order: number }[];
  weekly_menu_products: { weekly_menus: { status: "DRAFT" | "PUBLISHED" | "EXPIRED" } | null }[];
};

function toLibraryProduct(row: ProductRow): LibraryProduct {
  const usages = row.weekly_menu_products.flatMap((wmp) =>
    wmp.weekly_menus ? [{ status: wmp.weekly_menus.status }] : []
  );
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    ingredients: row.ingredients,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    images: row.product_images
      .map((image) => ({
        id: image.id,
        storagePath: image.storage_path,
        altText: image.alt_text,
        displayOrder: image.display_order,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
    status: libraryStatus(usages),
    timesOnMenu: usages.length,
  };
}

/** Active (non-archived) library products, newest name order. */
export async function listLibraryProducts(): Promise<LibraryProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .is("deleted_at", null)
    .order("name");
  if (error) throw fromDbError(error);
  return (data as unknown as ProductRow[]).map(toLibraryProduct);
}

export async function getLibraryProduct(id: string): Promise<LibraryProduct | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toLibraryProduct(data as unknown as ProductRow) : null;
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, display_order")
    .order("display_order")
    .order("name");
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order,
  }));
}
