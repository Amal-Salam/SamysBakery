import { describe, expect, it } from "vitest";

import { allowedStatusMoves, isCancellable, moveKind, normalizeOrderNumberQuery } from "@/features/orders/rules";

describe("allowedStatusMoves (owner-decided matrix)", () => {
  it("from PAID: every later status, no correction", () => {
    expect(allowedStatusMoves("PAID")).toEqual([
      { status: "RECEIVED", kind: "FORWARD" },
      { status: "BAKING", kind: "FORWARD" },
      { status: "READY", kind: "FORWARD" },
      { status: "HANDED_TO_DELIVERY", kind: "FORWARD" },
      { status: "DELIVERED", kind: "FORWARD" },
    ]);
  });

  it("from READY: forward or one step back", () => {
    expect(allowedStatusMoves("READY")).toEqual([
      { status: "HANDED_TO_DELIVERY", kind: "FORWARD" },
      { status: "DELIVERED", kind: "FORWARD" },
      { status: "BAKING", kind: "CORRECTION" },
    ]);
  });

  it("DELIVERED can be corrected one step back", () => {
    expect(allowedStatusMoves("DELIVERED")).toEqual([{ status: "HANDED_TO_DELIVERY", kind: "CORRECTION" }]);
  });

  it("CANCELLED is final", () => {
    expect(allowedStatusMoves("CANCELLED")).toEqual([]);
  });

  it.each([
    ["RECEIVED", "READY", "FORWARD"],
    ["BAKING", "RECEIVED", "CORRECTION"],
    ["READY", "PAID", null],
    ["DELIVERED", "PAID", null],
    ["PAID", "PAID", null],
    ["PAID", "CANCELLED", null],
  ] as const)("%s → %s is %s", (from, to, expected) => {
    expect(moveKind(from, to)).toBe(expected);
  });
});

describe("isCancellable (only before READY)", () => {
  it.each([
    ["PAID", true],
    ["RECEIVED", true],
    ["BAKING", true],
    ["READY", false],
    ["HANDED_TO_DELIVERY", false],
    ["DELIVERED", false],
    ["CANCELLED", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isCancellable(status)).toBe(expected);
  });
});

describe("normalizeOrderNumberQuery", () => {
  it.each([
    ["SAM-1001", "SAM-1001"],
    ["sam-1001", "SAM-1001"],
    [" sam 1042 ", "SAM-1042"],
    ["#1001", "SAM-1001"],
    ["1001", "SAM-1001"],
    ["SAM-123456", "SAM-123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeOrderNumberQuery(input)).toBe(expected);
  });

  it.each(["", "SAM-", "12", "SAM-10a1", "1001; drop", "ORD-1001", "1".repeat(12)])("rejects %j", (input) => {
    expect(normalizeOrderNumberQuery(input)).toBeNull();
  });
});
