import { describe, expect, it } from "vitest";

import {
  availabilityMessage,
  availabilityStatus,
  calculateAvailable,
} from "@/features/inventory/rules";
import { groupByCategory } from "@/features/weekly-menu/rules";
import type { StorefrontProduct } from "@/features/weekly-menu/storefront";

describe("calculateAvailable (spec example: Database.md §10)", () => {
  it("weekly 20, 7 reserved → 13 available", () => {
    expect(calculateAvailable(20, 0, 7)).toBe(13);
  });
  it("admin adds +5 → capacity 25, 18 available", () => {
    expect(calculateAvailable(20, 5, 7)).toBe(18);
  });
  it("exact stock purchase leaves 0", () => {
    expect(calculateAvailable(1, 0, 1)).toBe(0);
  });
  it("never goes negative", () => {
    expect(calculateAvailable(2, 0, 5)).toBe(0);
  });
});

describe("availabilityStatus (mirrors the database)", () => {
  it.each([
    [0, 3, "SOLD_OUT"],
    [2, 3, "LOW_STOCK"],
    [3, 3, "LOW_STOCK"],
    [4, 3, "AVAILABLE"],
    [1, 0, "AVAILABLE"],
  ] as const)("%i left, threshold %i → %s", (available, threshold, expected) => {
    expect(availabilityStatus(available, threshold)).toBe(expected);
  });
});

describe("availabilityMessage (Design System §8)", () => {
  it("shows exact availability", () => {
    expect(availabilityMessage("AVAILABLE", 6)).toBe("6 available");
  });
  it("shows low stock", () => {
    expect(availabilityMessage("LOW_STOCK", 2)).toBe("Only 2 left");
  });
  it("shows sold out", () => {
    expect(availabilityMessage("SOLD_OUT", 0)).toBe("SOLD OUT");
  });
});

describe("groupByCategory", () => {
  const product = (id: string, category: { name: string; displayOrder: number } | null): StorefrontProduct => ({
    id,
    slug: id,
    name: id,
    description: "",
    ingredients: "",
    price: 1000,
    image: null,
    category,
    availableQuantity: 1,
    availabilityStatus: "AVAILABLE",
  });

  it("orders groups by category display order, uncategorized last", () => {
    const groups = groupByCategory([
      product("roll", null),
      product("loaf", { name: "Bread", displayOrder: 2 }),
      product("cake", { name: "Cakes", displayOrder: 1 }),
      product("bun", { name: "Bread", displayOrder: 2 }),
    ]);
    expect(groups.map((group) => group.name)).toEqual(["Cakes", "Bread", null]);
    expect(groups[1].products.map((p) => p.id)).toEqual(["loaf", "bun"]);
  });

  it("returns a single unnamed group when nothing is categorized", () => {
    const groups = groupByCategory([product("a", null), product("b", null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBeNull();
  });

  it("returns no groups for no products", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
