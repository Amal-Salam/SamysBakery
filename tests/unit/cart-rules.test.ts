import { describe, expect, it } from "vitest";

import {
  combineLines,
  evaluateCart,
  mergeCarts,
  parseGuestCart,
  serializeGuestCart,
  type MenuFacts,
} from "@/features/cart/rules";

const A = "30000000-0000-4000-8000-00000000000a";
const B = "30000000-0000-4000-8000-00000000000b";
const C = "30000000-0000-4000-8000-00000000000c";

const facts = (overrides: Partial<MenuFacts> = {}): MenuFacts => ({
  name: "Sourdough",
  slug: "sourdough",
  price: 6500,
  image: null,
  available: 10,
  status: "AVAILABLE",
  ...overrides,
});

describe("guest cart cookie", () => {
  it("round-trips ids and quantities only", () => {
    const raw = serializeGuestCart([{ productId: A, quantity: 2 }]);
    expect(raw).not.toContain("price");
    expect(parseGuestCart(raw)).toEqual([{ productId: A, quantity: 2 }]);
  });

  it.each([
    ["not JSON", "{oops"],
    ["not an array", JSON.stringify({ p: A, q: 1 })],
    ["bad id", JSON.stringify([{ p: "not-a-uuid", q: 1 }])],
    ["zero quantity", JSON.stringify([{ p: A, q: 0 }])],
    ["negative quantity", JSON.stringify([{ p: A, q: -3 }])],
    ["fractional quantity", JSON.stringify([{ p: A, q: 1.5 }])],
    ["huge quantity", JSON.stringify([{ p: A, q: 100000 }])],
  ])("discards a tampered cookie (%s)", (_label, raw) => {
    expect(parseGuestCart(raw)).toEqual([]);
  });

  it("ignores injected price fields", () => {
    const raw = JSON.stringify([{ p: A, q: 1, price: 1 }]);
    expect(parseGuestCart(raw)).toEqual([{ productId: A, quantity: 1 }]);
  });
});

describe("combineLines", () => {
  it("combines the same product's quantities", () => {
    expect(
      combineLines([
        { productId: A, quantity: 1 },
        { productId: B, quantity: 2 },
        { productId: A, quantity: 3 },
      ])
    ).toEqual([
      { productId: A, quantity: 4 },
      { productId: B, quantity: 2 },
    ]);
  });
});

describe("evaluateCart", () => {
  it("prices lines from server facts and sums the subtotal", () => {
    const cart = evaluateCart(
      [
        { productId: A, quantity: 2 },
        { productId: B, quantity: 1 },
      ],
      new Map([
        [A, facts({ price: 6500 })],
        [B, facts({ name: "Brioche", price: 5000.5 })],
      ])
    );
    expect(cart.items.map((item) => item.lineTotal)).toEqual([13000, 5000.5]);
    expect(cart.subtotal).toBe(18000.5);
    expect(cart.itemCount).toBe(3);
    expect(cart.canCheckout).toBe(true);
  });

  it("avoids floating-point drift", () => {
    const cart = evaluateCart([{ productId: A, quantity: 3 }], new Map([[A, facts({ price: 0.1 })]]));
    expect(cart.subtotal).toBe(0.3);
  });

  it("flags lines that can't be bought and excludes them from the subtotal", () => {
    const cart = evaluateCart(
      [
        { productId: A, quantity: 5 },
        { productId: B, quantity: 1 },
        { productId: C, quantity: 1 },
      ],
      new Map([
        [A, facts({ available: 3, status: "LOW_STOCK" })],
        [B, facts({ available: 0, status: "SOLD_OUT" })],
      ])
    );
    expect(cart.items.map((item) => item.issue)).toEqual(["EXCEEDS_AVAILABLE", "SOLD_OUT", "UNAVAILABLE"]);
    expect(cart.subtotal).toBe(0);
    expect(cart.canCheckout).toBe(false);
  });

  it("an empty cart cannot check out", () => {
    expect(evaluateCart([], new Map()).canCheckout).toBe(false);
  });
});

describe("mergeCarts (sign-in)", () => {
  const menu = new Map([
    [A, facts({ name: "Sourdough", available: 5 })],
    [B, facts({ name: "Brioche", available: 0, status: "SOLD_OUT" })],
    [C, facts({ name: "Croissant", available: 10 })],
  ]);

  it("combines quantities", () => {
    const result = mergeCarts([{ productId: C, quantity: 2 }], [{ productId: C, quantity: 3 }], menu);
    expect(result.lines).toEqual([{ productId: C, quantity: 5 }]);
    expect(result.capped).toEqual([]);
  });

  it("caps at availability and reports it", () => {
    const result = mergeCarts([{ productId: A, quantity: 4 }], [{ productId: A, quantity: 3 }], menu);
    expect(result.lines).toEqual([{ productId: A, quantity: 5 }]);
    expect(result.capped).toEqual(["Sourdough"]);
  });

  it("drops guest lines that can no longer be bought, keeping the account's own line", () => {
    const result = mergeCarts([{ productId: B, quantity: 1 }], [{ productId: B, quantity: 2 }], menu);
    expect(result.lines).toEqual([{ productId: B, quantity: 1 }]);
    expect(result.dropped).toEqual(["Brioche"]);
  });

  it("leaves account-only lines untouched", () => {
    const result = mergeCarts(
      [{ productId: A, quantity: 9 }],
      [{ productId: C, quantity: 1 }],
      menu
    );
    expect(result.lines).toEqual([
      { productId: A, quantity: 9 },
      { productId: C, quantity: 1 },
    ]);
  });
});
