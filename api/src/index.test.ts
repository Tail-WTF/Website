import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gitHubIssueUrl } from "./telegram";
import { shouldEscalateToBrowser } from "./deep-clean";

const KNOWN_URL =
  "https://www.amazon.com/Some-Product/dp/B0ABC123/?tag=aff-20&ref_=xyz";
const KNOWN_CLEAN = "https://www.amazon.com/Some-Product/dp/B0ABC123";

function api(path: string): string {
  return `https://tail.wtf${path}`;
}

let nextUpdateId = 1;

function telegramPost(
  body: Record<string, unknown>,
  secret = "test-webhook-secret",
) {
  return exports.default.fetch(api("/api/bot/telegram"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify({ update_id: nextUpdateId++, ...body }),
  });
}

interface BotApiCall {
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const botApiCalls: BotApiCall[] = [];
let nextMessageId = 100;
let editCalls = 0;
let failEditAt = 0;

function botApi(method: string): BotApiCall[] {
  return botApiCalls.filter((call) => call.method === method);
}

const BOT_API_BASE = "https://api.telegram.org/bottest-bot-token/";

const pages = new Map<string, string>();

beforeEach(() => {
  pages.clear();
  botApiCalls.length = 0;
  nextMessageId = 100;
  editCalls = 0;
  failEditAt = 0;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method =
        (input instanceof Request ? input.method : init?.method) ?? "GET";

      if (url.startsWith(BOT_API_BASE)) {
        const apiMethod = url.slice(BOT_API_BASE.length);
        const body =
          input instanceof Request ? await input.text() : String(init?.body);
        const payload = body ? JSON.parse(body) : {};
        if (apiMethod !== "getMe") {
          botApiCalls.push({ method: apiMethod, payload });
        }
        if (apiMethod === "editMessageText" && ++editCalls === failEditAt) {
          return Response.json({
            ok: false,
            error_code: 400,
            description: "Bad Request: message to edit not found",
          });
        }
        const result =
          apiMethod === "getMe"
            ? {
                id: 1,
                is_bot: true,
                first_name: "Tail.WTF",
                username: "tailwtf_bot",
                can_join_groups: true,
                can_read_all_group_messages: false,
                supports_inline_queries: true,
              }
            : apiMethod === "sendMessage"
              ? {
                  message_id: nextMessageId++,
                  date: 0,
                  chat: { id: payload.chat_id, type: "private" },
                  text: payload.text,
                }
              : true;
        return Response.json({ ok: true, result });
      }

      const redirectTarget = pages.get(`${method} ${url}`);
      if (redirectTarget !== undefined) {
        return new Response(null, {
          status: 302,
          headers: { location: redirectTarget },
        });
      }

      const html = pages.get(url);
      if (html === undefined) throw new Error(`Unexpected fetch: ${url}`);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/sanitize", () => {
  it("sanitizes links in the text with bundled rules", async () => {
    const response = await exports.default.fetch(
      api(`/api/sanitize?text=${encodeURIComponent(`look ${KNOWN_URL}`)}`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: `look ${KNOWN_CLEAN}`,
      links: [
        { original: KNOWN_URL, sanitized: KNOWN_CLEAN, method: "rule" },
      ],
    });
  });

  it("rejects requests without text", async () => {
    const response = await exports.default.fetch(api("/api/sanitize"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing text" });
  });

  it("returns plain text when format=text", async () => {
    const response = await exports.default.fetch(
      api(
        `/api/sanitize?format=text&text=${encodeURIComponent(KNOWN_URL)}`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe(KNOWN_CLEAN);
  });

  it("allows cross-origin use", async () => {
    const response = await exports.default.fetch(
      api(`/api/sanitize?text=${encodeURIComponent(KNOWN_URL)}`),
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("does not touch unknown domains unless deep is requested", async () => {
    const url = "https://unknown.example.org/p?share=abc";
    const response = await exports.default.fetch(
      api(`/api/sanitize?text=${encodeURIComponent(url)}`),
    );
    expect(await response.json()).toEqual({
      text: url,
      links: [{ original: url, sanitized: url, method: "none" }],
    });
  });

  it("verifies unknown domains against live pages when deep=true", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    pages.set("https://unknown.example.org/p?share=abc", html);
    pages.set("https://unknown.example.org/p", html);

    const url = "https://unknown.example.org/p?share=abc";
    const response = await exports.default.fetch(
      api(`/api/sanitize?deep=true&text=${encodeURIComponent(url)}`),
    );
    expect(await response.json()).toEqual({
      text: "https://unknown.example.org/p",
      links: [
        {
          original: url,
          sanitized: "https://unknown.example.org/p",
          method: "verified",
        },
      ],
    });
  });
});

describe("POST /api/sanitize", () => {
  it("accepts JSON bodies", async () => {
    const response = await exports.default.fetch(api("/api/sanitize"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: KNOWN_URL }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { text: string };
    expect(body.text).toBe(KNOWN_CLEAN);
  });
});

describe("outbound budget", () => {
  function shortLink(token: string): string {
    pages.set(
      `HEAD https://bit.ly/${token}`,
      "https://unknown.example.org/page?id=1",
    );
    return `https://bit.ly/${token}`;
  }

  it("serves unlimited rule-based messages from one Telegram user", async () => {
    for (let i = 0; i < 20; i++) {
      botApiCalls.length = 0;
      await telegramPost({
        message: {
          chat: { id: 111 },
          message_id: i,
          text: `/sanitize ${KNOWN_URL}`,
        },
      });
      expect(botApi("sendMessage")[0]?.payload.text).toBe(
        `<a href="${KNOWN_CLEAN}">${KNOWN_CLEAN}</a>`,
      );
    }
  });

  it("stops expanding for a Telegram user once the 12h budget is spent", async () => {
    const expandedText = `<a href="https://unknown.example.org/page?id=1">https://unknown.example.org/page?id=1</a>`;
    let expansions = 0;
    let denied = false;
    for (let i = 0; i < 20; i++) {
      botApiCalls.length = 0;
      await telegramPost({
        message: {
          chat: { id: 999 },
          message_id: i,
          text: `/sanitize ${shortLink(`t${i}`)}`,
        },
      });
      const [edit] = botApi("editMessageText");
      if (edit?.payload.text === expandedText) {
        expansions++;
      } else {
        expect(edit?.payload.text.startsWith("😢")).toBe(true);
        denied = true;
        break;
      }
    }
    expect(expansions).toBe(15);
    expect(denied).toBe(true);
  });

  it("budget denial for one user does not affect another", async () => {
    await telegramPost({
      message: {
        chat: { id: 424242 },
        message_id: 1,
        text: `/sanitize ${shortLink("other")}`,
      },
    });
    const [edit] = botApi("editMessageText");
    expect(edit?.payload.text).toBe(
      `<a href="https://unknown.example.org/page?id=1">https://unknown.example.org/page?id=1</a>`,
    );
  });

  it("spends web budget on deep verification and then refuses honestly", async () => {
    const html = `<html><head><meta property="og:title" content="P"><meta name="x" content="1"><title>P - S</title></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"><title>Home</title></head><body></body></html>`;

    let sawVerified = false;
    let sawDenied = false;
    for (let i = 0; i < 20; i++) {
      const url = `https://unknown.example.org/p${i}?share=abc`;
      pages.set(url, html);
      pages.set(`https://unknown.example.org/p${i}`, html);
      pages.set("https://unknown.example.org/", distinct);

      const response = await exports.default.fetch(
        api(`/api/sanitize?deep=true&text=${encodeURIComponent(url)}`),
        { headers: { "cf-connecting-ip": "203.0.113.9" } },
      );
      const body = (await response.json()) as {
        links: { method: string }[];
      };
      if (body.links[0]?.method === "verified") sawVerified = true;
      if (body.links[0]?.method === "none") {
        sawDenied = true;
        break;
      }
    }
    expect(sawVerified).toBe(true);
    expect(sawDenied).toBe(true);
  });

  it("rejects a client that hammers the sanitize endpoint", async () => {
    let saw429 = false;
    for (let i = 0; i < 40; i++) {
      const response = await exports.default.fetch(
        api(`/api/sanitize?text=${encodeURIComponent(KNOWN_URL)}`),
        { headers: { "cf-connecting-ip": "192.0.2.55" } },
      );
      if (response.status === 429) {
        saw429 = true;
        expect(await response.json()).toEqual({
          error: "Rate limit exceeded",
        });
        break;
      }
      expect(response.status).toBe(200);
    }
    expect(saw429).toBe(true);
  });
});

describe("shouldEscalateToBrowser", () => {
  it("escalates only when the fetch pass was blind or never probed", () => {
    expect(shouldEscalateToBrowser(null, true, 3)).toBe(true);
    expect(shouldEscalateToBrowser(null, false, 0)).toBe(true);
    expect(shouldEscalateToBrowser(null, false, 5)).toBe(false);
    expect(
      shouldEscalateToBrowser({ sanitized: "x", method: "verified" }, true, 3),
    ).toBe(false);
  });
});

describe("GET /api/probe", () => {
  it("streams each probe and a final verdict", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://site.example/post/1?share=abc", html);
    pages.set("https://site.example/post/1", html);
    pages.set("https://site.example/", distinct);

    const response = await exports.default.fetch(
      api(
        `/api/probe?url=${encodeURIComponent("https://site.example/post/1?share=abc")}`,
      ),
      { headers: { "cf-connecting-ip": "198.51.100.77" } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = (await response.text())
      .split("\n\n")
      .filter((chunk) => chunk.includes("data:"))
      .map((chunk) =>
        JSON.parse(chunk.replace(/^data:\s*/m, "").split("\n")[0]),
      );

    const probes = events.filter((event) => event.type === "probe");
    expect(probes[0]).toMatchObject({ state: "start", kind: "control" });
    const controlDone = probes.find(
      (probe) => probe.state === "done" && probe.kind === "control",
    );
    expect(controlDone?.verdict).toBe("different");
    const starts = probes.filter((probe) => probe.state === "start");
    const dones = probes.filter((probe) => probe.state === "done");
    expect(starts.length).toBe(dones.length);
    expect(starts.length).toBeGreaterThanOrEqual(2);

    const result = events.find((event) => event.type === "result");
    expect(result).toMatchObject({
      sanitized: "https://site.example/post/1",
      method: "verified",
    });
  });

  it("stays quiet about the browser when the fetch pass got usable comparisons", async () => {
    const shell = `<html><head><meta property="og:title" content="Shell"></head><body></body></html>`;
    pages.set("https://spa.example/p?x=1", shell);
    pages.set("https://spa.example/", shell);

    const response = await exports.default.fetch(
      api(`/api/probe?url=${encodeURIComponent("https://spa.example/p?x=1")}`),
      { headers: { "cf-connecting-ip": "198.51.100.78" } },
    );
    const body = await response.text();
    expect(body).not.toContain('"notice"');
    expect(body).toContain('"method":"none"');
  });

  it("rejects requests without a valid url", async () => {
    const response = await exports.default.fetch(
      api("/api/probe?url=not-a-url"),
      { headers: { "cf-connecting-ip": "198.51.100.77" } },
    );
    expect(response.status).toBe(400);
  });
});

describe("bot endpoints", () => {
  const FAILED = "😵 Something went wrong. Your link is unchanged.";
  const NOT_SANITIZED_ONE = "😢 Your link is not sanitized. No rules matched.";
  const NOT_SANITIZED_MANY =
    "😢 Your links are not sanitized. No rules matched. Pick one to deep clean:";
  const NO_RESULT =
    "😶 Couldn't sanitize this link. Comparing pages found nothing safe to remove. Your link is unchanged.";
  const OUT_OF_BUDGET =
    "⏳ Out of deep cleans for now. Try again in a few hours. Your link is unchanged.";

  function callbackPost(
    data: string,
    botText: string,
    entities?: { type: string; offset: number; length: number; url: string }[],
  ) {
    return telegramPost({
      callback_query: {
        id: "cb1",
        from: { id: 8 },
        chat_instance: "ci",
        data,
        message: {
          message_id: 101,
          date: 0,
          chat: { id: 7, type: "supergroup" },
          text: botText,
          entities,
        },
      },
    });
  }

  it("offers sending unchanged when no rule matches an inline query", async () => {
    const query = "https://unknown.example.org/p?share=abc";
    const response = await telegramPost({
      inline_query: { id: "q9", from: { id: 5 }, query },
    });
    expect(await response.json()).toEqual({ ok: true });
    const [answer] = botApi("answerInlineQuery");
    expect(answer.payload.inline_query_id).toBe("q9");
    expect(answer.payload.cache_time).toBe(0);
    expect(answer.payload.results).toHaveLength(1);
    expect(answer.payload.results[0]).toMatchObject({
      title: "Nothing to chop",
      input_message_content: { message_text: query },
    });
  });

  it("runs live-page verification when the inline query asks with !deep", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/q?share=abc", html);
    pages.set("https://unknown.example.org/q", html);
    pages.set("https://unknown.example.org/", distinct);

    await telegramPost({
      inline_query: {
        id: "q10",
        from: { id: 5 },
        query: "!deep https://unknown.example.org/q?share=abc",
      },
    });
    const [answer] = botApi("answerInlineQuery");
    expect(answer.payload.results[0].input_message_content.message_text).toBe(
      "https://unknown.example.org/q",
    );
  });

  it("sanitizes every link in an inline query", async () => {
    await telegramPost({
      inline_query: {
        id: "q1",
        from: { id: 5 },
        query: `${KNOWN_URL} and https://www.youtube.com/watch?v=abc12345xyz&si=x`,
      },
    });
    const [answer] = botApi("answerInlineQuery");
    expect(answer.payload.cache_time).toBe(300);
    expect(answer.payload.results[0].input_message_content.message_text).toBe(
      `${KNOWN_CLEAN} and https://www.youtube.com/watch?v=abc12345xyz`,
    );
  });

  it("previews the whole outgoing message in the inline description", async () => {
    await telegramPost({
      inline_query: {
        id: "q12",
        from: { id: 5 },
        query: `【示例视频【A.DEV】-某站】 ${KNOWN_URL}`,
      },
    });
    const [answer] = botApi("answerInlineQuery");
    const expected = `【示例视频【A.DEV】-某站】 ${KNOWN_CLEAN}`;
    expect(answer.payload.results[0].description).toBe(expected);
    expect(answer.payload.results[0].input_message_content.message_text).toBe(
      expected,
    );
  });

  it("cleans the replied-to message on /sanitize", async () => {
    const response = await telegramPost({
      message: {
        chat: { id: -100123 },
        message_id: 50,
        from: { id: 8 },
        text: "/sanitize@tail_wtf_bot",
        reply_to_message: {
          message_id: 42,
          text: `see ${KNOWN_URL}`,
        },
      },
    });
    expect(await response.json()).toEqual({ ok: true });
    expect(botApiCalls).toHaveLength(1);
    const [send] = botApi("sendMessage");
    expect(send.payload).toEqual({
      chat_id: -100123,
      text: `see <a href="${KNOWN_CLEAN}">${KNOWN_CLEAN}</a>`,
      parse_mode: "HTML",
      reply_parameters: { message_id: 50 },
    });
  });

  it("cleans links following /sanitize without echoing the command", async () => {
    await telegramPost({
      message: {
        chat: { id: -100123 },
        message_id: 60,
        from: { id: 8 },
        text: `/sanitize@tail_wtf_bot ${KNOWN_URL}`,
      },
    });
    const [send] = botApi("sendMessage");
    expect(send.payload).toEqual({
      chat_id: -100123,
      text: `<a href="${KNOWN_CLEAN}">${KNOWN_CLEAN}</a>`,
      parse_mode: "HTML",
      reply_parameters: { message_id: 60 },
    });
  });

  it("acknowledges a bare /sanitize with nothing to clean", async () => {
    const response = await telegramPost({
      message: {
        chat: { id: -100123 },
        message_id: 51,
        from: { id: 8 },
        text: "/sanitize",
      },
    });
    expect(await response.json()).toEqual({ ok: true });
    expect(botApiCalls).toHaveLength(0);
  });

  it("rejects Telegram webhooks without the shared secret", async () => {
    const response = await telegramPost(
      { message: { chat: { id: 7 }, message_id: 1, text: KNOWN_URL } },
      "wrong-secret",
    );
    expect(response.status).toBe(403);
    expect(botApiCalls).toHaveLength(0);
  });

  it("ignores Telegram messages without a /sanitize command", async () => {
    const response = await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 42,
        text: `see ${KNOWN_URL}`,
      },
    });
    expect(await response.json()).toEqual({ ok: true });
    expect(botApiCalls).toHaveLength(0);
  });

  it("ignores Telegram replies without a /sanitize command", async () => {
    const response = await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 43,
        text: `see ${KNOWN_URL}`,
        reply_to_message: { message_id: 42, text: `see ${KNOWN_URL}` },
      },
    });
    expect(await response.json()).toEqual({ ok: true });
    expect(botApiCalls).toHaveLength(0);
  });

  it("offers a deep clean when no rule matches the only link", async () => {
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 9,
        from: { id: 8 },
        text: "/sanitize https://unknown.example.org/p?share=abc",
      },
    });
    const [send] = botApi("sendMessage");
    expect(send.payload.text).toBe(
      `😢 <a href="https://unknown.example.org/p?share=abc">Your link</a> is not sanitized. No rules matched.`,
    );
    expect(send.payload.parse_mode).toBe("HTML");
    expect(send.payload.link_preview_options).toEqual({ is_disabled: true });
    expect(send.payload.reply_parameters).toEqual({ message_id: 9 });
    expect(send.payload.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "🔍 Deep clean", callback_data: "v:0:8" }],
      ],
    });
  });

  it("cleans matched links and offers verification for the rest", async () => {
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 9,
        from: { id: 8 },
        text: `/sanitize ${KNOWN_URL} plus https://unknown.example.org/p?share=abc`,
      },
    });
    const [send] = botApi("sendMessage");
    expect(send.payload.text).toBe(
      `<a href="${KNOWN_CLEAN}">${KNOWN_CLEAN}</a> plus <a href="https://unknown.example.org/p?share=abc">https://unknown.example.org/p?share=abc</a>`,
    );
    expect(send.payload.parse_mode).toBe("HTML");
    expect(send.payload.link_preview_options).toBeUndefined();
    expect(send.payload.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: "🔍 Deep clean unknown.example.org",
            callback_data: "v:1:8",
          },
        ],
      ],
    });
  });

  it("lets the user choose among several unmatched links", async () => {
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 9,
        from: { id: 8 },
        text: "/sanitize https://unknown.example.org/p?share=abc and https://other.example.net/x?ref=1",
      },
    });
    const [send] = botApi("sendMessage");
    expect(send.payload.text).toBe(
      [
        NOT_SANITIZED_MANY,
        `1. <a href="https://unknown.example.org/p?share=abc">unknown.example.org</a>`,
        `2. <a href="https://other.example.net/x?ref=1">other.example.net</a>`,
      ].join("\n"),
    );
    expect(send.payload.parse_mode).toBe("HTML");
    expect(send.payload.link_preview_options).toEqual({ is_disabled: true });
    expect(send.payload.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "🔍 Deep clean link 1", callback_data: "v:0:8" }],
        [{ text: "🔍 Deep clean link 2", callback_data: "v:1:8" }],
      ],
    });
  });

  it("shows a placeholder while expanding short links", async () => {
    pages.set("HEAD https://bit.ly/px", KNOWN_URL);
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 11,
        from: { id: 8 },
        text: "/sanitize https://bit.ly/px",
      },
    });
    expect(botApiCalls.map((call) => call.method)).toEqual([
      "sendMessage",
      "editMessageText",
    ]);
    expect(botApi("sendMessage")[0].payload).toMatchObject({
      chat_id: 7,
      text: "⏳ Chopping…",
      reply_parameters: { message_id: 11 },
    });
    expect(botApi("editMessageText")[0].payload).toMatchObject({
      chat_id: 7,
      message_id: 100,
      text: `<a href="${KNOWN_CLEAN}">${KNOWN_CLEAN}</a>`,
      parse_mode: "HTML",
    });
  });

  it("verifies the chosen link against its live page", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/cb?share=abc", html);
    pages.set("https://unknown.example.org/cb", html);
    pages.set("https://unknown.example.org/", distinct);

    await callbackPost("v:0:8", NOT_SANITIZED_ONE, [
      {
        type: "text_link",
        offset: NOT_SANITIZED_ONE.indexOf("Your link"),
        length: "Your link".length,
        url: "https://unknown.example.org/cb?share=abc",
      },
    ]);

    const [ack] = botApi("answerCallbackQuery");
    expect(ack.payload.callback_query_id).toBe("cb1");
    const edits = botApi("editMessageText");
    expect(edits[0].payload).toMatchObject({
      chat_id: 7,
      message_id: 101,
      text: "🔍 Deep cleaning…",
    });
    expect(edits[1].payload).toMatchObject({
      chat_id: 7,
      message_id: 101,
      text: "https://unknown.example.org/cb",
    });
    const rows = edits[1].payload.reply_markup.inline_keyboard;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0].text).toBe("📝 Submit rule on GitHub");
    expect(rows[0][0].url).toContain("github.com/Tail-WTF/Rules/issues/new");
    expect(rows[0][0].url).toContain("rule-request");
  });

  it("admits when verification finds nothing to remove", async () => {
    await callbackPost("v:0:8", NOT_SANITIZED_ONE, [
      {
        type: "text_link",
        offset: NOT_SANITIZED_ONE.indexOf("Your link"),
        length: "Your link".length,
        url: "https://unknown.example.org/nr",
      },
    ]);

    const edits = botApi("editMessageText");
    expect(edits.at(-1)?.payload.text).toBe(NO_RESULT);
    expect(edits.at(-1)?.payload.reply_markup).toBeUndefined();
  });

  it("refuses verification once the actor budget is spent", async () => {
    for (let i = 0; i < 15; i++) {
      pages.set(
        `HEAD https://bit.ly/bd${i}`,
        "https://unknown.example.org/page?id=1",
      );
      await telegramPost({
        message: {
          chat: { id: 7 },
          message_id: i + 1,
          from: { id: 777 },
          text: `/sanitize https://bit.ly/bd${i}`,
        },
      });
    }
    botApiCalls.length = 0;

    await telegramPost({
      callback_query: {
        id: "cb2",
        from: { id: 777 },
        chat_instance: "ci",
        data: "v:0:777",
        message: {
          message_id: 101,
          date: 0,
          chat: { id: 7, type: "supergroup" },
          text: NOT_SANITIZED_ONE,
          entities: [
            {
              type: "text_link",
              offset: NOT_SANITIZED_ONE.indexOf("Your link"),
              length: "Your link".length,
              url: "https://unknown.example.org/bd?share=abc",
            },
          ],
        },
      },
    });

    const edits = botApi("editMessageText");
    expect(edits.at(-1)?.payload.text).toBe(OUT_OF_BUDGET);
    expect(edits.at(-1)?.payload.reply_markup).toBeUndefined();
  });

  it("gives up gracefully when the original message is gone", async () => {
    await telegramPost({
      callback_query: {
        id: "cb1",
        from: { id: 8 },
        chat_instance: "ci",
        data: "v:0:8",
        message: {
          message_id: 101,
          date: 0,
          chat: { id: 7, type: "supergroup" },
        },
      },
    });

    const [answer] = botApi("answerCallbackQuery");
    expect(answer.payload.text).toBe("The original message is gone.");
    expect(botApi("editMessageText")).toHaveLength(0);
  });

  it("offers a deep clean for an expanded link no rule matched", async () => {
    pages.set(
      "HEAD https://bit.ly/ex",
      "https://unknown.example.org/page?id=1",
    );
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 14,
        from: { id: 8 },
        text: "/sanitize https://bit.ly/ex",
      },
    });
    const [edit] = botApi("editMessageText");
    expect(edit.payload.text).toBe(
      `<a href="https://unknown.example.org/page?id=1">https://unknown.example.org/page?id=1</a>`,
    );
    expect(edit.payload.parse_mode).toBe("HTML");
    expect(edit.payload.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: "🔍 Deep clean unknown.example.org",
            callback_data: "v:0:8",
          },
        ],
      ],
    });
  });

  it("offers a deep clean on a replied-to message", async () => {
    await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 12,
        from: { id: 8 },
        text: "/sanitize",
        reply_to_message: {
          message_id: 9,
          text: "see https://unknown.example.org/p?share=abc",
        },
      },
    });
    const [send] = botApi("sendMessage");
    expect(send.payload.text).toBe(
      `😢 <a href="https://unknown.example.org/p?share=abc">Your link</a> is not sanitized. No rules matched.`,
    );
    expect(send.payload.parse_mode).toBe("HTML");
    expect(send.payload.link_preview_options).toEqual({ is_disabled: true });
    expect(send.payload.reply_parameters).toEqual({ message_id: 12 });
    expect(send.payload.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "🔍 Deep clean", callback_data: "v:0:8" }],
      ],
    });
  });

  it("verifies the leftover link in a mixed message", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/p2?share=abc", html);
    pages.set("https://unknown.example.org/p2", html);
    pages.set("https://unknown.example.org/", distinct);

    const botText = `${KNOWN_CLEAN} plus https://unknown.example.org/p2?share=abc`;
    await callbackPost("v:1:8", botText, [
      {
        type: "text_link",
        offset: botText.indexOf(KNOWN_CLEAN),
        length: KNOWN_CLEAN.length,
        url: KNOWN_CLEAN,
      },
      {
        type: "text_link",
        offset: botText.indexOf("https://unknown.example.org/p2?share=abc"),
        length: "https://unknown.example.org/p2?share=abc".length,
        url: "https://unknown.example.org/p2?share=abc",
      },
    ]);

    const edits = botApi("editMessageText");
    expect(edits.at(-1)?.payload.text).toBe(
      `${KNOWN_CLEAN} plus https://unknown.example.org/p2`,
    );
    const rows = edits.at(-1)?.payload.reply_markup.inline_keyboard;
    expect(rows).toEqual([
      [expect.objectContaining({ text: "📝 Submit rule on GitHub" })],
    ]);
    expect(rows[0][0].url).toContain("unknown.example.org");
    expect(rows[0][0].url).not.toContain("amazon");
  });

  it("applies the verdict to the right link after an expanded one", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/k?share=abc", html);
    pages.set("https://unknown.example.org/k", html);
    pages.set("https://unknown.example.org/", distinct);

    const botText =
      "see https://unknown.example.org/page?id=1 and https://unknown.example.org/k?share=abc";
    await callbackPost("v:1:8", botText, [
      {
        type: "text_link",
        offset: botText.indexOf("https://unknown.example.org/page?id=1"),
        length: "https://unknown.example.org/page?id=1".length,
        url: "https://unknown.example.org/page?id=1",
      },
      {
        type: "text_link",
        offset: botText.indexOf("https://unknown.example.org/k?share=abc"),
        length: "https://unknown.example.org/k?share=abc".length,
        url: "https://unknown.example.org/k?share=abc",
      },
    ]);

    const edits = botApi("editMessageText");
    expect(edits.at(-1)?.payload.text).toBe(
      "see https://unknown.example.org/page?id=1 and https://unknown.example.org/k",
    );
  });

  it("verifies one link and retires the other buttons", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/p3?share=abc", html);
    pages.set("https://unknown.example.org/p3", html);
    pages.set("https://unknown.example.org/", distinct);

    const botText = [
      NOT_SANITIZED_MANY,
      "1. unknown.example.org",
      "2. other.example.net",
    ].join("\n");
    await callbackPost("v:0:8", botText, [
      {
        type: "text_link",
        offset: botText.indexOf("unknown.example.org"),
        length: "unknown.example.org".length,
        url: "https://unknown.example.org/p3?share=abc",
      },
      {
        type: "text_link",
        offset: botText.indexOf("other.example.net"),
        length: "other.example.net".length,
        url: "https://other.example.net/x?ref=1",
      },
    ]);

    const edits = botApi("editMessageText");
    expect(edits.at(-1)?.payload.text).toBe(
      "https://unknown.example.org/p3",
    );
    const rows = edits.at(-1)?.payload.reply_markup.inline_keyboard;
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("v:1:8");
  });

  it("reports failure instead of stalling when verification errors", async () => {
    const html = `<html><head><meta property="og:title" content="P"></head><body></body></html>`;
    const distinct = `<html><head><meta property="og:title" content="Home"></head><body></body></html>`;
    pages.set("https://unknown.example.org/se?share=abc", html);
    pages.set("https://unknown.example.org/se", html);
    pages.set("https://unknown.example.org/", distinct);
    failEditAt = 2;

    await callbackPost("v:0:8", NOT_SANITIZED_ONE, [
      {
        type: "text_link",
        offset: NOT_SANITIZED_ONE.indexOf("Your link"),
        length: "Your link".length,
        url: "https://unknown.example.org/se?share=abc",
      },
    ]);

    const edits = botApi("editMessageText");
    expect(edits.map((edit) => edit.payload.text)).toEqual([
      "🔍 Deep cleaning…",
      "https://unknown.example.org/se",
      FAILED,
    ]);
    expect(edits.at(-1)?.payload.reply_markup).toBeUndefined();
  });

  it("dismisses a stale button index", async () => {
    await callbackPost("v:9:8", NOT_SANITIZED_ONE, [
      {
        type: "text_link",
        offset: NOT_SANITIZED_ONE.indexOf("Your link"),
        length: "Your link".length,
        url: "https://unknown.example.org/p?share=abc",
      },
    ]);

    const [answer] = botApi("answerCallbackQuery");
    expect(answer.payload.text).toBe("The original message is gone.");
    expect(botApi("editMessageText")).toHaveLength(0);
  });

  it("dismisses old plain-format messages without link entities", async () => {
    await callbackPost(
      "v:0:8",
      `${NOT_SANITIZED_ONE}\nhttps://unknown.example.org/p?share=abc`,
    );

    const [answer] = botApi("answerCallbackQuery");
    expect(answer.payload.text).toBe("The original message is gone.");
    expect(botApi("editMessageText")).toHaveLength(0);
  });

  it("rejects verify taps from anyone but the requester", async () => {
    await callbackPost(
      "v:0:5",
      `${NOT_SANITIZED_ONE}\nhttps://unknown.example.org/p?share=abc`,
    );

    const [answer] = botApi("answerCallbackQuery");
    expect(answer.payload.text).toBe(
      "Only the requester can use this button.",
    );
    expect(botApi("editMessageText")).toHaveLength(0);
  });

  it("ignores unknown callback actions", async () => {
    await callbackPost(
      "x:0",
      `${NOT_SANITIZED_ONE}\nhttps://unknown.example.org/p?share=abc`,
    );

    const [answer] = botApi("answerCallbackQuery");
    expect(answer.payload.text).toBe("The original message is gone.");
    expect(botApi("editMessageText")).toHaveLength(0);
  });

  it("refuses updates when the bot token is missing", async () => {
    const { env } = await import("cloudflare:workers");
    const bindings = env as { TELEGRAM_BOT_TOKEN?: string };
    const saved = bindings.TELEGRAM_BOT_TOKEN;
    bindings.TELEGRAM_BOT_TOKEN = "";
    try {
      const response = await telegramPost({
        message: {
          chat: { id: 7 },
          message_id: 15,
          from: { id: 8 },
          text: "/sanitize",
        },
      });
      expect(response.status).toBe(500);
      expect(botApiCalls).toHaveLength(0);
    } finally {
      bindings.TELEGRAM_BOT_TOKEN = saved;
    }
  });

  it("stays quiet when /sanitize finds no links", async () => {
    const response = await telegramPost({
      message: {
        chat: { id: 7 },
        message_id: 13,
        from: { id: 8 },
        text: "/sanitize just some words",
      },
    });
    expect(await response.json()).toEqual({ ok: true });
    expect(botApiCalls).toHaveLength(0);
  });
});

describe("gitHubIssueUrl", () => {
  it("prefills a rule-request issue from the verified link", () => {
    const url = gitHubIssueUrl(
      "https://sub.example.com/item/42?id=9&track=z",
      "https://sub.example.com/item/42?id=9",
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://github.com/Tail-WTF/Rules/issues/new",
    );
    expect(parsed.searchParams.get("title")).toBe(
      "Rule request: sub.example.com",
    );
    expect(parsed.searchParams.get("labels")).toBe("rule-request");
    const body = parsed.searchParams.get("body") ?? "";
    expect(body).toContain("`sub.example.com`");
    expect(body).toContain("- `track`");
    expect(body).toContain('pattern: "/item/42"');
    expect(body).toContain('allowedParams: ["id"]');
  });
});
