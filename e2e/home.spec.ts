import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Link Sanitizer - Tail.WTF");
  });

  test("displays main heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Link Sanitizer" }),
    ).toBeVisible();
  });

  test("displays subtitle", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Chop trackers from shared link"),
    ).toBeVisible();
  });

  test("has URL input field", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("-> Paste your link here <-");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("name", "url");
  });

  test("has sanitize button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sanitize" })).toBeVisible();
  });

  test("navigates to sanitize page on form submit", async ({ page }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("-> Paste your link here <-");
    await input.fill("https://example.com/?tracking=123");

    await page.getByRole("button", { name: "Sanitize" }).click();

    await expect(page).toHaveURL(/\/sanitize\?url=/);
  });

  test("displays About section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Why sanitize links?" }),
    ).toBeVisible();
  });

  test("displays Privacy section with Cloudflare notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
    await expect(page.getByText("Cloudflare")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cloudflare's Privacy Policy" }),
    ).toHaveAttribute("href", "https://www.cloudflare.com/privacypolicy/");
  });

  test("has footer with GitHub link", async ({ page }) => {
    await page.goto("/");
    const githubLink = page.getByRole("link", { name: "GitHub" });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/Tail-WTF/Website",
    );
  });
});
