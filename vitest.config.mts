import path from "node:path";

import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

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
          include: ["tests/unit/**/*.test.ts", "features/**/*.test.ts", "lib/**/*.test.ts"],
        },
      },
      {
        // Runs against the linked Supabase project using .env.local.
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
          env: loadEnv("test", import.meta.dirname, ""),
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
