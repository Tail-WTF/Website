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

export default app;
