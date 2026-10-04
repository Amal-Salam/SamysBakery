import "server-only";

import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { describeAuditEvent } from "./audit-format";

// getAuditLogs() — API contract §31. Read-only (the database refuses any
// update/delete); admins read via RLS. Owner decision (M17): shown in context
// and on the /admin/audit page.

export type AuditEntry = {
  id: string;
  at: string;
  action: string;
  actor: string;
  label: string;
  detail: string | null;
  href: string | null;
  hrefLabel: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  profiles: { full_name: string; role: "ADMIN" | "CUSTOMER" } | null;
};

const AUDIT_SELECT = "id, action, entity_type, entity_id, metadata, created_at, profiles ( full_name, role )";

function actorName(row: AuditRow): string {
  if (!row.profiles) return "System";
  const name = row.profiles.full_name.trim();
  if (row.profiles.role === "ADMIN") return name || "Admin";
  return name ? `${name} (customer)` : "Customer";
}

/** Resolves links to the record each entry is about (orders need their number). */
async function toEntries(rows: AuditRow[]): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const idsOf = (type: string) => [...new Set(rows.filter((r) => r.entity_type === type && r.entity_id).map((r) => r.entity_id!))];
  const orderIds = idsOf("order");
  const refundIds = idsOf("refund");

  const [orders, refunds] = await Promise.all([
    orderIds.length
      ? supabase.from("orders").select("id, order_number").in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; order_number: string }[], error: null }),
    refundIds.length
      ? supabase.from("refunds").select("id, orders ( order_number )").in("id", refundIds)
      : Promise.resolve({ data: [] as { id: string; orders: { order_number: string } | null }[], error: null }),
  ]);
  if (orders.error) throw fromDbError(orders.error);
  if (refunds.error) throw fromDbError(refunds.error);
  const orderNumbers = new Map(orders.data.map((o) => [o.id, o.order_number]));
  const refundOrders = new Map(refunds.data.map((r) => [r.id, r.orders?.order_number ?? null]));

  return rows.map((row) => {
    let href: string | null = null;
    let hrefLabel: string | null = null;
    const id = row.entity_id;
    const orderNumber =
      row.entity_type === "order" && id ? orderNumbers.get(id) : row.entity_type === "refund" && id ? refundOrders.get(id) : null;
    if (orderNumber) {
      href = `/admin/orders/${orderNumber}`;
      hrefLabel = orderNumber;
    } else if (row.entity_type === "weekly_menu" && id) {
      href = `/admin/menu/${id}`;
      hrefLabel = "Menu";
    } else if (row.entity_type === "weekly_menu_product") {
      href = "/admin/inventory";
      hrefLabel = "Inventory";
    } else if (row.entity_type === "product" && id) {
      href = `/admin/products/${id}`;
      hrefLabel = "Product";
    } else if (row.entity_type === "system_setting") {
      href = "/admin/menu";
      hrefLabel = "Ordering settings";
    }
    return {
      id: row.id,
      at: row.created_at,
      action: row.action,
      actor: actorName(row),
      ...describeAuditEvent(row.action, row.metadata),
      href,
      hrefLabel,
    };
  });
}

export const AUDIT_PAGE_SIZE = 50;

export type AuditCursor = { at: string; id: string };

/**
 * The full log, newest first, optionally filtered by action. Paged by
 * (time, id): entries from one transaction share a timestamp.
 */
export async function getAuditLogs(filters: { action?: string; before?: AuditCursor } = {}): Promise<{
  entries: AuditEntry[];
  next: AuditCursor | null;
}> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_logs")
    .select(AUDIT_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.before) {
    const { at, id } = filters.before;
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
  }
  const { data, error } = await query.limit(AUDIT_PAGE_SIZE + 1);
  if (error) throw fromDbError(error);
  const rows = data as unknown as AuditRow[];
  const page = rows.slice(0, AUDIT_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    entries: await toEntries(page),
    next: rows.length > AUDIT_PAGE_SIZE ? { at: last.created_at, id: last.id } : null,
  };
}

/** Activity for specific records (e.g. an order and its refund), newest first. */
export async function getEntityActivity(targets: { type: string; ids: string[] }[]): Promise<AuditEntry[]> {
  const conditions = targets
    .filter((target) => target.ids.length > 0)
    .map((target) => `and(entity_type.eq.${target.type},entity_id.in.(${target.ids.join(",")}))`);
  if (conditions.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(AUDIT_SELECT)
    .or(conditions.join(","))
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  return toEntries(data as unknown as AuditRow[]);
}
