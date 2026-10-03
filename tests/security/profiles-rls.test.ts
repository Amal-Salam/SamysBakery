import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  createTestUser,
  deleteTestUsers,
  serviceClient,
  type TestUser,
} from "./helpers";

let customerA: TestUser;
let customerB: TestUser;
let admin: TestUser;

beforeAll(async () => {
  customerA = await createTestUser("Customer A");
  customerB = await createTestUser("Customer B");
  admin = await createTestUser("Admin User");

  const { error } = await serviceClient()
    .from("profiles")
    .update({ role: "ADMIN" })
    .eq("id", admin.id);
  if (error) throw new Error(`promote failed: ${error.message}`);
}, 30_000);

afterAll(async () => {
  await deleteTestUsers([customerA, customerB, admin].filter(Boolean));
}, 30_000);

describe("profile creation", () => {
  it("creates exactly one CUSTOMER profile per new user, with the sign-up name", async () => {
    const { data, error } = await serviceClient()
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", customerA.id);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: customerA.id, role: "CUSTOMER", full_name: "Customer A" }]);
  });
});

describe("customer isolation", () => {
  it("customer can read their own profile", async () => {
    const { data } = await customerA.client
      .from("profiles")
      .select("id, role")
      .eq("id", customerA.id)
      .single();
    expect(data).toEqual({ id: customerA.id, role: "CUSTOMER" });
  });

  it("customer A cannot read customer B's profile", async () => {
    const { data } = await customerA.client.from("profiles").select("id").eq("id", customerB.id);
    expect(data).toEqual([]);
  });

  it("customer sees only their own row when listing profiles", async () => {
    const { data } = await customerA.client.from("profiles").select("id");
    expect(data?.map((row) => row.id)).toEqual([customerA.id]);
  });

  it("customer can update their permitted fields", async () => {
    const { error } = await customerA.client
      .from("profiles")
      .update({ full_name: "Customer A Renamed", phone: "+2348000000000" })
      .eq("id", customerA.id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("profiles")
      .select("full_name, phone")
      .eq("id", customerA.id)
      .single();
    expect(data).toEqual({ full_name: "Customer A Renamed", phone: "+2348000000000" });
  });

  it("customer A cannot modify customer B's profile", async () => {
    await customerA.client
      .from("profiles")
      .update({ full_name: "hijacked" })
      .eq("id", customerB.id);

    const { data } = await serviceClient()
      .from("profiles")
      .select("full_name")
      .eq("id", customerB.id)
      .single();
    expect(data?.full_name).toBe("Customer B");
  });
});

describe("role protection", () => {
  it("customer cannot make themselves ADMIN", async () => {
    const { error } = await customerA.client
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", customerA.id);
    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", customerA.id)
      .single();
    expect(data?.role).toBe("CUSTOMER");
  });

  it("customer cannot insert a profile", async () => {
    const { error } = await customerA.client
      .from("profiles")
      .insert({ id: customerA.id, role: "ADMIN" });
    expect(error).not.toBeNull();
  });

  it("customer cannot delete their profile", async () => {
    await customerA.client.from("profiles").delete().eq("id", customerA.id);
    const { data } = await serviceClient().from("profiles").select("id").eq("id", customerA.id);
    expect(data).toHaveLength(1);
  });

  it("is_admin() is false for customers and true for admins", async () => {
    const customerCheck = await customerA.client.rpc("is_admin");
    const adminCheck = await admin.client.rpc("is_admin");
    expect(customerCheck.data).toBe(false);
    expect(adminCheck.data).toBe(true);
  });
});

describe("public access", () => {
  it("signed-out visitors cannot read any profile", async () => {
    const { data, error } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("admin access", () => {
  it("admin can read customer profiles", async () => {
    const { data } = await admin.client
      .from("profiles")
      .select("id")
      .in("id", [customerA.id, customerB.id]);
    expect(data?.map((row) => row.id).sort()).toEqual([customerA.id, customerB.id].sort());
  });

  it("admin still cannot change roles through the client API", async () => {
    const { error } = await admin.client
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", customerB.id);
    expect(error).not.toBeNull();
  });
});
