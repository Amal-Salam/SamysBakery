import type { RealtimeChannel } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Cart } from "@/lib/types";

type CartState = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (productId: string, quantity: number) => Promise<void>;
  update: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = createContext<CartState | null>(null);
const EMPTY: Cart = { items: [], subtotal: 0, itemCount: 0, canCheckout: false };

/**
 * The signed-in customer's cart, always as evaluated by the server. Live sync:
 * subscribes to the customer's OWN cart row (RLS-limited); a change made on the
 * website (or another device) triggers a re-read through the API.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; cart: Cart | null }>({ userId: null, cart: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const cart = await api<Cart>("/cart");
      setState({ userId, cart });
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't load your cart.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + whenever the app returns to the foreground.
  useEffect(() => {
    if (!userId) return;
    const first = setTimeout(() => void refresh(), 0);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void refresh());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [userId, refresh]);

  // Live signal for this customer's cart only.
  useEffect(() => {
    if (!userId || !session) return;
    let channel: RealtimeChannel | undefined;
    supabase.realtime.setAuth(session.access_token);
    channel = supabase
      .channel(`cart-sync:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void refresh(), 250);
      })
      .subscribe();
    return () => {
      clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, session?.access_token, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = useCallback(
    async (path: string, method: string, body?: unknown) => {
      const cart = await api<Cart>(path, { method, body });
      setState({ userId, cart });
    },
    [userId]
  );

  const value = useMemo<CartState>(
    () => ({
      cart: userId ? (state.userId === userId ? (state.cart ?? null) : null) : EMPTY,
      loading,
      error,
      refresh,
      add: (productId, quantity) => mutate("/cart/items", "POST", { productId, quantity }),
      update: (productId, quantity) => mutate(`/cart/items/${productId}`, "PATCH", { quantity }),
      remove: (productId) => mutate(`/cart/items/${productId}`, "DELETE"),
      clear: () => mutate("/cart", "DELETE"),
    }),
    [userId, state, loading, error, refresh, mutate]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
