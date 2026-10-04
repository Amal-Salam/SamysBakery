// Pure order-status rules (no I/O). The database (update_order_status) is
// authoritative; this mirrors the owner-decided matrix for the admin UI.
//   * Forward: any later status (skipping allowed).
//   * Backward: one step only, reason required (DELIVERED included).
//   * CANCELLED: final; reached only through cancellation (Milestone 14).

export const ORDER_FLOW = ["PAID", "RECEIVED", "BAKING", "READY", "HANDED_TO_DELIVERY", "DELIVERED"] as const;
export type FlowStatus = (typeof ORDER_FLOW)[number];
export type OrderStatus = FlowStatus | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PAID: "Paid",
  RECEIVED: "Received",
  BAKING: "Baking/Preparing",
  READY: "Ready",
  HANDED_TO_DELIVERY: "Handed to delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export type StatusMove = { status: FlowStatus; kind: "FORWARD" | "CORRECTION" };

export function allowedStatusMoves(current: OrderStatus): StatusMove[] {
  if (current === "CANCELLED") return [];
  const index = ORDER_FLOW.indexOf(current);
  const forward = ORDER_FLOW.slice(index + 1).map((status) => ({ status, kind: "FORWARD" as const }));
  const back = index > 0 ? [{ status: ORDER_FLOW[index - 1], kind: "CORRECTION" as const }] : [];
  return [...forward, ...back];
}

export function moveKind(current: OrderStatus, next: OrderStatus): StatusMove["kind"] | null {
  return allowedStatusMoves(current).find((move) => move.status === next)?.kind ?? null;
}

/** Cancellation is permitted only before READY (PRD §19). */
export function isCancellable(status: OrderStatus): boolean {
  return status === "PAID" || status === "RECEIVED" || status === "BAKING";
}

/**
 * Admin order search input → canonical order number, or null if it can't be
 * one. Accepts "SAM-1001", "sam 1001", "#1001" or just "1001".
 */
export function normalizeOrderNumberQuery(input: string): string | null {
  const match = input.trim().match(/^#?(?:sam[\s-]*)?(\d{4,9})$/i);
  return match ? `SAM-${match[1]}` : null;
}
