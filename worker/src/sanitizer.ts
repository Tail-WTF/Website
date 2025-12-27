import { find as linkify } from "linkifyjs";
import type { RuleSet, SanitizeRule } from "./types";

export async function sanitizeLinkInText(
  text: string,
  rules: RuleSet,
  maxLinks: number = 1,
): Promise<{ text: string; links: string[] }> {
  const links = linkify(text, "url");
  if (links.length === 0) return { text, links: [] };

  const sanitizedLinks: string[] = [];
  let sanitizedText = text;
  let offset = 0;

  const linksToProcess = links.slice(0, maxLinks);
  for (const link of linksToProcess) {
    try {
      const sanitized = await sanitizeURL(link.href, rules);
      sanitizedLinks.push(sanitized);

      const start = link.start + offset;
      const end = link.end + offset;
      sanitizedText =
        sanitizedText.substring(0, start) +
        sanitized +
        sanitizedText.substring(end);

      offset += sanitized.length - (end - start);
    } catch {
      // Skip URLs that can't be sanitized
    }
  }

  return { text: sanitizedText, links: sanitizedLinks };
}

export async function sanitizeURL(
  originalURL: string,
  allRules: RuleSet,
): Promise<string> {
  let url = new URL(originalURL);

  try {
    getRuleForURL(allRules, url, "expand");
    const expandedURLs = await expandShortURL(url);

    for (let i = expandedURLs.length - 1; i >= 0; i--) {
      try {
        getRuleForURL(allRules, expandedURLs[i], "sanitize");
        url = expandedURLs[i];
        break;
      } catch {
        continue;
      }
    }
  } catch {
    // No expand rule or expansion failed
  }

  const [rule, matches] = getRuleForURL(allRules, url, "sanitize");
  if (rule.sanitizePath) {
    url.pathname = matches[0];
  }

  const sanitizedParams = new URLSearchParams();
  for (const param of rule.allowedParams) {
    const ignorableValues = rule.ignorableParamValues?.[param];
    for (const value of url.searchParams.getAll(param)) {
      if (ignorableValues && ignorableValues.includes(value)) continue;
      sanitizedParams.append(param, value);
    }
  }
  url.search = sanitizedParams.toString();

  return url.toString();
}

function getRuleForURL(
  allRules: RuleSet,
  url: URL,
  type: "expand" | "sanitize",
): [SanitizeRule, RegExpExecArray] {
  if (!(url.host in allRules)) {
    throw new Error(`No rules found for domain ${url.host}`);
  }

  const rules = allRules[url.host];
  const typeRules = rules[type];

  if (!typeRules) {
    throw new Error(`No rules found for type ${type}`);
  }

  for (const rule of typeRules) {
    const matches = new RegExp(rule.pattern).exec(url.pathname);
    if (matches) return [rule as SanitizeRule, matches];
  }

  throw new Error(`No rules found for path ${url.pathname}`);
}

async function expandShortURL(shortURL: URL): Promise<URL[]> {
  const urls: URL[] = [];
  let currentUrl = shortURL.toString();

  for (let i = 0; i < 5; i++) {
    const response = await fetch(currentUrl, {
      method: "HEAD",
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const nextUrl = new URL(location, currentUrl);
        urls.push(nextUrl);
        currentUrl = nextUrl.toString();
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return urls;
}
