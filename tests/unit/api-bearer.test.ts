import { describe, expect, it } from "vitest";

import { parseBearer } from "@/lib/api/bearer";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

describe("parseBearer", () => {
  it("no header means anonymous", () => {
    expect(parseBearer(null)).toEqual({ ok: true, token: null });
    expect(parseBearer("  ")).toEqual({ ok: true, token: null });
  });

  it("accepts a well-formed bearer JWT", () => {
    expect(parseBearer(`Bearer ${JWT}`)).toEqual({ ok: true, token: JWT });
  });

  it.each([
    "Bearer",
    "Bearer ",
    `bearer ${JWT}`,
    `Basic ${JWT}`,
    `Bearer ${JWT} extra`,
    "Bearer not-a-jwt",
    "Bearer a.b",
    `Bearer ${JWT}.extra`,
    `Bearer ${"a".repeat(3000)}.${"b".repeat(1000)}.${"c".repeat(100)}`,
  ])("rejects a malformed header: %s", (header) => {
    expect(parseBearer(header)).toEqual({ ok: false });
  });
});
