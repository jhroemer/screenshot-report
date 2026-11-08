import test from "@playwright/test";
import { exec } from "node:child_process";

test("runs test project tests", async () => {
  exec("npx playwright test test-project/tests/test.spec.ts");
});
