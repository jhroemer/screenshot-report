import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  globalTimeout: 60 * 60 * 1000,
  reporter: "../src/reporter.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
