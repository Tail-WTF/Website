export interface Env {
  RULES_KV: KVNamespace;
  AI: Ai;
  BROWSER: Fetcher;
}

interface BaseRule {
  pattern: string;
}

export interface ExpandRule extends BaseRule {}

export interface SanitizeRule extends BaseRule {
  allowedParams: string[];
  sanitizePath?: boolean;
  ignorableParamValues?: Record<string, string[]>;
}

export interface SiteRule {
  expand?: ExpandRule[];
  sanitize?: SanitizeRule[];
}

export interface RuleSet {
  [domain: string]: SiteRule;
}
