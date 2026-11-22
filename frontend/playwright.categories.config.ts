import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3106";

export default defineConfig({
  testDir: "./tests",
  testMatch: "category-live.e2e.spec.ts",
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
        BALSAVE_PREVIEW_PASSWORD: "balsave-category-browser-tests-only-password",
        BALSAVE_BACKEND_URL: "http://127.0.0.1:8106",
      },
    },
  ],
});
