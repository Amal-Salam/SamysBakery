import "server-only";

import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AvailabilityStatus } from "./rules";

// Admin inventory view (API contract §26 getInventory). Figures come from the
// admin-only get_menu_inventory function — the same availability calculation
// checkout uses. Stock increases go through addInventory() in ./service.

export type InventoryRow = {
  id: string;
  name: string;
  weeklyQuantity: number;
  added: number;
  reservedPending: number;
  reservedConfirmed: number;
  available: number;
  lowStockThreshold: number;
  status: AvailabilityStatus;
};

export async function getMenuInventory(menuId: string): Promise<InventoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_menu_inventory", { target_menu_id: menuId });
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.weekly_menu_product_id,
    name: row.name,
    weeklyQuantity: row.weekly_quantity,
    added: row.added_quantity,
    reservedPending: row.reserved_pending,
    reservedConfirmed: row.reserved_confirmed,
    available: row.available_quantity,
    lowStockThreshold: row.low_stock_threshold,
    status: row.availability_status as AvailabilityStatus,
  }));
}

export type InventoryAdjustment = {
  id: string;
  productName: string;
  quantity: number;
  reason: string;
  adminName: string;
  createdAt: string;
};

/** Stock additions for a menu, newest first (who, how many, why, when). */
export async function listInventoryAdjustments(menuId: string): Promise<InventoryAdjustment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_adjustments")
    .select(
      "id, quantity, reason, created_at, weekly_menu_products!inner ( name_snapshot, weekly_menu_id ), profiles ( full_name )"
    )
    .eq("weekly_menu_products.weekly_menu_id", menuId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.id,
    productName: row.weekly_menu_products.name_snapshot,
    quantity: row.quantity,
    reason: row.reason,
    adminName: row.profiles?.full_name || "Admin",
    createdAt: row.created_at,
  }));
}
