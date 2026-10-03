import { describe, expect, it } from "vitest";

import { getRouteAccess, loginRedirectPath, safeRedirectPath } from "@/lib/auth/routes";

describe("getRouteAccess", () => {
  it.each([
    ["/", "public"],
    ["/menu", "public"],
    ["/menu/sourdough", "public"],
    ["/cart", "public"],
    ["/login", "public"],
    ["/auth/callback", "public"],
    ["/admin/login", "public"],
    ["/account", "customer"],
    ["/account/orders/SAM-1001", "customer"],
    ["/checkout", "customer"],
    ["/order-confirmation/SAM-1001", "customer"],
    ["/admin", "admin"],
    ["/admin/orders", "admin"],
    ["/admin/login-help", "admin"],
    ["/accounting", "public"],
    ["/administrator", "public"],
  ] as const)("%s → %s", (pathname, expected) => {
    expect(getRouteAccess(pathname)).toBe(expected);
  });
});

describe("safeRedirectPath", () => {
  it.each(["/", "/checkout", "/account/orders?page=2", "/menu#cakes"])(
    "allows same-origin path %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    }
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\t/evil.example",
    "checkout",
    "",
    null,
    undefined,
    42,
    "/".padEnd(3000, "a"),
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value, "/fallback")).toBe("/fallback");
  });
});

describe("loginRedirectPath", () => {
  it("sends customers to /login with the return path", () => {
    expect(loginRedirectPath("/checkout", "?step=delivery")).toBe(
      "/login?next=%2Fcheckout%3Fstep%3Ddelivery"
    );
  });

  it("sends admin routes to /admin/login", () => {
    expect(loginRedirectPath("/admin/orders")).toBe("/admin/login?next=%2Fadmin%2Forders");
  });
});
