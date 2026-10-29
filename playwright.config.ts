import { defineConfig, devices } from "@playwright/test";

/**
 * Velora — tests E2E Playwright.
 * Cible : build de production servie localement (loopback uniquement).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Argon2id (64 MiB, t=3) est lent sur les runners CI partagés :
    // 30s par défaut est trop juste pour la création du coffre.
    actionTimeout: 30_000,
  },
  expect: {
    timeout: 30_000,
  },
  // Timeout global par test : 90s (création coffre Argon2id + opérations CRUD)
  timeout: 90_000,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Évite tout conflit avec un PORT global du sandbox
      VELORA_TEST_PORT: "3100",
    },
  },
});
