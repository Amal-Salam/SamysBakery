import { describe, expect, it } from "vitest";

import { allowedStatusMoves, isCancellable, moveKind } from "@/features/orders/rules";

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
