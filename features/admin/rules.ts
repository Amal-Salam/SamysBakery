// Pure admin reporting rules (no I/O). Unit tested.
// Owner decision (Milestone 15): revenue periods are by payment date in
// Africa/Lagos — today, this menu week, this calendar month, all time.

import { addDays, isoWeekday } from "@/lib/utils/dates";

export const REVENUE_PERIODS = ["today", "week", "month", "all"] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

export const REVENUE_PERIOD_LABELS: Record<RevenuePeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

export type DateRange = { from: string | null; to: string | null };

/** The most recent Tuesday on or before `today` (the menu week's first day). */
export function weekStartOnOrBefore(today: string): string {
  return addDays(today, -((isoWeekday(today) - 2 + 7) % 7));
}

/**
 * Inclusive Lagos date range for a period. "This week" runs from the latest
 * Tuesday to today, so Sunday/Monday payments (for the coming week's orders
 * placed early) still fall in a week and no day is ever uncounted.
 */
export function revenuePeriodRange(period: RevenuePeriod, today: string): DateRange {
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: weekStartOnOrBefore(today), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "all":
      return { from: null, to: null };
  }
}

export function parseRevenuePeriod(value: unknown, fallback: RevenuePeriod = "week"): RevenuePeriod {
  return REVENUE_PERIODS.includes(value as RevenuePeriod) ? (value as RevenuePeriod) : fallback;
}

/** Orders still to be prepared: paid and not yet ready. */
export const PREPARATION_STATUSES = ["PAID", "RECEIVED", "BAKING"] as const;

/** Statuses of orders that are finished or will not be delivered. */
export const CLOSED_STATUSES = ["DELIVERED", "CANCELLED"] as const;
