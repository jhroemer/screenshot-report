import { expect, test } from "@playwright/test";

test("test sample html", async ({ page }) => {
  const htmlUrl = new URL("../index.html", import.meta.url).href;
  await page.goto(htmlUrl);
  if (process.env.FIXTURE_VARIANT === "baseline") {
    await page.locator("body").evaluate((body) => (body.textContent = "hello baseline"));
  }
  await expect(page).toHaveScreenshot("test.png");

  // take screenshots in both light and dark mode
  // one screenshot per feature
});

// TODO:
// 1. cover a snapshot that is not failing
// 2. failing snapshot
// 3. new snapshot
