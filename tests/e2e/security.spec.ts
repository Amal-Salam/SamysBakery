import { expect, test } from "@playwright/test";

// Security hardening (Milestone 18): response headers and webhook limits.
// The rest of the suite runs in a real browser under this CSP, so a policy
// that broke a page, an upload or the Paystack redirect would fail there too.

test("pages are served with security headers", async ({ request }) => {
  for (const path of ["/", "/menu", "/login", "/admin/login"]) {
    const response = await request.get(path);
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("the webhook refuses oversized bodies before reading them", async ({ request }) => {
  const response = await request.post("/api/paystack/webhook", {
    headers: { "content-type": "application/json", "x-paystack-signature": "0".repeat(128) },
    data: JSON.stringify({ event: "charge.success", padding: "x".repeat(300 * 1024) }),
  });
  expect(response.status()).toBe(413);
});

test("the webhook still rejects unsigned events", async ({ request }) => {
  const response = await request.post("/api/paystack/webhook", {
    headers: { "content-type": "application/json", "x-paystack-signature": "0".repeat(128) },
    data: JSON.stringify({ event: "charge.success", data: { reference: "SAMY-NOPE" } }),
  });
  expect(response.status()).toBe(401);
});
