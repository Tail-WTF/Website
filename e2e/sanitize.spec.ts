import { test, expect } from "@playwright/test";

test.describe("Sanitize Page", () => {
  test.describe("with mocked successful API", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/sanitize*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "https://example.com/page",
            sanitizedURLs: ["https://example.com/page"],
          }),
        });
      });
    });

    test("shows loading state initially", async ({ page }) => {
      // Delay the API response to see loading state
      await page.route("**/api/sanitize*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "https://example.com/page",
            sanitizedURLs: ["https://example.com/page"],
          }),
        });
      });

      await page.goto("/sanitize?url=https://example.com/page?tracking=123");
      await expect(page.getByText("Sanitizing...")).toBeVisible();
    });

    test("displays sanitized URL on success", async ({ page }) => {
      await page.goto("/sanitize?url=https://example.com/page?tracking=123");

      await expect(page.getByText("Your link is now sanitized!")).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveValue(
        "https://example.com/page",
      );
    });

    test("has link to open sanitized URL", async ({ page }) => {
      await page.goto("/sanitize?url=https://example.com/page?tracking=123");

      await expect(page.getByRole("textbox")).toBeVisible();
      const openLink = page.getByRole("link", { name: "Open Sanitized Link" });
      await expect(openLink).toHaveAttribute(
        "href",
        "https://example.com/page",
      );
    });
  });

  test.describe("with mocked failed API", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/sanitize*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "https://example.com/?unknown=param",
            sanitizedURLs: [],
          }),
        });
      });
    });

    test("shows error state when no sanitization rules match", async ({
      page,
    }) => {
      await page.goto("/sanitize?url=https://example.com/?unknown=param");

      await expect(page.getByText("Your link is not sanitized.")).toBeVisible();
      await expect(
        page.getByText("We were unable to sanitize your link"),
      ).toBeVisible();
    });

    test("shows Try AI and Try Browser Render buttons", async ({ page }) => {
      await page.goto("/sanitize?url=https://example.com/?unknown=param");

      await expect(page.getByRole("button", { name: "Try AI" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Try Browser Render" }),
      ).toBeVisible();
    });

    test("Try AI button triggers AI sanitization", async ({ page }) => {
      await page.route("**/api/ai-sanitize", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sanitizedUrl: "https://example.com/",
            confidence: 0.85,
            removedParams: ["unknown"],
            suggestedRule: {
              pattern: "^/.*$",
              allowedParams: [],
            },
          }),
        });
      });

      await page.goto("/sanitize?url=https://example.com/?unknown=param");
      await page.getByRole("button", { name: "Try AI" }).click();

      await expect(page.getByText("AI is analyzing your URL...")).toBeVisible();
      await expect(
        page.getByText("AI suggestion (confidence: 85%)"),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("textbox")).toHaveValue(
        "https://example.com/",
      );
    });

    test("shows suggested rule and GitHub submit link", async ({ page }) => {
      await page.route("**/api/ai-sanitize", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sanitizedUrl: "https://example.com/",
            confidence: 0.9,
            removedParams: ["tracking"],
            suggestedRule: {
              pattern: "^/.*$",
              allowedParams: [],
            },
          }),
        });
      });

      await page.goto("/sanitize?url=https://example.com/?tracking=123");
      await page.getByRole("button", { name: "Try AI" }).click();

      await expect(page.getByText("Suggested rule:")).toBeVisible({
        timeout: 5000,
      });
      const submitLink = page.getByRole("link", {
        name: "Submit Rule to GitHub",
      });
      await expect(submitLink).toBeVisible();
      await expect(submitLink).toHaveAttribute(
        "href",
        /github\.com\/Tail-WTF\/Rules\/issues\/new/,
      );
    });

    test("Try Browser Render button triggers browser sanitization", async ({
      page,
    }) => {
      await page.route("**/api/browser-sanitize", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sanitizedUrl: "https://example.com/",
            requiredParams: [],
            removedParams: ["tracking"],
            suggestedRule: {
              pattern: "^/.*$",
              allowedParams: [],
            },
          }),
        });
      });

      await page.goto("/sanitize?url=https://example.com/?tracking=123");
      await page.getByRole("button", { name: "Try Browser Render" }).click();

      await expect(
        page.getByText("Browser is testing parameters..."),
      ).toBeVisible();
      await expect(page.getByText("Browser-verified suggestion:")).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("error handling", () => {
    test("handles API network error", async ({ page }) => {
      await page.route("**/api/sanitize*", async (route) => {
        await route.abort("failed");
      });

      await page.goto("/sanitize?url=https://example.com/?tracking=123");

      await expect(page.getByText("Your link is not sanitized.")).toBeVisible();
    });

    test("handles AI sanitization failure", async ({ page }) => {
      await page.route("**/api/sanitize*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ text: "test", sanitizedURLs: [] }),
        });
      });

      await page.route("**/api/ai-sanitize", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "AI failed" }),
        });
      });

      await page.goto("/sanitize?url=https://example.com/?tracking=123");
      await page.getByRole("button", { name: "Try AI" }).click();

      await expect(page.getByText("AI sanitization failed.")).toBeVisible({
        timeout: 5000,
      });
    });
  });
});
