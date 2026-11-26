import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.BALSAVE_TEST_DATABASE_URL;
const identityPassword = process.env.BALSAVE_IDENTITY_DB_PASSWORD;
if (!databaseUrl || !identityPassword) {
  throw new Error("Set BALSAVE_TEST_DATABASE_URL and BALSAVE_IDENTITY_DB_PASSWORD for a disposable, migrated database.");
}
const { hostname, port } = new URL(databaseUrl);

const baseURL = "http://127.0.0.1:3106";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["category-live.e2e.spec.ts", "tag-live.e2e.spec.ts", "receivable-live.e2e.spec.ts", "reconciliation-live.e2e.spec.ts"],
  workers: 1,
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", colorScheme: "dark" } },
  ],
  webServer: [
    {
      command: "node tests/fixtures/category-backend.mjs",
      url: "http://127.0.0.1:8106/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3106",
      url: baseURL,
      reuseExistingServer: false,
      env: {
        BALSAVE_AUTH_SECRET: "balsave-browser-tests-only-internal-secret",
        BALSAVE_BETTER_AUTH_SECRET: "9e74646d95c93fa6cefd651d3b7a3f5b9740c32006d6b537f156fc5f574e6f4c",
        BALSAVE_IDENTITY_DB_HOST: hostname,
        BALSAVE_IDENTITY_DB_PORT: port || "5432",
        BALSAVE_IDENTITY_DB_PASSWORD: identityPassword,
        BALSAVE_APP_ORIGIN: baseURL,
        BALSAVE_BACKEND_URL: "http://127.0.0.1:8106",
      },
    },
  ],
});
