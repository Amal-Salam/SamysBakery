import path from "node:path";

import { defineConfig } from "vitest/config";

import { getLocalSupabaseEnv } from "./scripts/local-supabase-env.mjs";

const alias = { "@": path.resolve(import.meta.dirname) };

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/unit/**/*.test.tsx",
            "tests/security/**/*.static.test.ts",
            "features/**/*.test.ts",
            "lib/**/*.test.ts",
          ],
        },
      },
      {
        // Runs against the local Supabase stack (`npx supabase start`), never the
        // hosted project, so test rows cannot accumulate there.
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
          exclude: ["tests/security/**/*.static.test.ts"],
          env: process.argv.some((arg) => arg.includes("db")) ? getLocalSupabaseEnv() : {},
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
