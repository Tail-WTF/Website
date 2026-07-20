export type SanitizeMethod =
  | "rule"
  | "expanded"
  | "canonical"
  | "verified"
  | "none";

export interface LinkResult {
  original: string;
  sanitized: string;
  method: SanitizeMethod;
}

export type Verifier = (
  url: URL,
) => Promise<{ sanitized: string; method: SanitizeMethod } | null>;

/** Grants or denies one outbound operation (expansion or verification). */
export type OutboundGate = () => Promise<boolean>;

export interface SanitizeOptions {
  maxLinks: number;
  verifier?: Verifier;
  outboundGate?: OutboundGate;
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
