/**
 * The visitor's IP from request headers. On Vercel (the approved host),
 * `x-forwarded-for` is set by the platform, so its first entry is the real
 * client address. Pure for unit tests.
 */
export function clientIpFrom(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
}
