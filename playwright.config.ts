import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  globalSetup: "./tests/global-setup.ts",
  ignoreSnapshots: !process.env.CI,
  reporter: [["list"], ["./src/reporter.ts"]],
});
