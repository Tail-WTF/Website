import puppeteer from "@cloudflare/puppeteer";
import type { MetadataSource, PageMetadata } from "./metadata";

const NAVIGATION_TIMEOUT_MS = 8_000;
const RENDER_SETTLE_MS = 1_200;

export function browserMetadataSource(binding: Fetcher): MetadataSource {
  return async (url: string): Promise<PageMetadata | null> => {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
    try {
      browser = await puppeteer.launch(binding);
    } catch {
      return null;
    }

    try {
      const page = await browser.newPage();
      const response = await page
        .goto(url, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        })
        .catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));

      const extracted = (await page.evaluate(`(() => ({
        title: document.title,
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null,
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      }))()`)) as {
        title: string;
        ogTitle: string | null;
        ogDescription: string | null;
        canonical: string | null;
      };

      return {
        title: extracted.title.trim() || null,
        ogTitle: extracted.ogTitle?.trim() || null,
        ogDescription: extracted.ogDescription?.trim() || null,
        canonical: extracted.canonical?.trim() || null,
        status: response?.status() ?? 0,
      };
    } catch {
      return null;
    } finally {
      await browser.close();
    }
  };
}
