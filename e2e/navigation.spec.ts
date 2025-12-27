import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("footer links work correctly", async ({ page }) => {
    await page.goto("/");

    // Check About link scrolls to section
    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL("/#about");

    // Check Privacy link scrolls to section
    await page.getByRole("link", { name: "Go to Privacy section" }).click();
    await expect(page).toHaveURL("/#privacy");

    // Check Tail.WTF link goes to home
    await page.getByRole("link", { name: "Tail.WTF" }).click();
    await expect(page).toHaveURL("/");
  });

  test("404 page displays correctly", async ({ page }) => {
    await page.goto("/nonexistent-page");

    await expect(page.getByText("Page Not Found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "<- Back to home page" }),
    ).toBeVisible();
  });

  test("404 page back link works", async ({ page }) => {
    await page.goto("/nonexistent-page");

    await page.getByRole("link", { name: "<- Back to home page" }).click();
    await expect(page).toHaveURL("/");
  });
});
