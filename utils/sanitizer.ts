import fs from "fs";
import path from "path";
import YAML from "js-yaml";
import normalizeUrl from "normalize-url";

const RULE_FILE = path.join(process.cwd(), "data", "sanitization_rules.yaml");

/**
 * Type definition for sanitization rules.
 */
interface BaseRule {
  pattern: string;
}

interface ExpandRule extends BaseRule {}

interface SanitizeRule extends BaseRule {
  allowedParams: string[];
  sanitizePath?: boolean;
  ignorableParamValues?: { [key: string]: string[] };
}

interface SiteRule {
  expand?: ExpandRule[];
  sanitize?: SanitizeRule[];
}

interface RuleSet {
  [key: string]: SiteRule;
}

export async function sanitizeURL(originalURL: string) {
  const allRules = loadSanitizationRules();
  let url: URL = new URL(
    normalizeUrl(originalURL, {
      stripWWW: false,
      stripTextFragment: false,
      sortQueryParameters: false,
      stripAuthentication: false,
      removeQueryParameters: false,
    })
  );

  try {
    getRuleForURL(allRules, url, "expand");
    url = await expandShortURL(url);
  } catch {}

  let rule: SanitizeRule, matches;
  try {
    [rule, matches] = getRuleForURL(allRules, url, "sanitize");
  } catch (e) {
    return originalURL;
  }

  // Sanitize path
  if (rule?.sanitizePath) {
    url.pathname = matches[0];
  }

  // Sanitize params
  const sanitizedParams = new URLSearchParams();
  for (const param of rule.allowedParams) {
    const ignorableValues = rule?.ignorableParamValues?.[param];
    for (const value of url.searchParams.getAll(param)) {
      if (ignorableValues && ignorableValues.includes(value)) continue;
      sanitizedParams.append(param, value);
    }
  }
  url.search = sanitizedParams.toString();

  return url.toString();
}

function loadSanitizationRules(): RuleSet {
  const rules = YAML.load(fs.readFileSync(RULE_FILE).toString()) as RuleSet;
  return rules;
}

function getRuleForURL(ALL_RULES: any, url: URL, type: string) {
  if (!ALL_RULES.hasOwnProperty(url.host)) {
    throw new Error(`No rules found for domain ${url.host}`);
  }

  const rules = ALL_RULES[url.host];
  for (const rule of rules[type]) {
    // Check if rule pattern matches the URL.pathname, extract the matched parts
    const matches = new RegExp(rule.pattern).exec(url.pathname);
    if (matches) return [rule, matches];
  }

  throw new Error(`No rules found for path ${url.pathname}`);
}

async function expandShortURL(shortURL: URL): Promise<URL> {
  const response = await fetch(shortURL, {
    method: "HEAD",
    redirect: "follow",
  });
  return new URL(response.url);
}
