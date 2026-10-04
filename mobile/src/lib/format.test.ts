import { describe, expect, it } from "vitest";

import {
  availabilityText,
  formatDeliveryDate,
  formatLongDate,
  formatNaira,
  formatShortDate,
  formatWeekRange,
  groupByCategory,
} from "./format";
import type { Product } from "./types";

describe("formatNaira", () => {
  it.each([
    [6500, "₦6,500"],
    [13000, "₦13,000"],
    [1250000, "₦1,250,000"],
    [6500.5, "₦6,500.5"],
    [6500.55, "₦6,500.55"],
    [0, "₦0"],
  ])("%s → %s", (amount, expected) => {
    expect(formatNaira(amount)).toBe(expected);
  });
});

describe("dates (Lagos business dates, no timezone drift)", () => {
  it("formats short, long and ranges", () => {
    expect(formatShortDate("2026-10-06")).toBe("Tue 6 Oct");
    expect(formatShortDate("2026-10-06", true)).toBe("Tue 6 Oct 2026");
    expect(formatLongDate("2030-01-08")).toBe("Tuesday 8 January 2030");
    expect(formatWeekRange("2026-10-06", "2026-10-10")).toBe("Tue 6 Oct – Sat 10 Oct 2026");
  });

  it("labels today and tomorrow, including across months", () => {
    expect(formatDeliveryDate("2026-10-06", "2026-10-06")).toBe("Today, Tue 6 Oct");
    expect(formatDeliveryDate("2026-10-07", "2026-10-06")).toBe("Tomorrow, Wed 7 Oct");
    expect(formatDeliveryDate("2026-11-01", "2026-10-31")).toBe("Tomorrow, Sun 1 Nov");
    expect(formatDeliveryDate("2026-10-09", "2026-10-06")).toBe("Fri 9 Oct");
  });
});

it("availability text matches the website", () => {
  expect(availabilityText("AVAILABLE", 10)).toBe("10 available");
  expect(availabilityText("LOW_STOCK", 2)).toBe("Only 2 left");
  expect(availabilityText("SOLD_OUT", 0)).toBe("SOLD OUT");
});

it("groups by category display order, uncategorised last", () => {
  const p = (name: string, category: string | null, categoryOrder: number | null) =>
    ({ name, category, categoryOrder }) as Product;
  const groups = groupByCategory([p("Bun", null, null), p("Loaf", "Bread", 2), p("Cake", "Cakes", 1), p("Roll", "Bread", 2)]);
  expect(groups.map((g) => [g.name, g.products.map((x) => x.name)])).toEqual([
    ["Cakes", ["Cake"]],
    ["Bread", ["Loaf", "Roll"]],
    [null, ["Bun"]],
  ]);
});
