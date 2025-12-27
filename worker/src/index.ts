import { Hono } from "hono";
import { cors } from "hono/cors";
import puppeteer from "@cloudflare/puppeteer";
import { sanitizeLinkInText } from "./sanitizer";
import type { Env, RuleSet } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

async function loadRules(env: Env): Promise<RuleSet> {
  const cached = await env.RULES_KV.get("rules");
  if (cached) return JSON.parse(cached);
  return {};
}

app.get("/api/sanitize", async (c) => {
  const text = c.req.query("text");
  if (!text) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const rules = await loadRules(c.env);
  const sanitized = await sanitizeLinkInText(text, rules, 3);

  return c.json({
    text: sanitized.text,
    sanitizedURLs: sanitized.links,
  });
});

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    message_id: number;
  };
  inline_query?: {
    id: string;
    query: string;
  };
}

app.post("/api/bot/telegram", async (c) => {
  const update = await c.req.json<TelegramUpdate>();

  if (update.inline_query) {
    const query = update.inline_query.query;
    if (!query) {
      return c.json({
        method: "answerInlineQuery",
        inline_query_id: update.inline_query.id,
        results: [],
      });
    }

    const rules = await loadRules(c.env);
    const sanitized = await sanitizeLinkInText(query, rules, 1);

    if (sanitized.links.length === 0) {
      return c.json({
        method: "answerInlineQuery",
        inline_query_id: update.inline_query.id,
        results: [],
      });
    }

    return c.json({
      method: "answerInlineQuery",
      inline_query_id: update.inline_query.id,
      results: [
        {
          type: "article",
          id: "1",
          title: "Sanitized Link",
          description: sanitized.links[0],
          input_message_content: {
            message_text: sanitized.text,
          },
        },
      ],
      cache_time: 300,
    });
  }

  const text = update.message?.text;
  if (!text) {
    return c.json({ ok: true });
  }

  const rules = await loadRules(c.env);
  const sanitized = await sanitizeLinkInText(text, rules, 3);

  if (sanitized.links.length === 0) {
    return c.json({ ok: true });
  }

  return c.json({
    method: "sendMessage",
    chat_id: update.message!.chat.id,
    text: sanitized.text,
    reply_to_message_id: update.message!.message_id,
  });
});

interface MatrixEvent {
  room_id?: string;
  sender?: string;
  content?: { body?: string };
}

app.post("/api/bot/matrix", async (c) => {
  const event = await c.req.json<MatrixEvent>();
  const text = event.content?.body;

  if (!text) {
    return c.json({});
  }

  const rules = await loadRules(c.env);
  const sanitized = await sanitizeLinkInText(text, rules, 3);

  if (sanitized.links.length === 0) {
    return c.json({});
  }

  return c.json({
    body: sanitized.text,
    msgtype: "m.text",
    format: "org.matrix.custom.html",
    formatted_body: sanitized.text,
  });
});

const AI_TOOLS = [
  {
    name: "sanitize_url",
    description:
      "Sanitize a URL by identifying and removing tracking parameters while keeping essential ones",
    parameters: {
      type: "object" as const,
      properties: {
        sanitized_url: {
          type: "string",
          description: "The sanitized URL with tracking parameters removed",
        },
        removed_params: {
          type: "array",
          items: { type: "string" },
          description: "List of parameter names that were removed",
        },
        kept_params: {
          type: "array",
          items: { type: "string" },
          description: "List of parameter names that were kept as essential",
        },
        confidence: {
          type: "number",
          description: "Confidence score from 0 to 1",
        },
        suggested_rule: {
          type: "object",
          description: "Suggested sanitization rule for this domain",
          properties: {
            pattern: { type: "string" },
            allowedParams: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: [
        "sanitized_url",
        "removed_params",
        "kept_params",
        "confidence",
        "suggested_rule",
      ],
    },
  },
];

app.post("/api/ai-sanitize", async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: "Missing url" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  const params = Array.from(parsedUrl.searchParams.keys());
  if (params.length === 0) {
    return c.json({
      sanitizedUrl: url,
      confidence: 1,
      removedParams: [],
      keptParams: [],
      suggestedRule: null,
    });
  }

  const prompt = `Analyze this URL and identify tracking parameters vs essential parameters.

URL: ${url}
Domain: ${parsedUrl.hostname}
Path: ${parsedUrl.pathname}
Parameters: ${params.join(", ")}

Common tracking parameters include: utm_*, fbclid, gclid, ref, source, campaign, track*, share*, click*, etc.
Essential parameters are those needed for the page to work correctly (like id, v, p, page, q, etc).

Call the sanitize_url function with your analysis.`;

  const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [{ role: "user", content: prompt }],
    tools: AI_TOOLS,
  });

  const toolCall = response.tool_calls?.[0];
  if (!toolCall || toolCall.name !== "sanitize_url") {
    return c.json({
      sanitizedUrl: url,
      confidence: 0,
      removedParams: [],
      keptParams: params,
      suggestedRule: null,
      error: "AI could not analyze URL",
    });
  }

  const args = JSON.parse(toolCall.arguments);

  return c.json({
    sanitizedUrl: args.sanitized_url,
    confidence: args.confidence,
    removedParams: args.removed_params,
    keptParams: args.kept_params,
    suggestedRule: args.suggested_rule,
  });
});

interface PageRender {
  screenshot: Uint8Array;
  title: string;
  ogTitle: string;
  ogDescription: string;
}

async function renderPage(
  browserBinding: Fetcher,
  url: string,
): Promise<PageRender> {
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });

    const screenshot = (await page.screenshot({
      type: "png",
      fullPage: false,
    })) as Uint8Array;

    const title = await page.title();

    const ogTitle = await page
      .$eval('meta[property="og:title"]', (el) => el.getAttribute("content"))
      .catch(() => null);

    const ogDescription = await page
      .$eval('meta[property="og:description"]', (el) =>
        el.getAttribute("content"),
      )
      .catch(() => null);

    return {
      screenshot,
      title,
      ogTitle: ogTitle || "",
      ogDescription: ogDescription || "",
    };
  } finally {
    await browser.close();
  }
}

function quickHeuristicCheck(a: PageRender, b: PageRender): boolean | null {
  // Quick check: if titles are completely different, pages are different
  if (a.title && b.title && a.title !== b.title) {
    // Check if difference is just tracking-related suffix
    const normalize = (t: string) =>
      t.replace(/\s*[-|·]\s*.*$/, "").trim().toLowerCase();
    if (normalize(a.title) !== normalize(b.title)) {
      return false;
    }
  }

  // If OG metadata differs significantly, pages are likely different
  if (a.ogTitle && b.ogTitle && a.ogTitle !== b.ogTitle) {
    return false;
  }

  // Can't determine from heuristics alone
  return null;
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

async function compareWithVision(
  ai: Ai,
  a: PageRender,
  b: PageRender,
): Promise<boolean> {
  const imageA = arrayBufferToBase64(a.screenshot);
  const imageB = arrayBufferToBase64(b.screenshot);

  // First turn: describe the first image
  const describeA = await ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe the main content of this webpage screenshot in 2-3 sentences. Focus on the primary content, layout, and any key elements visible.",
          },
          {
            type: "image",
            image: imageA,
          },
        ],
      },
    ],
  });

  const descriptionA =
    typeof describeA === "object" && "response" in describeA
      ? (describeA as { response: string }).response
      : String(describeA);

  // Second turn: compare with the second image
  const comparison = await ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `I have two webpage screenshots. The first one shows: "${descriptionA}"

Now look at this second screenshot. Are these two pages showing the SAME content (same article, same product, same page)?
Ignore minor differences like:
- Different ads or promotional banners
- Slight layout variations
- Cookie consent popups

Answer with just "SAME" if they show the same main content, or "DIFFERENT" if they show different content.`,
          },
          {
            type: "image",
            image: imageB,
          },
        ],
      },
    ],
  });

  const result =
    typeof comparison === "object" && "response" in comparison
      ? (comparison as { response: string }).response
      : String(comparison);

  return result.toUpperCase().includes("SAME");
}

async function arePagesSimlar(
  ai: Ai,
  a: PageRender,
  b: PageRender,
): Promise<boolean> {
  // Step 1: Quick heuristic check
  const heuristicResult = quickHeuristicCheck(a, b);
  if (heuristicResult !== null) {
    return heuristicResult;
  }

  // Step 2: Use AI vision for accurate comparison
  return compareWithVision(ai, a, b);
}

app.post("/api/browser-sanitize", async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: "Missing url" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  const allParams = Array.from(parsedUrl.searchParams.entries());
  if (allParams.length === 0) {
    return c.json({
      sanitizedUrl: url,
      requiredParams: [],
      removedParams: [],
      suggestedRule: null,
    });
  }

  try {
    const originalPage = await renderPage(c.env.BROWSER, url);

    const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const noParamsPage = await renderPage(c.env.BROWSER, baseUrl);

    if (await arePagesSimlar(c.env.AI, originalPage, noParamsPage)) {
      return c.json({
        sanitizedUrl: baseUrl,
        requiredParams: [],
        removedParams: allParams.map(([k]) => k),
        suggestedRule: {
          pattern: `^${parsedUrl.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          allowedParams: [],
        },
      });
    }

    const requiredParams: string[] = [];

    for (const [key, value] of allParams) {
      const testUrl = new URL(baseUrl);
      for (const p of requiredParams) {
        const pValue = parsedUrl.searchParams.get(p);
        if (pValue) testUrl.searchParams.set(p, pValue);
      }
      testUrl.searchParams.set(key, value);

      const urlWithoutThisParam = new URL(baseUrl);
      for (const p of requiredParams) {
        const pValue = parsedUrl.searchParams.get(p);
        if (pValue) urlWithoutThisParam.searchParams.set(p, pValue);
      }
      const pageWithoutThisParam = await renderPage(
        c.env.BROWSER,
        urlWithoutThisParam.toString(),
      );

      if (!(await arePagesSimlar(c.env.AI, originalPage, pageWithoutThisParam))) {
        requiredParams.push(key);
      }
    }

    const sanitizedUrl = new URL(baseUrl);
    for (const p of requiredParams) {
      const pValue = parsedUrl.searchParams.get(p);
      if (pValue) sanitizedUrl.searchParams.set(p, pValue);
    }

    return c.json({
      sanitizedUrl: sanitizedUrl.toString(),
      requiredParams,
      removedParams: allParams
        .filter(([k]) => !requiredParams.includes(k))
        .map(([k]) => k),
      suggestedRule: {
        pattern: `^${parsedUrl.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        allowedParams: requiredParams,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: "Browser rendering failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export default app;
