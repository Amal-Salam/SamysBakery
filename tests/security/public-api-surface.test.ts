import { describe, expect, it } from "vitest";

import { anonClient } from "./helpers";

// Over-the-wire check against the hosted Data API using only the publishable key —
// exactly what any visitor's browser (or attacker) can do.

const PRIVATE_TABLES = [
  "profiles",
  "addresses",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "payments",
  "refunds",
  "inventory_reservations",
  "inventory_adjustments",
  "audit_logs",
  "system_settings",
] as const;

const CATALOGUE_TABLES = [
  "categories",
  "products",
  "product_images",
  "weekly_menus",
  "weekly_menu_products",
] as const;

describe("public API surface (anon key)", () => {
  it.each(PRIVATE_TABLES)("anon cannot read %s", async (table) => {
    const { data, error } = await anonClient().from(table).select("*").limit(1);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it.each(CATALOGUE_TABLES)("anon can query %s (rows filtered by RLS)", async (table) => {
    const { error } = await anonClient().from(table).select("*").limit(1);
    expect(error).toBeNull();
  });

  it.each([...PRIVATE_TABLES, ...CATALOGUE_TABLES])("anon cannot insert into %s", async (table) => {
    const { error } = await anonClient().from(table).insert({} as never);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("anon cannot call privileged helper functions", async () => {
    const { error } = await anonClient().rpc("is_admin");
    expect(error).not.toBeNull();
  });

  it("anon cannot generate order numbers", async () => {
    const { error } = await anonClient().rpc("generate_order_number" as never);
    expect(error).not.toBeNull();
  });
});
