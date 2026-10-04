import { config } from "@/config";

import { ApiError, parseEnvelope } from "./envelope";
import { supabase } from "./supabase";

export { ApiError };

const TIMEOUT_MS = 15_000;

/**
 * Calls the Samy's Bakery API (/api/v1) as the signed-in customer. The access
 * token comes from the encrypted session; the server verifies it and decides
 * everything (prices, stock, payment status). The app only sends intent.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach Samy's Bakery. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON (e.g. a proxy error page): handled as a generic failure below.
  }

  try {
    return parseEnvelope<T>(response.status, body);
  } catch (error) {
    // The server no longer accepts this session: sign out on this device only.
    if (error instanceof ApiError && error.status === 401 && token) {
      await supabase.auth.signOut({ scope: "local" });
    }
    throw error;
  }
}
