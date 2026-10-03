import "server-only";

import { listAdminOrders, type AdminOrderSummary } from "@/features/orders/admin";
import { getCurrentAdminMenu } from "@/features/weekly-menu/queries";
import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lagosToday } from "@/lib/utils/dates";

import { getRevenueMetrics, type RevenueMetrics } from "./revenue";
import { CLOSED_STATUSES, PREPARATION_STATUSES, revenuePeriodRange, type DateRange } from "./rules";

// getAdminDashboard() — API contract §30. Composes read queries only; the
// metrics are the approved ones (Milestone 15 owner decisions). Admin RLS.

export type StockWarning = { id: string; name: string; available: number; threshold: number };

export type AdminDashboard = {
  today: string;
  /** The newest paid orders not yet marked RECEIVED (up to 20) and their total count. */
  newOrders: AdminOrderSummary[];
  newOrderCount: number;
  todaysOrders: AdminOrderSummary[];
  upcomingCount: number;
  preparationCount: number;
  readyCount: number;
  revenueRange: DateRange;
  revenue: RevenueMetrics;
  lowStock: StockWarning[];
  soldOut: StockWarning[];
  menu: {
    id: string;
    weekStart: string;
    weekEnd: string;
    status: "DRAFT" | "PUBLISHED" | "EXPIRED";
    productCount: number;
  } | null;
};

async function countOf(query: PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw fromDbError(error);
  return count ?? 0;
}

async function getStockWarnings(menuIsPublished: boolean, names: Map<string, { name: string; threshold: number }>) {
  if (!menuIsPublished) return { lowStock: [], soldOut: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_published_menu_availability");
  if (error) throw fromDbError(error);
  const lowStock: StockWarning[] = [];
  const soldOut: StockWarning[] = [];
  for (const row of data) {
    const product = names.get(row.weekly_menu_product_id);
    if (!product) continue;
    const warning = { id: row.weekly_menu_product_id, name: product.name, available: row.available_quantity, threshold: product.threshold };
    if (row.availability_status === "SOLD_OUT") soldOut.push(warning);
    else if (row.availability_status === "LOW_STOCK") lowStock.push(warning);
  }
  return { lowStock, soldOut };
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const today = lagosToday();
  const revenueRange = revenuePeriodRange("week", today);
  const menu = await getCurrentAdminMenu();
  const supabase = await createSupabaseServerClient();
  const orders = () => supabase.from("orders").select("id", { count: "exact", head: true });

  const [newOrders, newOrderCount, todaysOrders, upcomingCount, preparationCount, readyCount, revenue, stock] = await Promise.all([
    listAdminOrders({ status: "PAID", limit: 20 }),
    countOf(orders().eq("order_status", "PAID")),
    listAdminOrders({ view: "today" }),
    countOf(orders().gt("delivery_date", today).not("order_status", "in", `(${CLOSED_STATUSES.join(",")})`)),
    countOf(orders().in("order_status", [...PREPARATION_STATUSES])),
    countOf(orders().eq("order_status", "READY")),
    getRevenueMetrics(revenueRange),
    getStockWarnings(
      menu?.status === "PUBLISHED",
      new Map(menu?.products.map((p) => [p.id, { name: p.name, threshold: p.lowStockThreshold }]) ?? [])
    ),
  ]);

  return {
    today,
    newOrders,
    newOrderCount,
    todaysOrders,
    upcomingCount,
    preparationCount,
    readyCount,
    revenueRange,
    revenue,
    ...stock,
    menu: menu
      ? { id: menu.id, weekStart: menu.weekStart, weekEnd: menu.weekEnd, status: menu.status, productCount: menu.products.length }
      : null,
  };
}
