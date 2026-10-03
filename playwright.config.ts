import { defineConfig, devices } from "@playwright/test";

import { getLocalSupabaseEnv } from "./scripts/local-supabase-env.mjs";

const PORT = 3100;
const MENU_SLOT_TESTS = [/admin-weekly-menu\.spec\.ts/, /storefront\.(setup|teardown|spec)\.ts/, /cart\.spec\.ts/, /checkout\.spec\.ts/];
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
  // Only one DRAFT and one PUBLISHED menu can exist, so tests that need the
  // menu slots run as ordered projects: admin menu journey → storefront setup
  // (publishes a fixture menu) → storefront (read-only) → teardown.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: MENU_SLOT_TESTS },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: MENU_SLOT_TESTS },
    {
      name: "admin-menu",
      testMatch: /admin-weekly-menu\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront-setup",
      testMatch: /storefront\.setup\.ts/,
      dependencies: ["admin-menu"],
      teardown: "storefront-teardown",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "storefront-teardown", testMatch: /storefront\.teardown\.ts/ },
    {
      name: "storefront-desktop",
      testMatch: /(storefront|cart|checkout)\.spec\.ts/,
      dependencies: ["storefront-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront-mobile",
      testMatch: /(storefront|cart|checkout)\.spec\.ts/,
      dependencies: ["storefront-setup"],
      use: { ...devices["Pixel 7"] },
    },
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
