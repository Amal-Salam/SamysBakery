import { defineConfig, devices } from "@playwright/test";

import { getLocalSupabaseEnv } from "./scripts/local-supabase-env.mjs";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// E2E runs against the local Supabase stack so test data never reaches the
// hosted project. The app is built into a separate directory with these values.
const localSupabase = getLocalSupabaseEnv();
Object.assign(process.env, localSupabase);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Runs against a production build so E2E reflects deployed behaviour.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...localSupabase,
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
