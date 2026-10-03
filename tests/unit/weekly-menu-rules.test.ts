import { describe, expect, it } from "vitest";

import {
  effectiveMenuStatus,
  formatNaira,
  isWeekEnded,
  menuWeekStartFor,
  parseNaira,
  weekEndFor,
} from "@/features/weekly-menu/rules";
import { addDays, formatWeekRange, isoWeekday, lagosToday } from "@/lib/utils/dates";
import { addMenuProductSchema, updateMenuProductSchema } from "@/schemas/weekly-menu";

describe("lagosToday", () => {
  it("uses Lagos time, not UTC (23:30 UTC is already tomorrow in Lagos)", () => {
    expect(lagosToday(new Date("2026-10-05T23:30:00Z"))).toBe("2026-10-06");
  });
  it("matches UTC date during the Lagos day", () => {
    expect(lagosToday(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-05");
  });
});

describe("date helpers", () => {
  it("computes ISO weekdays", () => {
    expect(isoWeekday("2026-10-05")).toBe(1); // Monday
    expect(isoWeekday("2026-10-06")).toBe(2); // Tuesday
    expect(isoWeekday("2026-10-11")).toBe(7); // Sunday
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-29", 4)).toBe("2027-01-02");
  });
  it("formats a week range", () => {
    expect(formatWeekRange("2026-10-06", "2026-10-10")).toBe("Tue 6 Oct – Sat 10 Oct 2026");
  });
});

describe("menuWeekStartFor (mirrors the database function)", () => {
  it.each([
    ["2026-10-04", "2026-10-06"], // Sunday → upcoming Tuesday
    ["2026-10-05", "2026-10-06"], // Monday → tomorrow
    ["2026-10-06", "2026-10-06"], // Tuesday → today
    ["2026-10-08", "2026-10-06"], // Thursday → this week
    ["2026-10-10", "2026-10-06"], // Saturday → this week
    ["2026-12-28", "2026-12-29"], // Monday before New Year
    ["2027-01-02", "2026-12-29"], // Saturday after New Year
  ])("%s → %s", (today, expected) => {
    expect(menuWeekStartFor(today)).toBe(expected);
  });

  it("always returns a Tuesday whose Saturday has not passed", () => {
    for (let offset = 0; offset < 21; offset++) {
      const today = addDays("2026-10-01", offset);
      const start = menuWeekStartFor(today);
      expect(isoWeekday(start)).toBe(2);
      expect(isWeekEnded(weekEndFor(start), today)).toBe(false);
    }
  });
});

describe("week status", () => {
  it("treats a menu as ended only after Saturday", () => {
    expect(isWeekEnded("2026-10-10", "2026-10-10")).toBe(false);
    expect(isWeekEnded("2026-10-10", "2026-10-11")).toBe(true);
  });
  it("shows an ended published menu as expired before the job runs", () => {
    expect(effectiveMenuStatus("PUBLISHED", "2026-10-10", "2026-10-11")).toBe("EXPIRED");
    expect(effectiveMenuStatus("PUBLISHED", "2026-10-10", "2026-10-09")).toBe("PUBLISHED");
  });
});

describe("naira", () => {
  it.each([
    ["6500", 6500],
    ["6,500", 6500],
    ["₦ 6,500.50", 6500.5],
    ["0.5", 0.5],
  ])("parses %s", (input, expected) => {
    expect(parseNaira(input)).toBe(expected);
  });
  it.each(["", "abc", "6.505", "-100", "1e5", "6,5,0,0x"])("rejects %s", (input) => {
    expect(parseNaira(input)).toBeNull();
  });
  it("formats amounts", () => {
    expect(formatNaira(6500).replace(/\s/g, "")).toBe("₦6,500");
  });
});

describe("weekly-menu schemas", () => {
  const ids = {
    menuId: "20000000-0000-4000-8000-000000000001",
    productId: "10000000-0000-4000-8000-000000000001",
  };

  it("parses valid add input", () => {
    const parsed = addMenuProductSchema.parse({
      ...ids,
      price: "6,500",
      weeklyQuantity: "20",
      lowStockThreshold: "3",
    });
    expect(parsed).toMatchObject({ price: 6500, weeklyQuantity: 20, lowStockThreshold: 3 });
  });

  it.each([
    [{ price: "0" }, "price"],
    [{ price: "free" }, "price"],
    [{ weeklyQuantity: "-1" }, "weeklyQuantity"],
    [{ weeklyQuantity: "2.5" }, "weeklyQuantity"],
    [{ weeklyQuantity: "100000" }, "weeklyQuantity"],
    [{ lowStockThreshold: "" }, "lowStockThreshold"],
    [{ productId: "" }, "productId"],
  ])("rejects %o", (override, field) => {
    const result = addMenuProductSchema.safeParse({
      ...ids,
      price: "6500",
      weeklyQuantity: "20",
      lowStockThreshold: "0",
      ...override,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });

  it("limits description length on update", () => {
    const result = updateMenuProductSchema.safeParse({
      id: ids.menuId,
      name: "Sourdough",
      price: "6500",
      weeklyQuantity: "5",
      lowStockThreshold: "0",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
