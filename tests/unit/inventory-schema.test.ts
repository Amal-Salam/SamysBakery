import { describe, expect, it } from "vitest";

import { addInventorySchema } from "@/schemas/inventory";

const id = "30000000-0000-4000-8000-000000000001";

describe("addInventorySchema", () => {
  it("accepts a positive whole quantity with a reason", () => {
    expect(addInventorySchema.parse({ weeklyMenuProductId: id, quantity: "5", reason: "  Extra batch " })).toEqual({
      weeklyMenuProductId: id,
      quantity: 5,
      reason: "Extra batch",
    });
  });

  it.each(["0", "-3", "2.5", "abc", "", "10001"])("rejects quantity %j", (quantity) => {
    expect(addInventorySchema.safeParse({ weeklyMenuProductId: id, quantity, reason: "x" }).success).toBe(false);
  });

  it("requires a reason of at most 500 characters", () => {
    expect(addInventorySchema.safeParse({ weeklyMenuProductId: id, quantity: "1", reason: "   " }).success).toBe(false);
    expect(addInventorySchema.safeParse({ weeklyMenuProductId: id, quantity: "1", reason: "a".repeat(501) }).success).toBe(false);
  });

  it("requires a valid product id", () => {
    expect(addInventorySchema.safeParse({ weeklyMenuProductId: "nope", quantity: "1", reason: "x" }).success).toBe(false);
  });
});
