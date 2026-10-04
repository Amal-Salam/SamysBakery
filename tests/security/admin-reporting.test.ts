import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

// Revenue, inventory and customer lookup are admin data (Milestones 15–16):
// visitors and customers are refused over the real API.

let customer: TestUser;
let admin: TestUser;

beforeAll(async () => {
  customer = await createTestUser("Reporting Customer");
  admin = await createTestUser("Reporting Admin");
  const { error } = await serviceClient().from("profiles").update({ role: "ADMIN" }).eq("id", admin.id);
  if (error) throw new Error(`promote failed: ${error.message}`);
}, 30_000);

afterAll(async () => {
  await deleteTestUsers([customer, admin].filter(Boolean));
}, 30_000);

describe("revenue metrics authorization", () => {
  it("visitors cannot read revenue", async () => {
    const { data, error } = await anonClient().rpc("get_revenue_metrics", {});
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("customers cannot read revenue", async () => {
    const { data, error } = await customer.client.rpc("get_revenue_metrics", {});
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("admins can read the approved metrics", async () => {
    const { data, error } = await admin.client.rpc("get_revenue_metrics", { from_date: "2001-01-01", to_date: "2001-01-01" });
    expect(error).toBeNull();
    expect(data).toEqual({
      paid_count: 0,
      paid_total: 0,
      cancelled_count: 0,
      cancelled_total: 0,
      refunded_count: 0,
      refunded_total: 0,
      net_total: 0,
      products_sold: 0,
      products: [],
    });
  });
});

describe("admin operations authorization", () => {
  const calls = [
    ["get_menu_inventory", { target_menu_id: "00000000-0000-0000-0000-000000000000" }],
    ["admin_list_customers", {}],
    ["admin_get_customer", { target_user_id: "00000000-0000-0000-0000-000000000000" }],
    ["add_inventory", { target_weekly_menu_product_id: "00000000-0000-0000-0000-000000000000", quantity: 1, reason: "x" }],
  ] as const;

  it.each(calls)("visitors cannot call %s", async (fn, args) => {
    const { data, error } = await anonClient().rpc(fn as never, args as never);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it.each(calls)("customers cannot call %s", async (fn, args) => {
    const { data, error } = await customer.client.rpc(fn as never, args as never);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("customers cannot read other customers' emails; admins can look them up", async () => {
    const { data, error } = await admin.client.rpc("admin_get_customer", { target_user_id: customer.id });
    expect(error).toBeNull();
    expect(data?.[0]?.email).toBe(customer.email);
  });
});
