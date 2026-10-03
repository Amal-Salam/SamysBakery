"use client";

import { useEffect, useState } from "react";

import { dismissCartNoticeAction } from "@/actions/cart";
import type { CartNotice } from "@/features/cart/service";

/**
 * One-time message after a guest cart was merged at sign-in. Always mounted so
 * the message stays visible after its cookie is cleared (clearing re-renders the
 * page without it); it won't appear again on the next visit.
 */
export function CartNoticeBanner({ notice }: { notice: CartNotice | null }) {
  const [shown] = useState(notice);

  useEffect(() => {
    if (notice) void dismissCartNoticeAction();
  }, [notice]);

  if (!shown) return null;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md bg-warning/10 px-4 py-3 text-body-sm text-warning">
      <p className="font-semibold">We updated your cart when you signed in.</p>
      {shown.capped.length > 0 ? (
        <p>Reduced to the quantity still available: {shown.capped.join(", ")}.</p>
      ) : null}
      {shown.dropped.length > 0 ? (
        <p>No longer available, so not added: {shown.dropped.join(", ")}.</p>
      ) : null}
    </div>
  );
}
