import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

// Request context for the mobile API (/api/v1). The website authenticates with
// session cookies; the app sends `Authorization: Bearer <access token>`. While a
// v1 handler runs, this context holds that token so the existing server client
// and current-user lookup act as that user (RLS applies) — the same feature code
// and database rules serve both clients. Outside /api/v1 the store is empty and
// nothing changes for the website.

export type ApiRequestContext = {
  /** Supabase access token from the Authorization header, or null when absent. */
  accessToken: string | null;
};

const storage = new AsyncLocalStorage<ApiRequestContext>();

export function runWithApiContext<T>(context: ApiRequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function getApiContext(): ApiRequestContext | undefined {
  return storage.getStore();
}
