// Pure presentation helpers, mirroring the website (unit tested).

import type { AvailabilityStatus, OrderStatus, PaymentStatus, Product } from "./types";

/** "₦6,500" / "₦6,500.50" — same rules as the website (no forced decimals). */
export function formatNaira(amount: number): string {
  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction === "00" ? "" : `.${fraction.replace(/0$/, "")}`;
  return `${negative ? "-" : ""}₦${grouped}${decimals}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Parses an ISO "YYYY-MM-DD" business date as a calendar date (no timezone drift). */
function parts(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday };
}

/** "Tue 6 Oct" (with year if asked). */
export function formatShortDate(isoDate: string, withYear = false): string {
  const p = parts(isoDate);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}${withYear ? ` ${p.year}` : ""}`;
}

/** "Tuesday 6 October 2026". */
export function formatLongDate(isoDate: string): string {
  const p = parts(isoDate);
  return `${WEEKDAYS_LONG[p.weekday]} ${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

/** "Tue 6 Oct – Sat 10 Oct 2026". */
export function formatWeekRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end, true)}`;
}

/** Delivery choices: "Today, Tue 6 Oct" / "Tomorrow, Wed 7 Oct" / "Thu 8 Oct". */
export function formatDeliveryDate(isoDate: string, today: string): string {
  const label = formatShortDate(isoDate);
  if (isoDate === today) return `Today, ${label}`;
  const t = parts(today);
  const tomorrow = new Date(Date.UTC(t.year, t.month - 1, t.day + 1)).toISOString().slice(0, 10);
  return isoDate === tomorrow ? `Tomorrow, ${label}` : label;
}

export function availabilityText(status: AvailabilityStatus, available: number): string {
  if (status === "SOLD_OUT") return "SOLD OUT";
  if (status === "LOW_STOCK") return `Only ${available} left`;
  return `${available} available`;
}

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
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export type CategoryGroup = { name: string | null; products: Product[] };

/** Same grouping as the website: by category display order; uncategorised last. */
export function groupByCategory(products: Product[]): CategoryGroup[] {
  const groups = new Map<string, { order: number; group: CategoryGroup }>();
  for (const product of products) {
    const key = product.category ?? "";
    if (!groups.has(key)) {
      groups.set(key, { order: product.categoryOrder ?? Number.MAX_SAFE_INTEGER, group: { name: product.category, products: [] } });
    }
    groups.get(key)!.group.products.push(product);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order).map((entry) => entry.group);
}

/** Same wording as the website's cart. */
export function cartIssueMessage(issue: "UNAVAILABLE" | "SOLD_OUT" | "EXCEEDS_AVAILABLE" | null, available: number): string | null {
  switch (issue) {
    case "UNAVAILABLE":
      return "No longer available — please remove it.";
    case "SOLD_OUT":
      return "Sold out — please remove it.";
    case "EXCEEDS_AVAILABLE":
      return `Only ${available} available — please reduce the quantity.`;
    default:
      return null;
  }
}

export const DELIVERY_FEE_NOTE =
  "Delivery fee is handled separately by our delivery partner and is not included in the amount paid to Samy's Bakery.";
