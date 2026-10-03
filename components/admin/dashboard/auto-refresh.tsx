"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the (server) dashboard every interval while the tab is visible,
// so new paid orders appear without a manual reload (owner decision: no
// Realtime). Data stays server-authoritative.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
