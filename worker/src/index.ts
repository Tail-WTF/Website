import { Hono } from "hono";
import { cors } from "hono/cors";
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
}

app.post("/api/bot/telegram", async (c) => {
  const update = await c.req.json<TelegramUpdate>();
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

export default app;
