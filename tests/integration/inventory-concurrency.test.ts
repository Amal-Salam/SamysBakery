import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, serviceClient, type TestUser } from "../security/helpers";

// AGENTS.md §50: "Stock = 1; Customer A and Customer B attempt quantity 1 —
// only one reservation may succeed. The database transaction, not frontend
// timing, must guarantee this." Each customer uses their own connection and
// all reservations are fired at the same moment. Local Supabase stack only.

const service = serviceClient();
let menuId: string;
let deliveryDate: string;
let previousCutoff: string | undefined;

function assertLocal() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    throw new Error("Concurrency tests only run against the local Supabase stack");
  }
}

async function clearActiveMenus() {
  const { data } = await service.from("weekly_menus").select("id").in("status", ["DRAFT", "PUBLISHED"]);
  for (const menu of data ?? []) {
    const start = new Date(Date.UTC(1980, 0, 1 + 7 * Math.floor(Math.random() * 500)));
    while (start.getUTCDay() !== 2) start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
    await service
      .from("weekly_menus")
      .update({
        status: "EXPIRED",
        expired_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        week_start: start.toISOString().slice(0, 10),
        week_end: end.toISOString().slice(0, 10),
      })
      .eq("id", menu.id);
  }
}

beforeAll(async () => {
  assertLocal();
  await clearActiveMenus();
  const { data: cutoff } = await service.from("system_settings").select("value").eq("key", "ORDER_CUTOFF_TIME").single();
  previousCutoff = cutoff?.value as string | undefined;
  await service.from("system_settings").update({ value: "23:59" }).eq("key", "ORDER_CUTOFF_TIME");

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const { data: weekStart } = await service.rpc("menu_week_start_for", { today });
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 4);
  const { data: menu, error } = await service
    .from("weekly_menus")
    .insert({ week_start: weekStart as string, week_end: end.toISOString().slice(0, 10), status: "PUBLISHED", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`menu: ${error.message}`);
  menuId = menu!.id;
}, 60_000);

afterAll(async () => {
  await clearActiveMenus();
  await service.from("system_settings").update({ value: previousCutoff ?? "17:00" }).eq("key", "ORDER_CUTOFF_TIME");
}, 60_000);

async function productWithStock(stock: number): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data: product } = await service
    .from("products")
    .insert({ name: `Race ${suffix}`, slug: `race-${suffix}`, description: "", ingredients: "" })
    .select("id")
    .single();
  const { data: wmp, error } = await service
    .from("weekly_menu_products")
    .insert({ weekly_menu_id: menuId, product_id: product!.id, name_snapshot: `Race ${suffix}`, price: 1000, weekly_quantity: stock })
    .select("id")
    .single();
  if (error) throw new Error(`wmp: ${error.message}`);
  return wmp!.id;
}

/** A customer with a saved address and `quantity` of the product in their cart. */
async function customerWanting(productId: string, quantity: number) {
  const user = await createTestUser("Racer");
  const { data: address } = await service
    .from("addresses")
    .insert({ user_id: user.id, label: "Home", recipient_name: "R", phone: "0803 000 0000", address_line: "1 Rd", city: "Abuja", state: "FCT", is_default: true })
    .select("id")
    .single();
  const { data: cart } = await service.from("carts").insert({ user_id: user.id }).select("id").single();
  await service.from("cart_items").insert({ cart_id: cart!.id, weekly_menu_product_id: productId, quantity });
  return { user, addressId: address!.id };
}

async function reserveAll(customers: { user: TestUser; addressId: string }[]) {
  if (!deliveryDate) {
    const { data } = await customers[0].user.client.rpc("eligible_delivery_dates");
    const dates = data as unknown as string[];
    if (!dates?.length) throw new Error("No eligible delivery date (cutoff/menu setup)");
    deliveryDate = dates[dates.length - 1];
  }
  // Fire every reservation at once, each on its own authenticated connection.
  return Promise.all(
    customers.map(({ user, addressId }) =>
      user.client.rpc("reserve_checkout_inventory", {
        delivery_date: deliveryDate,
        address_id: addressId,
        special_notes: null as unknown as string,
      })
    )
  );
}

async function reservedQuantity(productId: string) {
  const { data } = await service
    .from("inventory_reservations")
    .select("quantity")
    .eq("weekly_menu_product_id", productId)
    .eq("status", "ACTIVE");
  return (data ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

describe("concurrent purchasing", () => {
  it("stock 1: two customers race for the last unit — exactly one succeeds", async () => {
    const productId = await productWithStock(1);
    const customers = await Promise.all([customerWanting(productId, 1), customerWanting(productId, 1)]);

    const results = await reserveAll(customers);
    const succeeded = results.filter((result) => !result.error);
    const failed = results.filter((result) => result.error);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error?.message).toBe("OUT_OF_STOCK");
    expect(await reservedQuantity(productId)).toBe(1);
  }, 60_000);

  it("stock 3: ten customers race — exactly three succeed, never oversold", async () => {
    const productId = await productWithStock(3);
    const customers = await Promise.all(Array.from({ length: 10 }, () => customerWanting(productId, 1)));

    const results = await reserveAll(customers);
    expect(results.filter((result) => !result.error)).toHaveLength(3);
    expect(results.filter((result) => result.error?.message === "OUT_OF_STOCK")).toHaveLength(7);
    expect(await reservedQuantity(productId)).toBe(3);
  }, 60_000);

  it("stock 5, two units each: at most two customers succeed (4 ≤ 5), never 6", async () => {
    const productId = await productWithStock(5);
    const customers = await Promise.all(Array.from({ length: 6 }, () => customerWanting(productId, 2)));

    const results = await reserveAll(customers);
    expect(results.filter((result) => !result.error)).toHaveLength(2);
    expect(await reservedQuantity(productId)).toBe(4);
  }, 60_000);

  it("a stock increase during contention is respected atomically", async () => {
    const productId = await productWithStock(1);
    const admin = await createTestUser("Race Admin");
    await service.from("profiles").update({ role: "ADMIN" }).eq("id", admin.id);
    const customers = await Promise.all(Array.from({ length: 4 }, () => customerWanting(productId, 1)));

    // The admin's stock increase and every reservation are in flight together.
    const [addResult, results] = await Promise.all([
      admin.client.rpc("add_inventory", { target_weekly_menu_product_id: productId, quantity: 2, reason: "Extra batch" }),
      reserveAll(customers),
    ]);
    expect(addResult.error).toBeNull();
    // Capacity ends at 3, so no more than 3 of the 4 customers can hold stock.
    const succeeded = results.filter((result) => !result.error).length;
    expect(succeeded).toBeGreaterThanOrEqual(1);
    expect(succeeded).toBeLessThanOrEqual(3);
    expect(await reservedQuantity(productId)).toBeLessThanOrEqual(3);
  }, 60_000);
});
