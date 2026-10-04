import { defineConfig, devices } from "@playwright/test";

import { getLocalSupabaseEnv } from "./scripts/local-supabase-env.mjs";

const PORT = 3100;
const MENU_SLOT_TESTS = [/admin-weekly-menu\.spec\.ts/, /storefront\.(setup|teardown|spec)\.ts/, /cart\.spec\.ts/, /checkout\.spec\.ts/, /payment\.spec\.ts/, /customer-journey\.spec\.ts/, /admin-journey\.spec\.ts/, /api-v1-menu\.spec\.ts/, /api-v1-cart\.spec\.ts/, /cart-sync\.spec\.ts/];
const baseURL = `http://localhost:${PORT}`;

// E2E runs against the local Supabase stack so test data never reaches the
// hosted project. The app is built into a separate directory with these values.
const localSupabase = getLocalSupabaseEnv();
// Automated tests use a local mock of the Paystack API (never the real one).
const MOCK_PAYSTACK_PORT = 3999;
const mockPaystack = {
  PAYSTACK_SECRET_KEY: "sk_test_mock_e2e",
  PAYSTACK_API_BASE: `http://127.0.0.1:${MOCK_PAYSTACK_PORT}`,
};
// …and a local mock of the Resend API.
const MOCK_RESEND_PORT = 3998;
const mockResend = {
  RESEND_API_KEY: "re_test_mock_e2e",
  RESEND_FROM_EMAIL: "Samy's Bakery <orders@example.com>",
  RESEND_API_BASE: `http://127.0.0.1:${MOCK_RESEND_PORT}`,
};
Object.assign(process.env, localSupabase, mockPaystack, mockResend);

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
      name: "admin-journey",
      testMatch: /admin-journey\.spec\.ts/,
      dependencies: ["admin-menu"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront-setup",
      testMatch: /storefront\.setup\.ts/,
      dependencies: ["admin-journey"],
      teardown: "storefront-teardown",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "storefront-teardown", testMatch: /storefront\.teardown\.ts/ },
    {
      name: "storefront-desktop",
      testMatch: /(storefront|cart|checkout|payment|customer-journey|api-v1-menu|api-v1-cart|cart-sync)\.spec\.ts/,
      dependencies: ["storefront-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront-mobile",
      testMatch: /(storefront|cart|checkout|payment|customer-journey|api-v1-menu|api-v1-cart|cart-sync)\.spec\.ts/,
      dependencies: ["storefront-setup"],
      use: { ...devices["Pixel 7"] },
    },
  ],
  // Runs against a production build so E2E reflects deployed behaviour.
  webServer: [
    {
      command: "node tests/e2e/mock-paystack.mjs",
      url: `http://127.0.0.1:${MOCK_PAYSTACK_PORT}/health`,
      reuseExistingServer: false,
      env: {
        MOCK_PAYSTACK_PORT: String(MOCK_PAYSTACK_PORT),
        PAYSTACK_SECRET_KEY: mockPaystack.PAYSTACK_SECRET_KEY,
        MOCK_PAYSTACK_WEBHOOK_URL: `${baseURL}/api/paystack/webhook`,
      },
    },
    {
      command: "node tests/e2e/mock-resend.mjs",
      url: `http://127.0.0.1:${MOCK_RESEND_PORT}/health`,
      reuseExistingServer: false,
      env: { MOCK_RESEND_PORT: String(MOCK_RESEND_PORT), RESEND_API_KEY: mockResend.RESEND_API_KEY },
    },
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...localSupabase,
        ...mockPaystack,
        ...mockResend,
        NEXT_PUBLIC_APP_URL: baseURL,
        NEXT_DIST_DIR: ".next-e2e",
        // The suite signs in hundreds of times from one IP. Honoured only against
        // the local Supabase stack (lib/security/rate-limit.ts); limits are
        // covered by tests/integration/rate-limits.test.ts.
        E2E_DISABLE_RATE_LIMITS: "1",
      },
    },
  ],
});
