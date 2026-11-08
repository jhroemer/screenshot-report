import test, { expect } from "@playwright/test";

test("test sample html", async ({ page }) => {
  const htmlUrl = new URL("../index.html", import.meta.url).href;
  await page.goto(htmlUrl);
  await expect(page).toHaveScreenshot("test.png");

  // take screenshots in both light and dark mode
  // one screenshot per feature
});

// TODO:
// 1. cover a snapshot that is not failing
// 2. failing snapshot
// 3. new snapshot
