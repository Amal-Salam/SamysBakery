import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation, the Paystack webhook (signature-authenticated)
    // and the mobile API (bearer-token authenticated in lib/api/handler.ts).
    "/((?!_next/static|_next/image|favicon.ico|api/paystack/webhook|api/v1/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
