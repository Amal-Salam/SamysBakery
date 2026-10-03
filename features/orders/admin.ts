import "server-only";

import { CLOSED_STATUSES, PREPARATION_STATUSES } from "@/features/admin/rules";
import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lagosToday } from "@/lib/utils/dates";

import type { OrderStatus, PaymentStatus } from "./rules";

// Admin order reads/writes. Run as the signed-in admin; RLS lets admins read
// all orders, and status changes go through the audited database operation.

export type AdminOrderSummary = {
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  subtotal: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
};

/** Operational order views: by delivery date (owner decision) or by status. */
export const ORDER_VIEWS = ["today", "upcoming", "preparing", "ready"] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

export async function listAdminOrders(
  filters: { status?: OrderStatus; view?: OrderView; limit?: number } = {}
): Promise<AdminOrderSummary[]> {
  const supabase = await createSupabaseServerClient();
  const today = lagosToday();
  let query = supabase
    .from("orders")
    .select("order_number, recipient_name, delivery_date, subtotal, payment_status, order_status, created_at");
  if (filters.status) query = query.eq("order_status", filters.status);
  if (filters.view === "today") query = query.eq("delivery_date", today);
  if (filters.view === "upcoming") {
    query = query.gt("delivery_date", today).not("order_status", "in", `(${CLOSED_STATUSES.join(",")})`);
  }
  if (filters.view === "preparing") query = query.in("order_status", [...PREPARATION_STATUSES]);
  if (filters.view === "ready") query = query.eq("order_status", "READY");
  query =
    filters.view && filters.view !== "today"
      ? query.order("delivery_date", { ascending: true }).order("created_at", { ascending: true })
      : query.order("created_at", { ascending: false });
  const { data, error } = await query.limit(filters.limit ?? 200);
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    orderNumber: row.order_number,
    customerName: row.recipient_name,
    deliveryDate: row.delivery_date,
    subtotal: Number(row.subtotal),
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    createdAt: row.created_at,
  }));
}

export type AdminOrderDetail = AdminOrderSummary & {
  id: string;
  email: string;
  phone: string;
  address: string;
  additionalInfo: string | null;
  specialNotes: string | null;
  paidAt: string;
  items: { id: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  history: { at: string; from: string; to: string; direction: string; reason: string | null }[];
  refund: {
    status: "NOT_REFUNDED" | "REFUNDED";
    providerStatus: string | null;
    amount: number;
    requestedAt: string | null;
    processedAt: string | null;
  } | null;
};

export async function getAdminOrder(orderNumber: string): Promise<AdminOrderDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, recipient_name, email, phone, delivery_address, delivery_city, delivery_state,
       delivery_additional_info, special_notes, delivery_date, subtotal, payment_status, order_status,
       created_at, paid_at, order_items ( id, product_name, quantity, unit_price, line_total ),
       refunds ( status, provider_status, amount, requested_at, processed_at )`
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!order) return null;

  const { data: audit } = await supabase
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("entity_type", "order")
    .eq("entity_id", order.id)
    .in("action", ["ORDER_STATUS_CHANGED", "ORDER_CANCELLED"])
    .order("created_at", { ascending: false });

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.recipient_name,
    email: order.email,
    phone: order.phone,
    address: [order.delivery_address, order.delivery_city, order.delivery_state].join(", "),
    additionalInfo: order.delivery_additional_info,
    specialNotes: order.special_notes,
    deliveryDate: order.delivery_date,
    subtotal: Number(order.subtotal),
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    items: order.order_items.map((item) => ({
      id: item.id,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
    refund: order.refunds[0]
      ? {
          status: order.refunds[0].status,
          providerStatus: order.refunds[0].provider_status,
          amount: Number(order.refunds[0].amount),
          requestedAt: order.refunds[0].requested_at,
          processedAt: order.refunds[0].processed_at,
        }
      : null,
    history: (audit ?? []).map((entry) => {
      const meta = entry.metadata as Record<string, string | undefined>;
      return {
        at: entry.created_at,
        from: meta.from ?? "",
        to: meta.to ?? "CANCELLED",
        direction: meta.direction ?? "",
        reason: meta.reason ?? null,
      };
    }),
  };
}

const STATUS_ERRORS: Record<string, string> = {
  ORDER_CANCELLED: "This order is cancelled; its status can't change.",
  USE_CANCELLATION: "Use Cancel order to cancel an order.",
  NO_CHANGE: "The order already has that status.",
  REASON_REQUIRED: "Moving an order back needs a short reason (at least 3 characters).",
  REASON_TOO_LONG: "The reason is too long (500 characters at most).",
  INVALID_TRANSITION: "That status change isn't allowed. Orders can move forward, or back one step with a reason.",
  P0002: "That order could not be found.",
};

export async function updateOrderStatus(orderNumber: string, status: OrderStatus, reason: string | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_order_status", {
    target_order_number: orderNumber,
    new_status: status,
    reason: reason as string,
  });
  if (error) {
    const message = STATUS_ERRORS[error.message] ?? STATUS_ERRORS[error.code ?? ""];
    if (message) throw new AppError(error.code === "P0002" ? "NOT_FOUND" : "CONFLICT", message);
    throw fromDbError(error);
  }
}
