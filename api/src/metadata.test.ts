import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPageMetadata, verifyByMetadata } from "./metadata";

interface StubbedPage {
  status?: number;
  html: string;
}

const pages = new Map<string, StubbedPage>();
let fetchCount = 0;

function stubPage(url: string, page: StubbedPage) {
  pages.set(url, page);
}

function html(head: string): string {
  return `<!doctype html><html><head>${head}</head><body>content</body></html>`;
}

/** Head content describing a distinct piece of content. */
function content(name: string): string {
  return (
    `<title>${name} - Site</title>` +
    `<meta property="og:title" content="${name}">` +
    `<meta property="og:description" content="About ${name}">`
  );
}

beforeEach(() => {
  pages.clear();
  fetchCount = 0;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    fetchCount++;
    const url = input instanceof Request ? input.url : String(input);
    const page = pages.get(url);
    if (!page) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(page.html, {
      status: page.status ?? 200,
      headers: { "content-type": "text/html;charset=utf-8" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPageMetadata", () => {
  it("extracts title, og fields, and canonical link", async () => {
    stubPage("https://site.example/a", {
      html: html(
        `<title>My Page</title>` +
          `<meta property="og:title" content="OG Page">` +
          `<meta property="og:description" content="Desc">` +
          `<link rel="canonical" href="https://site.example/a-canonical">`,
      ),
    });

    const meta = await fetchPageMetadata("https://site.example/a");
    expect(meta).toEqual({
      title: "My Page",
      ogTitle: "OG Page",
      ogDescription: "Desc",
      canonical: "https://site.example/a-canonical",
      status: 200,
    });
  });

  it("returns null when the page cannot be fetched", async () => {
    const meta = await fetchPageMetadata("https://site.example/missing-stub");
    expect(meta).toBeNull();
  });
});

describe("verifyByMetadata", () => {
  it("returns null for URLs without params", async () => {
    const result = await verifyByMetadata(new URL("https://site.example/a"));
    expect(result).toBeNull();
  });

  it("gives up when the oracle cannot tell pages apart (SPA shell)", async () => {
    // Client-rendered app: every URL returns the same HTML shell, so metadata
    // comparison cannot prove anything. The control page looking identical to
    // the original must abort verification.
    const shell = html(content("App"));
    stubPage("https://spa.example/p/42?ref=share", { html: shell });
    stubPage("https://spa.example/", { html: shell });
    stubPage("https://spa.example/p/42", { html: shell });

    const result = await verifyByMetadata(
      new URL("https://spa.example/p/42?ref=share"),
    );
    expect(result).toBeNull();
  });

  it("prefers the page's own canonical URL when it shows the same content", async () => {
    stubPage("https://site.example/a?utm_source=x&id=5", {
      html: html(
        content("Article 5") +
          `<link rel="canonical" href="https://site.example/a?id=5">`,
      ),
    });
    stubPage("https://site.example/", { html: html(content("Home")) });
    stubPage("https://site.example/a?id=5", { html: html(content("Article 5")) });

    const result = await verifyByMetadata(
      new URL("https://site.example/a?utm_source=x&id=5"),
    );
    expect(result).toEqual({
      sanitized: "https://site.example/a?id=5",
      method: "canonical",
    });
  });

  it("strips all params when the stripped page provably shows the same content", async () => {
    stubPage("https://site.example/post/1?share_token=abc&src=tw", {
      html: html(content("Post One")),
    });
    stubPage("https://site.example/", { html: html(content("Home")) });
    stubPage("https://site.example/post/1", { html: html(content("Post One")) });

    const result = await verifyByMetadata(
      new URL("https://site.example/post/1?share_token=abc&src=tw"),
    );
    expect(result).toEqual({
      sanitized: "https://site.example/post/1",
      method: "verified",
    });
  });

  it("treats a differing og:description as a different page even when titles match", async () => {
    // Same title everywhere, but the description reveals the param matters.
    stubPage("https://site.example/list?page=2", {
      html: html(
        `<meta property="og:title" content="Listing">` +
          `<meta property="og:description" content="Page 2 of results">`,
      ),
    });
    stubPage("https://site.example/", { html: html(content("Home")) });
    stubPage("https://site.example/list", {
      html: html(
        `<meta property="og:title" content="Listing">` +
          `<meta property="og:description" content="Page 1 of results">`,
      ),
    });

    const result = await verifyByMetadata(
      new URL("https://site.example/list?page=2"),
    );
    expect(result).toBeNull();
  });

  it("finds the minimal required param set by binary search", async () => {
    const target = "https://site.example/watch?a=1&b=2&v=42&d=4";
    const video = html(content("Video 42"));
    const notFound = html(content("Not Found"));

    stubPage(target, { html: video });
    stubPage("https://site.example/", { html: html(content("Home")) });
    // Any candidate keeping v shows the video; anything without v does not.
    stubPage("https://site.example/watch", { html: notFound });
    stubPage("https://site.example/watch?a=1&b=2", { html: notFound });
    stubPage("https://site.example/watch?v=42&d=4", { html: video });
    stubPage("https://site.example/watch?v=42", { html: video });
    stubPage("https://site.example/watch?d=4", { html: notFound });

    const result = await verifyByMetadata(new URL(target));
    expect(result).toEqual({
      sanitized: "https://site.example/watch?v=42",
      method: "verified",
    });
    // Binary search should need far fewer fetches than one probe per param.
    expect(fetchCount).toBeLessThanOrEqual(8);
  });

  it("returns null when every param turns out to be required", async () => {
    const target = "https://site.example/p?a=1&b=2";
    stubPage(target, { html: html(content("Original")) });
    stubPage("https://site.example/", { html: html(content("Home")) });
    stubPage("https://site.example/p", { html: html(content("Other")) });
    stubPage("https://site.example/p?a=1", { html: html(content("Other")) });
    stubPage("https://site.example/p?b=2", { html: html(content("Other")) });

    const result = await verifyByMetadata(new URL(target));
    expect(result).toBeNull();
  });

  it("digs the one required param out of many within the probe budget", async () => {
    const target =
      "https://site.example/w?a=1&b=2&c=3&d=4&e=5&id=42&f=6&g=7&h=8&i=9";
    const video = html(content("Video 42"));
    const other = html(content("Not Found"));

    stubPage(target, { html: video });
    stubPage("https://site.example/", { html: html(content("Home")) });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      fetchCount++;
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://site.example/") {
        return new Response(html(content("Home")), {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      const hasId = new URL(url).searchParams.has("id");
      return new Response(url === target || hasId ? video : other, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    const result = await verifyByMetadata(new URL(target));
    expect(result).toEqual({
      sanitized: "https://site.example/w?id=42",
      method: "verified",
    });
    expect(fetchCount).toBeLessThanOrEqual(13);
  });

  it("gives up within the probe budget when nothing can be resolved", async () => {
    const target =
      "https://site.example/p?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10";
    stubPage(target, { html: html(content("Original")) });
    stubPage("https://site.example/", { html: html(content("Home")) });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      fetchCount++;
      const url = input instanceof Request ? input.url : String(input);
      if (url === target) {
        return new Response(html(content("Original")), {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://site.example/") {
        return new Response(html(content("Home")), {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response(html(content(`Variant ${fetchCount}`)), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    const result = await verifyByMetadata(new URL(target));
    expect(result).toBeNull();
    expect(fetchCount).toBeLessThanOrEqual(13);
  });

  it("gives up when the original page has no usable identity metadata", async () => {
    stubPage("https://site.example/p?a=1", { html: html("") });

    const result = await verifyByMetadata(new URL("https://site.example/p?a=1"));
    expect(result).toBeNull();
  });
});
