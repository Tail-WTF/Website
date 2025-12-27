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

export default app;
