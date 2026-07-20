import { ExpiringMap, hashKey } from "./memo";
import type { SanitizeMethod } from "./types";

export interface PageMetadata {
  title: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  canonical: string | null;
  status: number;
}

const FETCH_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; Tail.WTF/1.0; +https://tail.wtf)",
  accept: "text/html,application/xhtml+xml",
};

// Verification is bounded: beyond this many page fetches we give up rather
// than keep hammering the target site.
const MAX_PROBE_FETCHES = 12;
const REQUEST_TIMEOUT_MS = 5_000;
const SESSION_TIMEOUT_MS = 45_000;

export async function fetchPageMetadata(
  url: string,
): Promise<PageMetadata | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  let title = "";
  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let canonical: string | null = null;

  const rewriter = new HTMLRewriter()
    .on("head > title", {
      text(chunk) {
        title += chunk.text;
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        ogTitle ??= el.getAttribute("content");
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        ogDescription ??= el.getAttribute("content");
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        canonical ??= el.getAttribute("href");
      },
    });

  await rewriter.transform(response).arrayBuffer();

  return {
    title: title.trim() || null,
    ogTitle: ogTitle ? (ogTitle as string).trim() || null : null,
    ogDescription: ogDescription
      ? (ogDescription as string).trim() || null
      : null,
    canonical: canonical ? (canonical as string).trim() || null : null,
    status: response.status,
  };
}

/**
 * The page's stable self-description. All fields must match for two URLs to
 * count as showing the same content; a single field is too easy to leave
 * unchanged while the content differs.
 */
interface Fingerprint {
  title: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
}

function fingerprintOf(meta: PageMetadata | null): Fingerprint | null {
  if (!meta || meta.status !== 200) return null;
  if (!meta.title && !meta.ogTitle && !meta.ogDescription) return null;
  return {
    title: meta.title,
    ogTitle: meta.ogTitle,
    ogDescription: meta.ogDescription,
  };
}

function sameFingerprint(a: Fingerprint, b: Fingerprint | null): boolean {
  return (
    b !== null &&
    a.title === b.title &&
    a.ogTitle === b.ogTitle &&
    a.ogDescription === b.ogDescription
  );
}

class ProbeBudgetExceeded extends Error {}

export type Verdict = { sanitized: string; method: SanitizeMethod } | null;

interface ProbeAttempt {
  kind: "control" | "canonical" | "strip" | "subset" | "confirm";
  candidate: string;
  kept: string[];
}

export type VerifyProbe =
  | ({ state: "start" } & ProbeAttempt)
  | ({ state: "done"; verdict: "same" | "different" } & ProbeAttempt);

export type ProbeReporter = (probe: VerifyProbe) => void | Promise<void>;

export type MetadataSource = (url: string) => Promise<PageMetadata | null>;

export interface VerifyOptions {
  source?: MetadataSource;
  maxProbes?: number;
  sessionTimeoutMs?: number;
}

const verifyCache = new ExpiringMap<Verdict>(10 * 60 * 1000, 200);
// A path that failed once will fail for other param combos too; remembering
// the failure per path avoids re-probing the same page over and over.
const failedPathCache = new ExpiringMap<true>(30 * 60 * 1000, 500);

export function resetVerifyCache(): void {
  verifyCache.clear();
  failedPathCache.clear();
}

function pathKey(url: URL): Promise<string> {
  return hashKey(url.origin + url.pathname);
}

export async function cachedVerdict(url: URL): Promise<Verdict | undefined> {
  const exact = verifyCache.get(await hashKey(url.toString()));
  if (exact !== undefined) return exact;
  if (failedPathCache.get(await pathKey(url))) return null;
  return undefined;
}

export async function rememberVerdict(url: URL, verdict: Verdict): Promise<void> {
  if (verdict === null) {
    failedPathCache.set(await pathKey(url), true);
  } else {
    verifyCache.set(await hashKey(url.toString()), verdict);
  }
}

export async function verifyByMetadata(
  url: URL,
  onProbe?: ProbeReporter,
  options: VerifyOptions = {},
): Promise<{ sanitized: string; method: SanitizeMethod } | null> {
  const source = options.source ?? fetchPageMetadata;
  const maxProbes = options.maxProbes ?? MAX_PROBE_FETCHES;
  const sessionTimeoutMs = options.sessionTimeoutMs ?? SESSION_TIMEOUT_MS;

  const paramNames = [...new Set(url.searchParams.keys())];
  if (paramNames.length === 0) return null;

  const originalMeta = await source(url.toString());
  const original = fingerprintOf(originalMeta);
  if (original === null || originalMeta === null) return null;

  let probesUsed = 0;
  const sessionStart = Date.now();
  const probeCache = new Map<string, boolean>();

  const matchesOriginal = async (
    candidate: URL,
    kind: VerifyProbe["kind"] = "subset",
    kept: string[] = [],
  ): Promise<boolean> => {
    const key = candidate.toString();
    let result = probeCache.get(key);
    if (result === undefined) {
      if (
        probesUsed >= maxProbes ||
        Date.now() - sessionStart >= sessionTimeoutMs
      ) {
        throw new ProbeBudgetExceeded();
      }
      probesUsed++;
      await onProbe?.({ state: "start", kind, candidate: key, kept });
      result = sameFingerprint(original, fingerprintOf(await source(key)));
      probeCache.set(key, result);
      await onProbe?.({
        state: "done",
        kind,
        candidate: key,
        kept,
        verdict: result ? "same" : "different",
      });
    }
    return result;
  };

  const withParams = (names: string[]): URL => {
    const candidate = new URL(url.origin + url.pathname);
    for (const name of paramNames) {
      if (!names.includes(name)) continue;
      for (const value of url.searchParams.getAll(name)) {
        candidate.searchParams.append(name, value);
      }
    }
    return candidate;
  };

  // Minimal required param set via binary search (delta debugging): keep
  // halving the candidate set, testing pages with only the kept params.
  async function minimalRequired(
    candidates: string[],
    kept: string[],
  ): Promise<string[]> {
    if (await matchesOriginal(withParams(kept), "subset", kept)) return [];
    if (candidates.length === 1) return candidates;

    const mid = Math.ceil(candidates.length / 2);
    const left = candidates.slice(0, mid);
    const right = candidates.slice(mid);

    const keptLeft = [...kept, ...left];
    if (await matchesOriginal(withParams(keptLeft), "subset", keptLeft)) {
      return minimalRequired(left, kept);
    }
    const keptRight = [...kept, ...right];
    if (await matchesOriginal(withParams(keptRight), "subset", keptRight)) {
      return minimalRequired(right, kept);
    }

    // Required params exist in both halves.
    const fromLeft = await minimalRequired(left, [...kept, ...right]);
    const fromRight = await minimalRequired(right, [...kept, ...fromLeft]);
    return [...fromLeft, ...fromRight];
  }

  try {
    // Calibrate the oracle: a page that must show different content has to
    // produce a different fingerprint. If it does not (client-rendered shell,
    // site-wide generic metadata), this comparison proves nothing and no
    // removal can be verified.
    if (await matchesOriginal(controlURL(url), "control")) return null;

    const canonical = canonicalCandidate(url, originalMeta.canonical);
    if (canonical && (await matchesOriginal(canonical, "canonical"))) {
      return { sanitized: canonical.toString(), method: "canonical" };
    }

    const stripped = withParams([]);
    if (await matchesOriginal(stripped, "strip")) {
      return { sanitized: stripped.toString(), method: "verified" };
    }

    const required = await minimalRequired(paramNames, []);
    if (required.length === paramNames.length) return null;

    const sanitized = withParams(required);
    if (!(await matchesOriginal(sanitized, "confirm", required))) return null;
    return { sanitized: sanitized.toString(), method: "verified" };
  } catch (error) {
    if (error instanceof ProbeBudgetExceeded) return null;
    throw error;
  }
}

function controlURL(url: URL): URL {
  if (url.pathname !== "/") return new URL(url.origin + "/");
  return new URL(url.origin + "/__tail-wtf-difference-probe__");
}

function canonicalCandidate(url: URL, canonical: string | null): URL | null {
  if (!canonical) return null;

  let candidate: URL;
  try {
    candidate = new URL(canonical, url);
  } catch {
    return null;
  }

  if (candidate.hostname !== url.hostname) return null;
  if (candidate.toString() === url.toString()) return null;
  return candidate;
}
