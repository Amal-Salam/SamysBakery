import { z } from "zod";

// Public configuration, safe for the browser. Each variable must be referenced
// literally so Next.js can inline it into client bundles.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join("."));
  throw new Error(
    `Invalid or missing public environment configuration: ${missing.join(", ")}`
  );
}

export const publicEnv = parsed.data;
