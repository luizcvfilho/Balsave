import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3105";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/category-live.e2e.spec.ts", "**/tag-live.e2e.spec.ts", "**/receivable-live.e2e.spec.ts", "**/reconciliation-live.e2e.spec.ts"],
  projects: [
    { name: "unit", testIgnore: "**/*.e2e.spec.ts" },
    { name: "chromium", testMatch: "**/*.e2e.spec.ts", use: { ...devices["Desktop Chrome"], baseURL } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3105",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
