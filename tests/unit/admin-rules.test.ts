import { describe, expect, it } from "vitest";

import { parseRevenuePeriod, revenuePeriodRange, weekStartOnOrBefore } from "@/features/admin/rules";

// 2026-10-06 is a Tuesday.
describe("weekStartOnOrBefore", () => {
  it.each([
    ["2026-10-06", "2026-10-06"], // Tuesday → itself
    ["2026-10-07", "2026-10-06"],
    ["2026-10-10", "2026-10-06"], // Saturday
    ["2026-10-11", "2026-10-06"], // Sunday still belongs to the latest week
    ["2026-10-12", "2026-10-06"], // Monday
    ["2026-10-13", "2026-10-13"],
  ])("%s → %s", (today, expected) => {
    expect(weekStartOnOrBefore(today)).toBe(expected);
  });
});

describe("revenuePeriodRange", () => {
  it("today is a single Lagos date", () => {
    expect(revenuePeriodRange("today", "2026-10-08")).toEqual({ from: "2026-10-08", to: "2026-10-08" });
  });

  it("this week runs from the latest Tuesday to today", () => {
    expect(revenuePeriodRange("week", "2026-10-09")).toEqual({ from: "2026-10-06", to: "2026-10-09" });
    expect(revenuePeriodRange("week", "2026-10-12")).toEqual({ from: "2026-10-06", to: "2026-10-12" });
  });

  it("this month starts on the 1st, across year boundaries", () => {
    expect(revenuePeriodRange("month", "2026-10-09")).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(revenuePeriodRange("week", "2027-01-01")).toEqual({ from: "2026-12-29", to: "2027-01-01" });
  });

  it("all time is unbounded", () => {
    expect(revenuePeriodRange("all", "2026-10-09")).toEqual({ from: null, to: null });
  });
});

describe("parseRevenuePeriod", () => {
  it("accepts known periods and falls back to this week", () => {
    expect(parseRevenuePeriod("month")).toBe("month");
    expect(parseRevenuePeriod("forecast")).toBe("week");
    expect(parseRevenuePeriod(undefined)).toBe("week");
    expect(parseRevenuePeriod(["today"])).toBe("week");
  });
});
