import { describe, expect, it } from "vitest";

import { clientIpFrom } from "@/lib/security/client-ip";

describe("clientIpFrom", () => {
  it("uses the first x-forwarded-for entry (set by Vercel)", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": " 198.51.100.2 " }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
