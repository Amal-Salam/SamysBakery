import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { fail, toFailure } from "@/lib/errors";
import { assertUser, type CurrentUser } from "@/lib/security/auth";
import { clientIpFrom } from "@/lib/security/client-ip";
import { consumeRateLimits, RATE_LIMITS, TOO_MANY_ATTEMPTS } from "@/lib/security/rate-limit";
import type { ActionResult, ErrorCode } from "@/types/api";

import { parseBearer } from "./bearer";
import { runWithApiContext } from "./context";

// Every /api/v1 endpoint goes through apiRoute(): bearer-token parsing, per-IP
// rate limit, authentication when required, the standard success/error
// envelope (API contract §3–4), and no caching. Deliberately no CORS headers:
// the API is for the native app, not for other websites' JavaScript.

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  MENU_UNAVAILABLE: 409,
  PRODUCT_UNAVAILABLE: 409,
  DELIVERY_DATE_INVALID: 400,
  ORDER_CUTOFF_PASSED: 409,
  CHECKOUT_INVALID: 400,
  PAYMENT_FAILED: 402,
  PAYMENT_VERIFICATION_FAILED: 502,
  PAYMENT_AMOUNT_MISMATCH: 409,
  PAYMENT_ALREADY_PROCESSED: 409,
  ORDER_NOT_CANCELLABLE: 409,
  REFUND_FAILED: 502,
  INTERNAL_ERROR: 500,
};

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function respond<T>(result: ActionResult<T>, status?: number) {
  const code = result.success ? 200 : (status ?? STATUS[result.error.code]);
  return NextResponse.json(result, { status: code, headers: NO_STORE });
}

type Params = Record<string, string | string[] | undefined>;
type HandlerContext = { request: NextRequest; params: Params };

export function apiRoute<T>(
  options: { auth: "required" },
  handler: (ctx: HandlerContext & { user: CurrentUser }) => Promise<T>
): (request: NextRequest, route: { params: Promise<Params> }) => Promise<NextResponse>;
export function apiRoute<T>(
  options: { auth: "optional" },
  handler: (ctx: HandlerContext) => Promise<T>
): (request: NextRequest, route: { params: Promise<Params> }) => Promise<NextResponse>;
export function apiRoute<T>(
  options: { auth: "required" | "optional" },
  handler: (ctx: HandlerContext & { user: CurrentUser }) => Promise<T>
) {
  return async (request: NextRequest, route: { params: Promise<Params> }) => {
    const ip = clientIpFrom(request.headers);
    if (!(await consumeRateLimits([{ bucket: "api_ip", subject: ip, ...RATE_LIMITS.apiPerIp }]))) {
      return respond(fail("FORBIDDEN", TOO_MANY_ATTEMPTS), 429);
    }

    const bearer = parseBearer(request.headers.get("authorization"));
    if (!bearer.ok) return respond(fail("UNAUTHENTICATED", "Please sign in again."));

    return runWithApiContext({ accessToken: bearer.token }, async () => {
      try {
        const user = options.auth === "required" ? await assertUser() : (undefined as unknown as CurrentUser);
        const data = await handler({ request, params: await route.params, user });
        return respond({ success: true, data });
      } catch (error) {
        return respond(toFailure(error));
      }
    });
  };
}
