import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, createTestUser, deleteTestUsers, serviceClient, type TestUser } from "../security/helpers";

// Public rate limiter (Milestone 18): fixed windows in Postgres, keyed on
// server-computed hashes, callable by the service role only.

const subject = () => createHash("sha256").update(randomUUID()).digest("hex");
let customer: TestUser;

beforeAll(async () => {
  customer = await createTestUser("Limit Customer");
}, 30_000);

afterAll(async () => {
  await deleteTestUsers([customer].filter(Boolean));
}, 30_000);

describe("consume_public_rate_limit", () => {
  it("allows up to the limit, then refuses within the window", async () => {
    const key = subject();
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      const { data, error } = await serviceClient().rpc("consume_public_rate_limit", {
        bucket: "test_bucket", subject: key, max_hits: 3, window_seconds: 600,
      });
      expect(error).toBeNull();
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("keeps subjects and buckets independent", async () => {
    const key = subject();
    const call = (bucket: string, s: string) =>
      serviceClient().rpc("consume_public_rate_limit", { bucket, subject: s, max_hits: 1, window_seconds: 600 });
    expect((await call("test_a", key)).data).toBe(true);
    expect((await call("test_a", key)).data).toBe(false);
    expect((await call("test_b", key)).data).toBe(true);
    expect((await call("test_a", subject())).data).toBe(true);
  });

  it("refuses raw identifiers: only 64-char hex hashes are stored", async () => {
    const { error } = await serviceClient().rpc("consume_public_rate_limit", {
      bucket: "test_bucket", subject: "someone@example.com", max_hits: 3, window_seconds: 600,
    });
    expect(error?.message).toBe("INVALID_RATE_LIMIT");
    const { count } = await serviceClient()
      .from("rate_limits")
      .select("key", { count: "exact", head: true })
      .like("key", "%@%");
    expect(count).toBe(0);
  });

  it("visitors and customers cannot call it (no resetting or probing limits)", async () => {
    const args = { bucket: "sign_in_ip", subject: subject(), max_hits: 1, window_seconds: 60 };
    const anon = await anonClient().rpc("consume_public_rate_limit", args);
    expect(anon.error?.code).toBe("42501");
    const signedIn = await customer.client.rpc("consume_public_rate_limit", args);
    expect(signedIn.error?.code).toBe("42501");
  });

  it("the rate_limits table is not readable by clients", async () => {
    const { data, error } = await customer.client.from("rate_limits" as never).select("*").limit(1);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });
});
