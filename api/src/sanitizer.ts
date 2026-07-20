import { find as linkify } from "linkifyjs";
import { ExpiringMap, hashKey } from "./memo";
import type {
  LinkResult,
  OutboundGate,
  RuleSet,
  SanitizeOptions,
  SanitizeRule,
  Verifier,
} from "./types";

const MAX_REDIRECT_HOPS = 5;
const REQUEST_TIMEOUT_MS = 5_000;

// Inline queries fire on every keystroke, so the same short link arrives many
// times in quick succession. Expansions are memoized in isolate memory only:
// nothing is persisted, keys are digests, and entries lapse after minutes.
const expansionCache = new ExpiringMap<string[]>(10 * 60 * 1000, 500);

export function resetExpansionCache(): void {
  expansionCache.clear();
}

async function expandWithCache(
  url: URL,
  outboundGate?: OutboundGate,
): Promise<URL[] | null> {
  const key = await hashKey(url.toString());
  const cached = expansionCache.get(key);
  if (cached) {
    return cached.map((hop) => new URL(hop));
  }

  if (outboundGate && !(await outboundGate())) return null;

  const chain = await followRedirects(url);
  expansionCache.set(
    key,
    chain.map((hop) => hop.toString()),
  );
  return chain;
}

export function textNeedsExpansion(
  text: string,
  rules: RuleSet,
  maxLinks: number,
): boolean {
  return linkify(text, "url")
    .slice(0, maxLinks)
    .some((link) => {
      try {
        return needsExpansion(rules, new URL(link.href));
      } catch {
        return false;
      }
    });
}

export async function sanitizeText(
  text: string,
  rules: RuleSet,
  options: SanitizeOptions,
): Promise<{ text: string; links: LinkResult[] }> {
  const found = linkify(text, "url").slice(0, options.maxLinks);

  const links: LinkResult[] = [];
  let sanitizedText = text;
  let offset = 0;

  for (const link of found) {
    let result: LinkResult;
    try {
      result = await sanitizeURL(
        link.href,
        rules,
        options.verifier,
        options.outboundGate,
      );
    } catch {
      continue;
    }
    links.push(result);

    if (result.method === "none") continue;

    const start = link.start + offset;
    const end = link.end + offset;
    sanitizedText =
      sanitizedText.substring(0, start) +
      result.sanitized +
      sanitizedText.substring(end);
    offset += result.sanitized.length - (end - start);
  }

  return { text: sanitizedText, links };
}

export async function sanitizeURL(
  originalURL: string,
  rules: RuleSet,
  verifier?: Verifier,
  outboundGate?: OutboundGate,
): Promise<LinkResult> {
  let url = new URL(originalURL);
  let expanded = false;

  if (needsExpansion(rules, url)) {
    const chain = (await expandWithCache(url, outboundGate)) ?? [];
    if (chain.length > 0) {
      const deepestWithRule = [...chain]
        .reverse()
        .find((hop) => findSanitizeRule(rules, hop) !== null);
      url = deepestWithRule ?? chain[chain.length - 1];
      expanded = true;
    }
  }

  const match = findSanitizeRule(rules, url);
  if (match) {
    return {
      original: originalURL,
      sanitized: applyRule(url, match),
      method: "rule",
    };
  }

  if (verifier) {
    const verified = await verifier(url);
    if (verified) return { original: originalURL, ...verified };
  }

  return {
    original: originalURL,
    sanitized: url.toString(),
    method: expanded ? "expanded" : "none",
  };
}

function needsExpansion(rules: RuleSet, url: URL): boolean {
  const expandRules = rules[url.host]?.expand;
  if (!expandRules) return false;
  return expandRules.some((rule) =>
    new RegExp(rule.pattern).test(url.pathname),
  );
}

function findSanitizeRule(
  rules: RuleSet,
  url: URL,
): [SanitizeRule, RegExpExecArray] | null {
  const sanitizeRules = rules[url.host]?.sanitize;
  if (!sanitizeRules) return null;

  for (const rule of sanitizeRules) {
    const matches = new RegExp(rule.pattern).exec(url.pathname);
    if (matches) return [rule, matches];
  }
  return null;
}

function applyRule(url: URL, [rule, matches]: [SanitizeRule, RegExpExecArray]): string {
  const sanitized = new URL(url.toString());

  if (rule.sanitizePath) {
    sanitized.pathname = matches[0];
  }

  const params = new URLSearchParams();
  for (const param of rule.allowedParams) {
    const ignorableValues = rule.ignorableParamValues?.[param];
    for (const value of url.searchParams.getAll(param)) {
      if (ignorableValues?.includes(value)) continue;
      params.append(param, value);
    }
  }
  sanitized.search = params.toString();

  return sanitized.toString();
}

async function followRedirects(start: URL): Promise<URL[]> {
  const chain: URL[] = [];
  let current = start.toString();

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const location = await nextRedirectLocation(current);
    if (!location) break;

    const next = new URL(location, current);
    chain.push(next);
    current = next.toString();
  }

  return chain;
}

async function nextRedirectLocation(url: string): Promise<string | null> {
  const head = await tryRequest(url, "HEAD");
  if (head) {
    if (head.location) return head.location;
    if (head.ok) return null;
  }

  const get = await tryRequest(url, "GET");
  return get?.location ?? null;
}

async function tryRequest(
  url: string,
  method: "HEAD" | "GET",
): Promise<{ ok: boolean; location: string | null } | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  await response.body?.cancel();

  if (response.status >= 300 && response.status < 400) {
    return { ok: false, location: response.headers.get("location") };
  }
  return { ok: response.ok, location: null };
}
