import { test, expect } from "@playwright/test";

const KNOWN_URL =
  "https://www.amazon.com/Some-Product/dp/B0ABC123/?tag=aff-20&ref_=xyz";
const KNOWN_CLEAN = "https://www.amazon.com/Some-Product/dp/B0ABC123";
const UNKNOWN_URL = "https://unknown-domain.invalid/p?x=1";

test.describe("Home Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Link Sanitizer - Tail.WTF");
  });

  test("serves a full content security policy header", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'sha256-");
    expect(csp).toContain("frame-ancestors 'none'");
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

  test("displays About section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Why sanitize links?" }),
    ).toBeVisible();
  });

  test("displays Privacy section with Cloudflare notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
    await expect(page.getByText("powered by Cloudflare")).toBeVisible();
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

test.describe("Sanitization", () => {
  test.describe("with a known domain rule", () => {
    test("shows loading state on submit", async ({ page }) => {
      await page.goto("/");
      await page.getByPlaceholder("-> Paste your link here <-").fill(KNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();
      await expect(page.getByText("Your link is now sanitized!")).toBeVisible();
    });

    test("displays sanitized URL on success", async ({ page }) => {
      await page.goto("/");
      await page.getByPlaceholder("-> Paste your link here <-").fill(KNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("Your link is now sanitized!")).toBeVisible();
      await expect(
        page.getByRole("button", { name: KNOWN_CLEAN, exact: true }),
      ).toBeVisible();
    });

    test("has link to open sanitized URL", async ({ page }) => {
      await page.goto("/");
      await page.getByPlaceholder("-> Paste your link here <-").fill(KNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(
        page.getByRole("button", { name: KNOWN_CLEAN, exact: true }),
      ).toBeVisible();
      const openLink = page.getByRole("link", { name: "Open Sanitized Link" });
      await expect(openLink).toHaveAttribute("href", KNOWN_CLEAN);
    });

    test("can sanitize another link", async ({ page }) => {
      await page.goto("/");
      await page.getByPlaceholder("-> Paste your link here <-").fill(KNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("Your link is now sanitized!")).toBeVisible();
      await page.getByRole("button", { name: "Sanitize another link" }).click();

      await expect(
        page.getByRole("heading", { name: "Link Sanitizer" }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("-> Paste your link here <-"),
      ).toBeVisible();
    });
  });

  test.describe("with arbitrary text", () => {
    test("cleans every link inside surrounding text", async ({ page }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(
          `check ${KNOWN_URL} and https://open.spotify.com/track/aa11bb22cc33dd44ee55fg?si=x out`,
        );
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("Your link is now sanitized!")).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `check ${KNOWN_CLEAN} and https://open.spotify.com/track/aa11bb22cc33dd44ee55fg out`,
          exact: true,
        }),
      ).toBeVisible();
    });

    test("says so when the text contains no links", async ({ page }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill("just words, nothing to chop");
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("No links found.")).toBeVisible();
    });
  });

  test.describe("with an unknown domain", () => {
    test("shows error state when no sanitization rules match", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(UNKNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("Your link is not sanitized.")).toBeVisible();
      await expect(
        page.getByText("We were unable to sanitize your link"),
      ).toBeVisible();
    });

    test("offers live-page verification and GitHub submission", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(UNKNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(
        page.getByRole("button", { name: "Verify against live page" }),
      ).toBeVisible();
      const submitLink = page.getByRole("link", {
        name: "Submit Rule to GitHub",
      });
      await expect(submitLink).toBeVisible();
      await expect(submitLink).toHaveAttribute(
        "href",
        /github\.com\/Tail-WTF\/Rules\/issues\/new/,
      );
    });

    test("survives non-URL prefixes in the text", async ({ page }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(`!deep ${UNKNOWN_URL}`);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(page.getByText("Your link is not sanitized.")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Submit Rule to GitHub" }),
      ).toBeVisible();
    });

    test("offers a choice when multiple links are unsanitized", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(
          "https://unknown-a.invalid/p?x=1 and https://unknown-b.invalid/q?y=2",
        );
      await page.getByRole("button", { name: "Sanitize" }).click();

      await expect(
        page.getByText("Your links are not sanitized."),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "https://unknown-b.invalid/q?y=2" })
        .click();
      await expect(
        page.getByText("Couldn't sanitize this link."),
      ).toBeVisible();
    });

    test("reports honestly when verification cannot prove anything", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .getByPlaceholder("-> Paste your link here <-")
        .fill(UNKNOWN_URL);
      await page.getByRole("button", { name: "Sanitize" }).click();

      await page
        .getByRole("button", { name: "Verify against live page" })
        .click();
      await expect(
        page.getByText("Couldn't sanitize this link."),
      ).toBeVisible();
    });
  });
});
