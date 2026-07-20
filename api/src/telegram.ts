import { Bot } from "grammy";
import type {
  InlineKeyboardMarkup,
  MessageEntity,
  UserFromGetMe,
} from "grammy/types";
import { find as linkify } from "linkifyjs";
import { actorId } from "./actor";
import { outboundGateFor } from "./outbound-budget";
import { rules } from "./rules";
import { sanitizeText, textNeedsExpansion } from "./sanitizer";
import type { LinkResult, OutboundGate } from "./types";
import { deepClean } from "./deep-clean";

const MAX_LINKS_PER_BOT_MESSAGE = 3;

const CHOPPING = "⏳ Chopping…";
const DEEP_CLEANING = "🔍 Deep cleaning…";
const NOT_SANITIZED_ONE = "😢 Your link is not sanitized. No rules matched.";
const NOT_SANITIZED_MANY =
  "😢 Your links are not sanitized. No rules matched. Pick one to deep clean:";
const NO_RESULT =
  "😶 Couldn't sanitize this link. Comparing pages found nothing safe to remove. Your link is unchanged.";
const OUT_OF_BUDGET =
  "⏳ Out of deep cleans for now. Try again in a few hours. Your link is unchanged.";
const FAILED = "😵 Something went wrong. Your link is unchanged.";
const MESSAGE_GONE = "The original message is gone.";
const NOT_YOURS = "Only the requester can use this button.";

const COMMAND_PREFIX = /^\/sanitize(@\w+)?\s*/;

let botInfo: UserFromGetMe | undefined;

async function gateForUser(env: Env, userId: number): Promise<OutboundGate> {
  return outboundGateFor(env, await actorId(env, "tg", userId));
}

async function sanitizeForBot(
  env: Env,
  text: string,
  gate: OutboundGate,
  deep: boolean,
) {
  const result = await sanitizeText(text, rules, {
    maxLinks: MAX_LINKS_PER_BOT_MESSAGE,
    outboundGate: gate,
    verifier: deep
      ? (url) => deepClean(url, env, gate).then((outcome) => outcome.verdict)
      : undefined,
  });
  const changed = result.links.some((link) => link.method !== "none");
  return { result, changed };
}

function ruleMissed(link: LinkResult): boolean {
  return link.method === "none" || link.method === "expanded";
}

function hostLabel(link: LinkResult, index: number): string {
  try {
    return new URL(link.sanitized).hostname;
  } catch {
    return `link ${index + 1}`;
  }
}

function removedParams(original: string, sanitized: string): string[] {
  try {
    const before = new Set(new URL(original).searchParams.keys());
    const after = new Set(new URL(sanitized).searchParams.keys());
    return [...before].filter((param) => !after.has(param));
  } catch {
    return [];
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function anchor(url: string, label: string): string {
  return `<a href="${escapeHtmlAttr(url)}">${escapeHtml(label)}</a>`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function gitHubIssueUrl(original: string, sanitized: string): string {
  const domain = hostnameOf(original);
  const cleaned = new URL(sanitized);
  const allowedParams = [...new Set(cleaned.searchParams.keys())];
  const removed = removedParams(original, sanitized);
  const body = `## Domain
\`${domain}\`

## Removed Parameters
${removed.length > 0 ? removed.map((p) => `- \`${p}\``).join("\n") : "None"}

## Suggested Rule (verified against the live page)
\`\`\`yaml
${domain}:
  sanitize:
    - pattern: "${cleaned.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"
      allowedParams: [${allowedParams.map((p) => `"${p}"`).join(", ")}]
\`\`\`
`;

  const query = (
    [
      ["title", `Rule request: ${domain}`],
      ["body", body],
      ["labels", "rule-request"],
    ] as [string, string][]
  )
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `https://github.com/Tail-WTF/Rules/issues/new?${query}`;
}

function failureBody(unmatched: { link: LinkResult; index: number }[]): string {
  if (unmatched.length === 1) {
    const { link } = unmatched[0];
    return `😢 ${anchor(link.sanitized, "Your link")} is not sanitized. No rules matched.`;
  }
  return [
    NOT_SANITIZED_MANY,
    ...unmatched.map(
      ({ link, index }, i) => `${i + 1}. ${anchor(link.sanitized, hostLabel(link, index))}`,
    ),
  ].join("\n");
}

function wrapLinks(text: string, links: LinkResult[]): string {
  const matches = linkify(text, "url").slice(
    0,
    Math.min(links.length, MAX_LINKS_PER_BOT_MESSAGE),
  );
  let html = "";
  let cursor = 0;
  matches.forEach((match, i) => {
    html += escapeHtml(text.slice(cursor, match.start));
    html += anchor(links[i].sanitized, text.slice(match.start, match.end));
    cursor = match.end;
  });
  html += escapeHtml(text.slice(cursor));
  return html;
}

function deepCleanKeyboard(
  unmatched: { link: LinkResult; index: number }[],
  requester: number,
  changed: boolean,
): InlineKeyboardMarkup | undefined {
  if (unmatched.length === 0) return undefined;
  const label = ({ link, index }: { link: LinkResult; index: number }, i: number) => {
    if (changed) return `🔍 Deep clean ${hostLabel(link, index)}`;
    return unmatched.length === 1 ? "🔍 Deep clean" : `🔍 Deep clean link ${i + 1}`;
  };
  return {
    inline_keyboard: unmatched.map((entry, i) => [
      {
        text: label(entry, i),
        callback_data: `v:${entry.index}:${requester}`,
      },
    ]),
  };
}

export async function telegramBot(env: Env): Promise<Bot> {
  const bot = new Bot(
    env.TELEGRAM_BOT_TOKEN ?? "",
    botInfo ? { botInfo } : undefined,
  );

  bot.catch((err) => console.error(err));

  bot.on("inline_query", async (ctx) => {
    let query = ctx.inlineQuery.query;
    const deep = /^!deep\s+/i.test(query);
    if (deep) query = query.replace(/^!deep\s+/i, "");

    const gate = await gateForUser(env, ctx.inlineQuery.from.id);
    const sanitized = query
      ? await sanitizeForBot(env, query, gate, deep)
      : null;

    if (!sanitized || sanitized.result.links.length === 0) {
      await ctx.answerInlineQuery([], { cache_time: 0 });
      return;
    }

    if (!sanitized.changed) {
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "1",
            title: "Nothing to chop",
            description:
              "No rules matched. Tap to send unchanged, or prefix !deep to verify against the live page.",
            input_message_content: { message_text: query },
          },
        ],
        { cache_time: 0 },
      );
      return;
    }

    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: "1",
          title: "Sanitized Link",
          description: sanitized.result.text,
          input_message_content: { message_text: sanitized.result.text },
        },
      ],
      { cache_time: 300 },
    );
  });

  bot.on("message:text", async (ctx) => {
    const message = ctx.message;
    const command = message.text.match(COMMAND_PREFIX);
    if (!command) return;

    const text = message.reply_to_message?.text
      ? message.reply_to_message.text
      : message.text.slice(command[0].length);
    if (!text) return;

    const requester = message.from?.id ?? message.chat.id;
    const gate = await gateForUser(env, requester);

    let placeholder: { message_id: number } | undefined;
    if (textNeedsExpansion(text, rules, MAX_LINKS_PER_BOT_MESSAGE)) {
      placeholder = await ctx.reply(CHOPPING, {
        reply_parameters: { message_id: message.message_id },
      });
    }

    try {
      const { result, changed } = await sanitizeForBot(env, text, gate, false);
      if (result.links.length === 0) {
        if (placeholder) {
          await ctx.api.editMessageText(
            message.chat.id,
            placeholder.message_id,
            FAILED,
          );
        }
        return;
      }

      const unmatched = result.links
        .map((link, index) => ({ link, index }))
        .filter(({ link }) => ruleMissed(link));

      const body = changed
        ? wrapLinks(result.text, result.links)
        : failureBody(unmatched);
      const keyboard = deepCleanKeyboard(unmatched, requester, changed);
      const options = changed
        ? { parse_mode: "HTML" as const, reply_markup: keyboard }
        : {
            parse_mode: "HTML" as const,
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
          };

      if (placeholder) {
        await ctx.api.editMessageText(
          message.chat.id,
          placeholder.message_id,
          body,
          options,
        );
      } else {
        await ctx.reply(body, {
          reply_parameters: { message_id: message.message_id },
          ...options,
        });
      }
    } catch (error) {
      if (!placeholder) throw error;
      await ctx.api.editMessageText(
        message.chat.id,
        placeholder.message_id,
        FAILED,
      );
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const match = ctx.callbackQuery.data.match(/^v:(\d+):(-?\d+)$/);
    const msg = ctx.callbackQuery.message;
    const bodyText = msg && "text" in msg ? msg.text : undefined;
    if (!match || !msg || bodyText === undefined) {
      await ctx.answerCallbackQuery({ text: MESSAGE_GONE });
      return;
    }
    if (ctx.callbackQuery.from.id !== Number(match[2])) {
      await ctx.answerCallbackQuery({ text: NOT_YOURS });
      return;
    }

    const entities = "entities" in msg ? msg.entities : undefined;
    const links = (entities ?? []).filter(
      (entity): entity is MessageEntity.TextLinkMessageEntity =>
        entity.type === "text_link",
    );
    const chosen = links[Number(match[1])];
    if (!chosen) {
      await ctx.answerCallbackQuery({ text: MESSAGE_GONE });
      return;
    }

    await ctx.answerCallbackQuery();
    const editText = (text: string, reply_markup?: InlineKeyboardMarkup) =>
      ctx.api.editMessageText(msg.chat.id, msg.message_id, text, {
        reply_markup,
      });
    await editText(DEEP_CLEANING);

    try {
      const url = new URL(chosen.url);
      const gate = await gateForUser(env, ctx.callbackQuery.from.id);

      const { verdict, reason } = await deepClean(url, env, gate);
      if (reason === "budget") {
        await editText(OUT_OF_BUDGET);
        return;
      }
      if (verdict === null) {
        await editText(NO_RESULT);
        return;
      }

      const finalText =
        bodyText.startsWith(NOT_SANITIZED_ONE) ||
        bodyText.startsWith(NOT_SANITIZED_MANY)
          ? verdict.sanitized
          : bodyText.slice(0, chosen.offset) +
            verdict.sanitized +
            bodyText.slice(chosen.offset + chosen.length);

      await editText(finalText, {
        inline_keyboard: [
          [
            {
              text: "📝 Submit rule on GitHub",
              url: gitHubIssueUrl(chosen.url, verdict.sanitized),
            },
          ],
        ],
      });
    } catch {
      await editText(FAILED);
    }
  });

  if (!botInfo) {
    await bot.init();
    botInfo = bot.botInfo;
  }
  return bot;
}
