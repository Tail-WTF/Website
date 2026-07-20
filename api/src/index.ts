import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { actorId } from "./actor";
import { outboundGateFor } from "./outbound-budget";
import { rules } from "./rules";
import { sanitizeText } from "./sanitizer";
import { telegramBot } from "./telegram";
import type { LinkResult, SanitizeOptions } from "./types";
import { deepClean } from "./deep-clean";

export { OutboundBudget } from "./outbound-budget";

const MAX_LINKS_PER_REQUEST = 10;

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

function ipActor(c: Ctx): Promise<string> {
  return actorId(c.env, "ip", c.req.header("cf-connecting-ip") ?? "unknown");
}

async function overRequestLimit(c: Ctx): Promise<boolean> {
  const { success } = await c.env.SANITIZE_RATE_LIMITER.limit({
    key: await ipActor(c),
  });
  return !success;
}

interface SanitizeRequest {
  text: string;
  deep: boolean;
  format: "json" | "text";
}

async function runSanitize(c: Ctx, request: SanitizeRequest) {
  const gate = outboundGateFor(c.env, await ipActor(c));
  const options: SanitizeOptions = {
    maxLinks: MAX_LINKS_PER_REQUEST,
    outboundGate: gate,
    verifier: request.deep
      ? (url) => deepClean(url, c.env, gate).then((outcome) => outcome.verdict)
      : undefined,
  };
  return sanitizeText(request.text, rules, options);
}

function sanitizeResponse(
  c: Ctx,
  request: SanitizeRequest,
  result: { text: string; links: LinkResult[] },
) {
  if (request.format === "text") {
    return c.text(result.text);
  }
  return c.json(result);
}

function isTrue(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

app.get("/api/sanitize", async (c) => {
  const text = c.req.query("text");
  if (!text) {
    return c.json({ error: "Missing text" }, 400);
  }
  if (await overRequestLimit(c)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const request: SanitizeRequest = {
    text,
    deep: isTrue(c.req.query("deep")),
    format: c.req.query("format") === "text" ? "text" : "json",
  };
  return sanitizeResponse(c, request, await runSanitize(c, request));
});

app.post("/api/sanitize", async (c) => {
  let body: { text?: string; deep?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.text) {
    return c.json({ error: "Missing text" }, 400);
  }
  if (await overRequestLimit(c)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const request: SanitizeRequest = {
    text: body.text,
    deep: body.deep === true || isTrue(c.req.query("deep")),
    format: c.req.query("format") === "text" ? "text" : "json",
  };
  return sanitizeResponse(c, request, await runSanitize(c, request));
});

app.get("/api/probe", async (c) => {
  let target: URL;
  try {
    target = new URL(c.req.query("url") ?? "");
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }
  if (await overRequestLimit(c)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const gate = outboundGateFor(c.env, await ipActor(c));

  return streamSSE(c, async (stream) => {
    const { verdict, reason } = await deepClean(target, c.env, gate, {
      onProbe: async (via, probe) => {
        await stream.writeSSE({
          data: JSON.stringify({ type: "probe", via, ...probe }),
        });
      },
      onBrowserRetry: async () => {
        await stream.writeSSE({
          data: JSON.stringify({ type: "notice", notice: "browser" }),
        });
      },
    });

    await stream.writeSSE({
      data: JSON.stringify(
        verdict
          ? { type: "result", ...verdict }
          : {
              type: "result",
              method: "none",
              ...(reason ? { reason } : {}),
            },
      ),
    });
  });
});

app.post("/api/bot/telegram", async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    c.req.header("x-telegram-bot-api-secret-token") !== secret
  ) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!c.env.TELEGRAM_BOT_TOKEN) {
    return c.json({ error: "Bot not configured" }, 500);
  }

  const bot = await telegramBot(c.env);
  await bot.handleUpdate(await c.req.json());
  return c.json({ ok: true });
});

export default app;
