// Pure delivery-date rules (no I/O). The database functions
// eligible_delivery_dates() / delivery_date_status() are authoritative; this
// mirror documents the rules and is unit tested against the same cases.

import { addDays, isoWeekday } from "@/lib/utils/dates";

export type DeliveryDateStatus =
  | "VALID"
  | "MENU_UNAVAILABLE"
  | "ORDER_CUTOFF_PASSED"
  | "DELIVERY_DATE_INVALID";

export type MenuWeek = { weekStart: string; weekEnd: string };

const isDeliveryDay = (date: string) => {
  const weekday = isoWeekday(date);
  return weekday >= 2 && weekday <= 6;
};

/**
 * Tuesday–Saturday of the current menu week, never in the past, and today only
 * before the cutoff. `nowTime` and `cutoff` are Lagos "HH:MM".
 */
export function eligibleDeliveryDates(
  menu: MenuWeek | null,
  today: string,
  nowTime: string,
  cutoff: string
): string[] {
  if (!menu || menu.weekEnd < today) return [];
  const dates: string[] = [];
  for (let date = menu.weekStart > today ? menu.weekStart : today; date <= menu.weekEnd; date = addDays(date, 1)) {
    if (!isDeliveryDay(date)) continue;
    if (date === today && nowTime >= cutoff) continue;
    dates.push(date);
  }
  return dates;
}

export function deliveryDateStatus(
  requested: string,
  menu: MenuWeek | null,
  today: string,
  nowTime: string,
  cutoff: string
): DeliveryDateStatus {
  if (!menu || menu.weekEnd < today) return "MENU_UNAVAILABLE";
  if (eligibleDeliveryDates(menu, today, nowTime, cutoff).includes(requested)) return "VALID";
  if (
    requested === today &&
    isDeliveryDay(requested) &&
    requested >= menu.weekStart &&
    requested <= menu.weekEnd
  ) {
    return "ORDER_CUTOFF_PASSED";
  }
  return "DELIVERY_DATE_INVALID";
}
