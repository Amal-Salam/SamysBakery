import "server-only";

import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DateRange } from "./rules";

// Approved revenue metrics (Milestone 15 owner decision), computed by the
// admin-only database function get_revenue_metrics. Nothing else.

export type RevenueMetrics = {
  paidCount: number;
  paidTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  refundedCount: number;
  refundedTotal: number;
  netTotal: number;
  productsSold: number;
  products: { name: string; quantity: number }[];
};

type MetricsRow = {
  paid_count: number;
  paid_total: number | string;
  cancelled_count: number;
  cancelled_total: number | string;
  refunded_count: number;
  refunded_total: number | string;
  net_total: number | string;
  products_sold: number;
  products: { name: string; quantity: number }[];
};

export async function getRevenueMetrics(range: DateRange): Promise<RevenueMetrics> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_revenue_metrics", {
    from_date: range.from as string,
    to_date: range.to as string,
  });
  if (error) throw fromDbError(error);
  const row = data as unknown as MetricsRow;
  return {
    paidCount: row.paid_count,
    paidTotal: Number(row.paid_total),
    cancelledCount: row.cancelled_count,
    cancelledTotal: Number(row.cancelled_total),
    refundedCount: row.refunded_count,
    refundedTotal: Number(row.refunded_total),
    netTotal: Number(row.net_total),
    productsSold: row.products_sold,
    products: row.products,
  };
}
