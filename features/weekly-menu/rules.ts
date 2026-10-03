// Pure weekly-menu rules (no I/O). The database enforces the same rules; these
// drive admin UI previews and messages. Unit tested.

import { addDays, isoWeekday } from "@/lib/utils/dates";

export type MenuStatus = "DRAFT" | "PUBLISHED" | "EXPIRED";

/**
 * Tuesday of the week "Create New Week" should cover (mirrors the database's
 * menu_week_start_for): Mon → tomorrow, Sun → in two days, Tue–Sat → this week.
 */
export function menuWeekStartFor(today: string): string {
  const weekday = isoWeekday(today);
  if (weekday === 1) return addDays(today, 1);
  if (weekday === 7) return addDays(today, 2);
  return addDays(today, -(weekday - 2));
}

export function weekEndFor(weekStart: string): string {
  return addDays(weekStart, 4);
}

/** True once the menu's Saturday has passed (Lagos date). */
export function isWeekEnded(weekEnd: string, today: string): boolean {
  return weekEnd < today;
}

/** Status shown to the admin; an ended-but-not-yet-expired menu reads as ended. */
export function effectiveMenuStatus(status: MenuStatus, weekEnd: string, today: string): MenuStatus {
  return status !== "EXPIRED" && isWeekEnded(weekEnd, today) ? "EXPIRED" : status;
}

/** Name, price and weekly quantity lock after the product's first order. */
export const LOCKED_FIELDS = ["name", "price", "weeklyQuantity"] as const;

/** Naira amount input ("6,500", "6500.50") → number, or null if invalid. */
export function parseNaira(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 6500 → "₦6,500" */
export function formatNaira(amount: number): string {
  return naira.format(amount);
}
