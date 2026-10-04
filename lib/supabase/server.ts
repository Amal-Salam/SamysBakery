import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getApiContext } from "@/lib/api/context";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Per-request server client acting as the signed-in user (RLS applies).
 * Create a new client for every request; never share one across requests.
 */
export async function createSupabaseServerClient() {
  // Mobile API (/api/v1): act as the bearer-token user instead of reading cookies.
  const api = getApiContext();
  if (api) {
    return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: api.accessToken ? { Authorization: `Bearer ${api.accessToken}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; proxy.ts refreshes the session.
          }
        },
      },
    }
  );
}
