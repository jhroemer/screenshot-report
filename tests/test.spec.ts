import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("renders failing screenshots", async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve("test-project/screenshot-report.html")).href);
  await expect(page).toHaveScreenshot("report.png", { fullPage: true });
});
