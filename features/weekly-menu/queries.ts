import "server-only";

import { getEntityActivity, type AuditEntry } from "@/features/admin/audit";
import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lagosToday } from "@/lib/utils/dates";

import { effectiveMenuStatus, type MenuStatus } from "./rules";

// Admin weekly-menu reads (RLS: admins read all menus).

export type MenuProduct = {
  id: string;
  productId: string;
  name: string;
  description: string;
  ingredients: string;
  imageSnapshot: string | null;
  price: number;
  weeklyQuantity: number;
  lowStockThreshold: number;
  locked: boolean;
  /** Photos available in the Product Library for this product. */
  libraryImages: { storagePath: string; altText: string }[];
};

export type AdminMenu = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: MenuStatus;
  publishedAt: string | null;
  products: MenuProduct[];
  hasOrders: boolean;
};

type MenuRow = {
  id: string;
  week_start: string;
  week_end: string;
  status: MenuStatus;
  published_at: string | null;
  weekly_menu_products: {
    id: string;
    product_id: string;
    name_snapshot: string;
    description_snapshot: string;
    ingredients_snapshot: string;
    image_snapshot: string | null;
    price: number;
    weekly_quantity: number;
    low_stock_threshold: number;
    locked_at: string | null;
    created_at: string;
    products: { product_images: { storage_path: string; alt_text: string; display_order: number }[] } | null;
  }[];
};

const MENU_SELECT = `
  id, week_start, week_end, status, published_at,
  weekly_menu_products (
    id, product_id, name_snapshot, description_snapshot, ingredients_snapshot, image_snapshot,
    price, weekly_quantity, low_stock_threshold, locked_at, created_at,
    products ( product_images ( storage_path, alt_text, display_order ) )
  )
`;

function toAdminMenu(row: MenuRow, today: string): AdminMenu {
  const products = [...row.weekly_menu_products]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((wmp) => ({
      id: wmp.id,
      productId: wmp.product_id,
      name: wmp.name_snapshot,
      description: wmp.description_snapshot,
      ingredients: wmp.ingredients_snapshot,
      imageSnapshot: wmp.image_snapshot,
      price: Number(wmp.price),
      weeklyQuantity: wmp.weekly_quantity,
      lowStockThreshold: wmp.low_stock_threshold,
      locked: wmp.locked_at !== null,
      libraryImages: [...(wmp.products?.product_images ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((image) => ({ storagePath: image.storage_path, altText: image.alt_text })),
    }));
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    status: effectiveMenuStatus(row.status, row.week_end, today),
    publishedAt: row.published_at,
    products,
    hasOrders: products.some((product) => product.locked),
  };
}

/** The current menu: the published one if any, otherwise the draft. */
export async function getCurrentAdminMenu(): Promise<AdminMenu | null> {
  const supabase = await createSupabaseServerClient();
  const today = lagosToday();
  const { data, error } = await supabase
    .from("weekly_menus")
    .select(MENU_SELECT)
    .in("status", ["PUBLISHED", "DRAFT"])
    .gte("week_end", today)
    .order("status", { ascending: false }) // PUBLISHED before DRAFT
    .limit(1)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toAdminMenu(data as unknown as MenuRow, today) : null;
}

export async function getAdminMenu(id: string): Promise<AdminMenu | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_menus")
    .select(MENU_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toAdminMenu(data as unknown as MenuRow, lagosToday()) : null;
}

/** Is any menu (draft or published, not yet ended) blocking "Create New Week"? */
export async function hasActiveMenu(): Promise<boolean> {
  return (await getCurrentAdminMenu()) !== null;
}

export type MenuHistoryEntry = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: MenuStatus;
  productCount: number;
};

/** Previous menus (historical, internal only). */
export async function listMenuHistory(limit = 20): Promise<MenuHistoryEntry[]> {
  const supabase = await createSupabaseServerClient();
  const today = lagosToday();
  const { data, error } = await supabase
    .from("weekly_menus")
    .select("id, week_start, week_end, status, weekly_menu_products ( count )")
    .or(`status.eq.EXPIRED,week_end.lt.${today}`)
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    status: effectiveMenuStatus(row.status, row.week_end, today),
    productCount: (row.weekly_menu_products as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export type AddableProduct = { id: string; name: string; categoryName: string | null };

/** Active library products not already on the given menu. */
export async function listAddableProducts(menuId: string): Promise<AddableProduct[]> {
  const supabase = await createSupabaseServerClient();
  const [products, onMenu] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, categories ( name )")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("weekly_menu_products").select("product_id").eq("weekly_menu_id", menuId),
  ]);
  if (products.error) throw fromDbError(products.error);
  if (onMenu.error) throw fromDbError(onMenu.error);
  const taken = new Set(onMenu.data.map((row) => row.product_id));
  return products.data
    .filter((product) => !taken.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryName: (product.categories as unknown as { name: string } | null)?.name ?? null,
    }));
}

/** Audit activity for a menu: lifecycle, product changes and stock additions. */
export async function getMenuActivity(menu: Pick<AdminMenu, "id" | "products">): Promise<AuditEntry[]> {
  return getEntityActivity([
    { type: "weekly_menu", ids: [menu.id] },
    { type: "weekly_menu_product", ids: menu.products.map((product) => product.id) },
  ]);
}
