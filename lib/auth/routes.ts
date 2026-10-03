// Route protection rules — docs/API & Server Action Contract.md §35.
// /cart is public: guests may use the cart; authentication is enforced at checkout.

export const LOGIN_PATH = "/login";
export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_HOME_PATH = "/admin";

const CUSTOMER_PROTECTED_PREFIXES = ["/account", "/checkout", "/order-confirmation"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export type RouteAccess = "public" | "customer" | "admin";

export function getRouteAccess(pathname: string): RouteAccess {
  if (matchesPrefix(pathname, ADMIN_LOGIN_PATH)) return "public";
  if (matchesPrefix(pathname, "/admin")) return "admin";
  if (CUSTOMER_PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return "customer";
  }
  return "public";
}

/**
 * Returns a same-origin relative path, or the fallback. Prevents open redirects
 * via `?next=` (absolute URLs, protocol-relative `//host`, backslash tricks).
 */
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) {
    return fallback;
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  // Reject control characters, which browsers may strip to form `//host`.
  if (/[\u0000-\u001f\u007f]/.test(next)) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginRedirectPath(pathname: string, search = ""): string {
  const loginPath = getRouteAccess(pathname) === "admin" ? ADMIN_LOGIN_PATH : LOGIN_PATH;
  const next = safeRedirectPath(`${pathname}${search}`);
  return `${loginPath}?next=${encodeURIComponent(next)}`;
}
