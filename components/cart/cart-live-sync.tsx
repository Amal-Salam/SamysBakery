"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Live cart sync (mobile M2): when this customer's cart changes anywhere —
// e.g. in the mobile app — re-render the server-evaluated cart views (header
// badge, drawer, cart and checkout pages). The Realtime event only says "your
// cart changed"; RLS limits it to the customer's own cart row, and the cart
// itself is always re-read through the normal server path.
export function CartLiveSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    (async () => {
      // Subscribe with the signed-in session so RLS applies to this customer.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`cart-sync:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${userId}` }, () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => router.refresh(), 250);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
