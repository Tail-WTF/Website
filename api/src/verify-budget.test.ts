import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pages = new Map<string, string>();

function shell(name: string): string {
  return `<html><head><meta property="og:title" content="${name}"></head><body></body></html>`;
}

function verify(url: string, ip: string) {
  return exports.default.fetch(
    `https://tail.wtf/api/probe?url=${encodeURIComponent(url)}`,
    { headers: { "cf-connecting-ip": ip } },
  );
}

beforeEach(() => {
  pages.clear();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const html = pages.get(url);
    if (html === undefined) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verification budget", () => {
  it("remembers a failed path and refuses other param combos without refetching", async () => {
    pages.set("https://pathcache.example/p?a=1", shell("Original"));
    pages.set("https://pathcache.example/", shell("Home"));
    pages.set("https://pathcache.example/p", shell("Other"));

    const first = await verify(
      "https://pathcache.example/p?a=1",
      "198.51.100.55",
    );
    expect(await first.text()).toContain('"method":"none"');

    pages.set("https://pathcache.example/p?b=2", shell("Original"));
    const second = await verify(
      "https://pathcache.example/p?b=2",
      "198.51.100.55",
    );
    const body = await second.text();
    expect(body).toContain('"method":"none"');
    expect(body).not.toContain('"type":"probe"');
  });

  it("says the budget ran out instead of pretending verification failed", async () => {
    pages.set("https://budget.example/", shell("Home"));

    for (let i = 0; i < 15; i++) {
      const url = `https://budget.example/p${i}?x=1`;
      pages.set(url, shell(`Page ${i}`));
      pages.set(`https://budget.example/p${i}`, shell(`Page ${i}`));
      await verify(url, "198.51.100.99");
    }

    const response = await verify(
      "https://budget.example/p99?x=1",
      "198.51.100.99",
    );
    const body = await response.text();
    expect(body).toContain('"reason":"budget"');
    expect(body).not.toContain('"type":"probe"');
  });
});
