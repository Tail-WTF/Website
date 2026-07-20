import { browserMetadataSource } from "./browser";
import {
  cachedVerdict,
  rememberVerdict,
  verifyByMetadata,
  type ProbeReporter,
  type Verdict,
  type VerifyProbe,
} from "./metadata";
import type { OutboundGate } from "./types";

const BROWSER_MAX_PROBES = 5;
const BROWSER_SESSION_TIMEOUT_MS = 35_000;

export type ProbeVia = "fetch" | "browser";

export interface DeepCleanEvents {
  onProbe?: (via: ProbeVia, probe: VerifyProbe) => void | Promise<void>;
  onBrowserRetry?: () => void | Promise<void>;
}

/**
 * A browser retry only helps when the fetch pass never got a usable
 * comparison: the site's pages were indistinguishable (client-rendered
 * shell) or the original page could not be read at all. A search that ran
 * and found every param required would fail identically in a browser.
 */
export function shouldEscalateToBrowser(
  verdict: unknown,
  blindControl: boolean,
  probesStarted: number,
): boolean {
  return verdict === null && (blindControl || probesStarted === 0);
}

export async function deepClean(
  url: URL,
  env: Env,
  gate: OutboundGate,
  events: DeepCleanEvents = {},
): Promise<{ verdict: Verdict; reason?: "budget" }> {
  const cached = await cachedVerdict(url);
  if (cached !== undefined) return { verdict: cached };

  if (!(await gate())) return { verdict: null, reason: "budget" };

  let blindControl = false;
  let probesStarted = 0;

  const reporterVia = (via: ProbeVia): ProbeReporter => async (probe) => {
    if (probe.state === "start") probesStarted++;
    if (
      probe.state === "done" &&
      probe.kind === "control" &&
      probe.verdict === "same"
    ) {
      blindControl = true;
    }
    await events.onProbe?.(via, probe);
  };

  let verdict = await verifyByMetadata(url, reporterVia("fetch"));

  if (
    env.BROWSER_VERIFY === "on" &&
    shouldEscalateToBrowser(verdict, blindControl, probesStarted) &&
    (await gate())
  ) {
    await events.onBrowserRetry?.();
    verdict = await verifyByMetadata(url, reporterVia("browser"), {
      source: browserMetadataSource(env.BROWSER as unknown as Fetcher),
      maxProbes: BROWSER_MAX_PROBES,
      sessionTimeoutMs: BROWSER_SESSION_TIMEOUT_MS,
    });
  }

  await rememberVerdict(url, verdict);
  return { verdict };
}
