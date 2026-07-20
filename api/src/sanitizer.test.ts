import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetExpansionCache, sanitizeText, sanitizeURL } from "./sanitizer";
import type { RuleSet } from "./types";

interface StubbedResponse {
  status: number;
  headers?: Record<string, string>;
}

const routes = new Map<string, StubbedResponse>();

function stubFetch(method: string, url: string, response: StubbedResponse) {
  routes.set(`${method} ${url}`, response);
}

const rules: RuleSet = {
  "www.example.com": {
    sanitize: [
      {
        pattern: "^\\/item\\/\\d+",
        allowedParams: ["page"],
        sanitizePath: true,
        ignorableParamValues: { page: ["1"] },
      },
    ],
  },
  "ex.am": {
    expand: [{ pattern: ".*" }],
  },
};

beforeEach(() => {
  routes.clear();
  resetExpansionCache();
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method =
        (input instanceof Request ? input.method : init?.method) ?? "GET";
      const stubbed = routes.get(`${method} ${url}`);
      if (!stubbed) throw new Error(`Unexpected fetch: ${method} ${url}`);
      return new Response(null, {
        status: stubbed.status,
        headers: stubbed.headers,
      });
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizeURL", () => {
  it("applies domain rules: trims path, drops params, keeps allowed ones", async () => {
    const result = await sanitizeURL(
      "https://www.example.com/item/42/ref=share_x?utm_source=x&page=3",
      rules,
    );
    expect(result).toEqual({
      original: "https://www.example.com/item/42/ref=share_x?utm_source=x&page=3",
      sanitized: "https://www.example.com/item/42?page=3",
      method: "rule",
    });
  });

  it("drops allowed params carrying ignorable default values", async () => {
    const result = await sanitizeURL(
      "https://www.example.com/item/42?page=1",
      rules,
    );
    expect(result.sanitized).toBe("https://www.example.com/item/42");
  });

  it("leaves unknown domains untouched and says so", async () => {
    const result = await sanitizeURL(
      "https://unknown.example.org/p?utm_source=x",
      rules,
    );
    expect(result).toEqual({
      original: "https://unknown.example.org/p?utm_source=x",
      sanitized: "https://unknown.example.org/p?utm_source=x",
      method: "none",
    });
  });

  it("expands short links and applies the target's rules", async () => {
    stubFetch("HEAD", "https://ex.am/abc", {
      status: 302,
      headers: { location: "https://www.example.com/item/7?spm=share" },
    });

    const result = await sanitizeURL("https://ex.am/abc", rules);
    expect(result.sanitized).toBe("https://www.example.com/item/7");
    expect(result.method).toBe("rule");
  });

  it("falls back to GET when the shortener rejects HEAD", async () => {
    stubFetch("HEAD", "https://ex.am/head-hater", { status: 405 });
    stubFetch("GET", "https://ex.am/head-hater", {
      status: 302,
      headers: { location: "https://www.example.com/item/9" },
    });

    const result = await sanitizeURL("https://ex.am/head-hater", rules);
    expect(result.sanitized).toBe("https://www.example.com/item/9");
    expect(result.method).toBe("rule");
  });

  it("reports expansion alone when the target has no rules", async () => {
    stubFetch("HEAD", "https://ex.am/xyz", {
      status: 302,
      headers: { location: "https://unknown.example.org/page?id=1" },
    });

    const result = await sanitizeURL("https://ex.am/xyz", rules);
    expect(result).toEqual({
      original: "https://ex.am/xyz",
      sanitized: "https://unknown.example.org/page?id=1",
      method: "expanded",
    });
  });

  it("leaves the link unchanged when the shortener is unreachable", async () => {
    // No stub registered: the fetch rejects, like an unreachable host.
    const result = await sanitizeURL("https://ex.am/dead", rules);
    expect(result).toEqual({
      original: "https://ex.am/dead",
      sanitized: "https://ex.am/dead",
      method: "none",
    });
  });

  it("bounds every expansion request with a timeout signal", async () => {
    const seenSignals: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        seenSignals.push(
          input instanceof Request ? input.signal : init?.signal,
        );
        return new Response(null, {
          status: 302,
          headers: { location: "https://www.example.com/item/7" },
        });
      },
    );

    await sanitizeURL("https://ex.am/abc", rules);
    expect(seenSignals.length).toBeGreaterThan(0);
    for (const signal of seenSignals) {
      expect(signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("expands a repeated short link once, without recharging the gate", async () => {
    let fetches = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      fetches++;
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://ex.am/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://www.example.com/item/7" },
        });
      }
      return new Response(null, { status: 200 });
    });
    let gateCalls = 0;
    const gate = async () => {
      gateCalls++;
      return true;
    };

    const first = await sanitizeURL("https://ex.am/abc", rules, undefined, gate);
    const second = await sanitizeURL("https://ex.am/abc", rules, undefined, gate);
    expect(first.sanitized).toBe("https://www.example.com/item/7");
    expect(second.sanitized).toBe("https://www.example.com/item/7");
    expect(fetches).toBe(2);
    expect(gateCalls).toBe(1);
  });

  it("does not cache anything when the gate denies expansion", async () => {
    const denyingGate = async () => false;
    const denied = await sanitizeURL(
      "https://ex.am/abc",
      rules,
      undefined,
      denyingGate,
    );
    expect(denied.method).toBe("none");

    stubFetch("HEAD", "https://ex.am/abc", {
      status: 302,
      headers: { location: "https://www.example.com/item/7" },
    });
    const allowed = await sanitizeURL("https://ex.am/abc", rules, undefined, async () => true);
    expect(allowed.sanitized).toBe("https://www.example.com/item/7");
  });

  it("uses the injected verifier for unknown domains", async () => {
    const verifier = async (url: URL) => ({
      sanitized: `${url.origin}${url.pathname}`,
      method: "verified" as const,
    });

    const result = await sanitizeURL(
      "https://unknown.example.org/p?utm_source=x",
      rules,
      verifier,
    );
    expect(result).toEqual({
      original: "https://unknown.example.org/p?utm_source=x",
      sanitized: "https://unknown.example.org/p",
      method: "verified",
    });
  });
});

describe("sanitizeText", () => {
  it("replaces every processed link in the text and reports each", async () => {
    const text =
      "a https://www.example.com/item/1?x=1 b https://www.example.com/item/2/junk?page=2 c";
    const result = await sanitizeText(text, rules, { maxLinks: 3 });
    expect(result.text).toBe(
      "a https://www.example.com/item/1 b https://www.example.com/item/2?page=2 c",
    );
    expect(result.links).toHaveLength(2);
    expect(result.links.every((l) => l.method === "rule")).toBe(true);
  });

  it("returns text unchanged when it contains no links", async () => {
    const result = await sanitizeText("no links here", rules, { maxLinks: 3 });
    expect(result).toEqual({ text: "no links here", links: [] });
  });

  it("processes at most maxLinks links", async () => {
    const text =
      "https://www.example.com/item/1?x=1 https://www.example.com/item/2?x=1";
    const result = await sanitizeText(text, rules, { maxLinks: 1 });
    expect(result.links).toHaveLength(1);
    expect(result.text).toBe(
      "https://www.example.com/item/1 https://www.example.com/item/2?x=1",
    );
  });
});
