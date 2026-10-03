// Environment for tests that write data: points the app and test clients at the
// local Supabase stack (`npx supabase start`) so the hosted project never
// accumulates test rows (archived products, append-only audit entries, ...).
// Local stack keys are Supabase's fixed public development keys.

import { execSync } from "node:child_process";

export function getLocalSupabaseEnv() {
  let status;
  try {
    const raw = execSync("npx supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    status = JSON.parse(raw.slice(raw.indexOf("{")));
  } catch {
    throw new Error(
      "Local Supabase is not running. Start it with `npx supabase start` before running database/E2E tests."
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
}
