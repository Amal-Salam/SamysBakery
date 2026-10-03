import "server-only";

import { z } from "zod";

// Server-only secrets. Read lazily so a missing secret fails the operation that
// needs it with a clear configuration error, without leaking its value.
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Invalid or missing server environment configuration: ${missing.join(", ")}`
    );
  }
  return parsed.data;
}
