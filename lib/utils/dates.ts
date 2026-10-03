// Business dates use Africa/Lagos (owner decision) regardless of server or
// browser timezone. Dates are ISO "YYYY-MM-DD" strings, matching Postgres DATE.

export const BUSINESS_TIME_ZONE = "Africa/Lagos";

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Parses YYYY-MM-DD as a calendar date (UTC midnight, no timezone drift). */
function toUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(isoDate: string): number {
  const day = toUtcDate(isoDate).getUTCDay();
  return day === 0 ? 7 : day;
}

const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Tue 6 Oct" (optionally with the year), without locale punctuation quirks. */
function formatShortDate(isoDate: string, withYear: boolean): string {
  const parts = dateParts.formatToParts(toUtcDate(isoDate));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const label = `${get("weekday")} ${get("day")} ${get("month")}`;
  return withYear ? `${label} ${get("year")}` : label;
}

/** "Tue 6 Oct – Sat 10 Oct 2026" */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatShortDate(weekStart, false)} – ${formatShortDate(weekEnd, true)}`;
}
