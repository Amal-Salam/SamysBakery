"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-checks a pending payment every few seconds (server re-verifies each time). */
export function PendingPaymentRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
