// Pure audit-log presentation (no I/O): turns an audit record's action and
// metadata into plain language for admins. Unit tested.

import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/rules";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatClockTime, formatWeekRange } from "@/lib/utils/dates";

/** Short names for every recorded action (also the Audit log filter). */
export const AUDIT_ACTION_NAMES: Record<string, string> = {
  ORDER_CREATED: "Order placed",
  ORDER_CONFIRMATION_EMAIL_SENT: "Confirmation email sent",
  ORDER_STATUS_CHANGED: "Order status changed",
  ORDER_CANCELLED: "Order cancelled",
  REFUND_INITIATED: "Refund initiated",
  REFUND_REQUESTED: "Refund sent to Paystack",
  REFUND_CONFIRMED: "Refund confirmed",
  REFUND_FAILED: "Refund failed",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_AMOUNT_MISMATCH: "Payment amount mismatch",
  PAYMENT_CURRENCY_MISMATCH: "Payment currency mismatch",
  LATE_PAYMENT_REFUSED: "Late payment refused",
  MENU_CREATED: "Week created",
  MENU_PUBLISHED: "Menu published",
  MENU_UNPUBLISHED: "Menu unpublished",
  MENU_EXPIRED: "Menu expired",
  MENU_PRODUCT_ADDED: "Menu product added",
  MENU_PRODUCT_UPDATED: "Menu product changed",
  MENU_PRODUCT_REMOVED: "Menu product removed",
  INVENTORY_INCREASED: "Stock added",
  PRODUCT_CREATED: "Product created",
  PRODUCT_UPDATED: "Product edited",
  PRODUCT_DELETED: "Product deleted",
  PRODUCT_IMAGE_ADDED: "Product photo added",
  PRODUCT_IMAGE_REMOVED: "Product photo removed",
  CATEGORY_CREATED: "Category created",
  CATEGORY_UPDATED: "Category renamed",
  CATEGORY_DELETED: "Category deleted",
  ORDER_CUTOFF_CHANGED: "Ordering cutoff changed",
  RESERVATION_TIMEOUT_CHANGED: "Payment hold time changed",
  ACCOUNT_ADMIN_ACTION: "Account role changed",
  ACCOUNT_DELETED: "Account deleted",
};

export type AuditDescription = { label: string; detail: string | null };

type Metadata = Record<string, unknown>;

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const money = (value: unknown) => formatNaira(Number(value));
const status = (value: unknown) => ORDER_STATUS_LABELS[value as OrderStatus] ?? text(value);
const role = (value: unknown) => (value === "ADMIN" ? "Admin" : value === "CUSTOMER" ? "Customer" : text(value));
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "added_quantity" → "Added quantity" for unknown actions. */
export function humanizeAction(action: string): string {
  const words = action.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function menuProductChanges(meta: Metadata): string | null {
  const changes = (meta.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
  const parts: string[] = [];
  if (changes.name) parts.push(`Name ${text(changes.name.from)} → ${text(changes.name.to)}`);
  if (changes.price) parts.push(`Price ${money(changes.price.from)} → ${money(changes.price.to)}`);
  if (changes.weekly_quantity) parts.push(`Quantity ${text(changes.weekly_quantity.from)} → ${text(changes.weekly_quantity.to)}`);
  if (changes.low_stock_threshold) {
    parts.push(`Low-stock alert ${text(changes.low_stock_threshold.from)} → ${text(changes.low_stock_threshold.to)}`);
  }
  const fields = (meta.fields ?? []) as string[];
  if (fields.length > 0) parts.push(`Edited ${fields.join(", ")}`);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function describeAuditEvent(action: string, metadata: unknown): AuditDescription {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as Metadata;
  const reason = meta.reason ? `Reason: ${text(meta.reason)}` : null;

  switch (action) {
    case "ORDER_CREATED":
      return { label: `Order placed and paid (${money(meta.subtotal)})`, detail: `Payment ${text(meta.payment_reference)}` };
    case "ORDER_CONFIRMATION_EMAIL_SENT":
      return { label: "Confirmation email sent", detail: null };
    case "ORDER_STATUS_CHANGED":
      return {
        label: `Status changed: ${status(meta.from)} → ${status(meta.to)}${meta.direction === "CORRECTION" ? " (correction)" : ""}`,
        detail: reason,
      };
    case "ORDER_CANCELLED":
      return {
        label: `Order cancelled by ${meta.cancelled_by === "CUSTOMER" ? "the customer" : "an admin"} (was ${status(meta.from)})`,
        detail: reason,
      };
    case "REFUND_INITIATED":
      return { label: `Refund of ${money(meta.amount)} requested`, detail: null };
    case "REFUND_REQUESTED":
      return {
        label: `Refund sent to Paystack${meta.reason === "LATE_PAYMENT" ? " (late payment)" : ""}`,
        detail: meta.provider_status ? `Paystack status: ${text(meta.provider_status)}` : null,
      };
    case "REFUND_CONFIRMED":
      return { label: "Refund confirmed by Paystack", detail: null };
    case "REFUND_FAILED":
      return { label: "Refund failed at Paystack", detail: null };
    case "PAYMENT_FAILED":
      return { label: `Payment ${text(meta.reference)} failed`, detail: null };
    case "PAYMENT_AMOUNT_MISMATCH":
    case "PAYMENT_CURRENCY_MISMATCH":
      return {
        label: `Payment ${text(meta.reference)} refused: ${action === "PAYMENT_AMOUNT_MISMATCH" ? "amount" : "currency"} didn't match`,
        detail: null,
      };
    case "LATE_PAYMENT_REFUSED":
      return {
        label: `Late payment ${text(meta.reference)} refused; automatic refund of ${money(meta.amount)} started`,
        detail: meta.reason === "PAID_AFTER_HOLD" ? "Paid after the stock hold expired" : "Stock no longer available",
      };
    case "MENU_CREATED":
      return {
        label: meta.week_start && meta.week_end ? `Week created: ${formatWeekRange(text(meta.week_start), text(meta.week_end))}` : "Week created",
        detail: null,
      };
    case "MENU_PUBLISHED":
      return {
        label: `Menu published${meta.product_count !== undefined ? ` with ${plural(Number(meta.product_count), "product")}` : ""}`,
        detail: null,
      };
    case "MENU_UNPUBLISHED":
      return { label: "Menu unpublished (back to draft)", detail: null };
    case "MENU_EXPIRED":
      return { label: "Menu expired after Saturday", detail: null };
    case "MENU_PRODUCT_ADDED":
      return {
        label: `${text(meta.name)} added: ${money(meta.price)}, ${text(meta.weekly_quantity)} available`,
        detail: meta.low_stock_threshold !== undefined ? `Low-stock alert at ${text(meta.low_stock_threshold)}` : null,
      };
    case "MENU_PRODUCT_UPDATED":
      return { label: `${text(meta.name)} changed`, detail: menuProductChanges(meta) };
    case "MENU_PRODUCT_REMOVED":
      return { label: `${text(meta.name)} removed from the menu`, detail: null };
    case "INVENTORY_INCREASED":
      return {
        label: `+${text(meta.quantity)} ${text(meta.product)} (available ${text(meta.available_before)} → ${text(meta.available_after)})`,
        detail: reason,
      };
    case "PRODUCT_CREATED":
      return { label: `Product created: ${text(meta.name)}`, detail: null };
    case "PRODUCT_UPDATED": {
      const fields = ((meta.fields ?? []) as string[]).join(", ");
      return {
        label: `Product edited: ${text(meta.name)}`,
        detail: [fields ? `Changed ${fields}` : null, meta.previous_name ? `previously “${text(meta.previous_name)}”` : null]
          .filter(Boolean)
          .join("; ") || null,
      };
    }
    case "PRODUCT_DELETED":
      return {
        label: `Product deleted: ${text(meta.name)}`,
        detail: meta.had_history ? "Kept for past orders and menus" : null,
      };
    case "PRODUCT_IMAGE_ADDED":
      return { label: `Photo added to ${text(meta.name)}`, detail: null };
    case "PRODUCT_IMAGE_REMOVED":
      return { label: `Photo removed from ${text(meta.name)}`, detail: null };
    case "CATEGORY_CREATED":
      return { label: `Category created: ${text(meta.name)}`, detail: null };
    case "CATEGORY_UPDATED":
      return { label: `Category renamed: ${text(meta.previous_name)} → ${text(meta.name)}`, detail: null };
    case "CATEGORY_DELETED":
      return { label: `Category deleted: ${text(meta.name)}`, detail: null };
    case "ORDER_CUTOFF_CHANGED":
      return {
        label: `Ordering cutoff changed: ${formatClockTime(text(meta.from))} → ${formatClockTime(text(meta.to))}`,
        detail: null,
      };
    case "RESERVATION_TIMEOUT_CHANGED":
      return { label: `Payment hold time changed: ${text(meta.from)} → ${text(meta.to)} minutes`, detail: null };
    case "ACCOUNT_ADMIN_ACTION":
      return {
        label: `Role changed: ${role(meta.from)} → ${role(meta.to)}${meta.name ? ` (${text(meta.name)})` : ""}`,
        detail: meta.via === "OPERATOR" ? "Changed by the operator script" : null,
      };
    case "ACCOUNT_DELETED":
      return {
        label: "A customer deleted their account",
        detail: meta.orders_anonymized !== undefined ? `${plural(Number(meta.orders_anonymized), "past order")} anonymized` : null,
      };
    default:
      return { label: AUDIT_ACTION_NAMES[action] ?? humanizeAction(action), detail: null };
  }
}
