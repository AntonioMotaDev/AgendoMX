import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests of the critical flow, at phone width (375px), against a real
 * Next dev server and a real, disposable Postgres database (never dev/staging/prod).
 *
 * The server runs on its own port (3100) so a `pnpm dev` you already have open is
 * never reused by mistake: that one points at your development database.
 * Local Hyperdrive is redirected to the E2E database with the env var miniflare reads.
 */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/agendomx_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  // One shared database: tests reset it between runs, so they cannot overlap.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    // Traces cost a third of the run's CPU: turn them on only to debug a failure (--trace on).
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev -p ${E2E_PORT}`,
    // A static page: the server must count as "up" before global setup has created the database.
    url: `${E2E_BASE_URL}/offline`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: E2E_DATABASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
      // No Turnstile keys and no Resend key: development mode skips the first and logs emails instead of sending.
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      RESEND_API_KEY: "",
      // The legal pages, registration checkbox and booking notice are dark by default: E2E exercises them.
      LEGAL_PUBLISHED: "true",
      // Health businesses are admitted by default here to exercise the consent flow. `E2E_HEALTH=false` runs the launch
      // configuration (health categories not offered): `E2E_HEALTH=false pnpm test:e2e tests/e2e/legal.spec.ts`.
      HEALTH_CATEGORIES_ENABLED: process.env.E2E_HEALTH === "false" ? "false" : "true",
    },
  },
});
