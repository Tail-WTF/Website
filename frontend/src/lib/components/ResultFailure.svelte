<script lang="ts">
  import { onDestroy } from "svelte";
  import Layout from "./Layout.svelte";
  import H1 from "./H1.svelte";
  import ResultLink from "./ResultLink.svelte";

  import { apiFor } from "$lib/config";

  interface Props {
    unsanitized: string[];
    onReset?: () => void;
  }

  interface Probe {
    kind: "control" | "canonical" | "strip" | "subset" | "confirm";
    candidate: string;
    kept: string[];
    verdict?: "same" | "different";
  }

  type Phase =
    | { name: "choose" }
    | { name: "idle"; link: string }
    | { name: "streaming"; link: string }
    | { name: "promoted"; link: string; sanitized: string; method: string }
    | { name: "noresult"; link: string; reason?: string };

  let { unsanitized, onReset }: Props = $props();
  let phase = $state<Phase | null>(null);
  const view = $derived<Phase>(
    phase ??
      (unsanitized.length === 1
        ? { name: "idle", link: unsanitized[0] }
        : { name: "choose" }),
  );
  type StreamEvent =
    | ({ type: "probe"; state: "start" | "done" } & Probe)
    | { type: "notice"; notice: string }
    | { type: "result"; method?: string; sanitized?: string; reason?: string };

  type TranscriptItem = Probe | { notice: string };

  let transcript = $state<TranscriptItem[]>([]);
  let source: EventSource | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  let eventQueue: StreamEvent[] = [];
  let streamFailed = false;

  const STREAM_TIMEOUT_MS = 90_000;
  // Probes against nearby sites resolve in milliseconds; a minimum display
  // cadence keeps the transcript readable without reordering anything.
  const RENDER_INTERVAL_MS = 180;

  function stopStream() {
    source?.close();
    source = null;
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    if (drainTimer !== null) clearTimeout(drainTimer);
    drainTimer = null;
    eventQueue = [];
  }

  onDestroy(stopStream);

  function applyEvent(data: StreamEvent, link: string) {
    if (data.type === "probe" && data.state === "start") {
      transcript = [...transcript, { ...data, verdict: undefined }];
    } else if (data.type === "probe" && data.state === "done") {
      transcript = transcript.map((item) =>
        !("notice" in item) &&
        item.candidate === data.candidate &&
        item.verdict === undefined
          ? { ...item, verdict: data.verdict }
          : item,
      );
    } else if (data.type === "notice") {
      transcript = [...transcript, { notice: data.notice }];
    } else if (data.type === "result") {
      stopStream();
      if (data.sanitized && data.method && data.method !== "none") {
        phase = {
          name: "promoted",
          link,
          sanitized: data.sanitized,
          method: data.method,
        };
      } else {
        phase = { name: "noresult", link, reason: data.reason };
      }
    }
  }

  function drain(link: string) {
    if (drainTimer !== null) return;
    const tick = () => {
      drainTimer = null;
      const next = eventQueue.shift();
      if (next === undefined) {
        if (streamFailed && view.name === "streaming") {
          stopStream();
          phase = { name: "noresult", link };
        }
        return;
      }
      applyEvent(next, link);
      if (view.name !== "streaming") return;
      drainTimer = setTimeout(tick, RENDER_INTERVAL_MS);
    };
    tick();
  }

  function startVerification(link: string) {
    transcript = [];
    streamFailed = false;
    phase = { name: "streaming", link };
    source = new EventSource(
      `${apiFor("/probe")}?url=${encodeURIComponent(link)}`,
    );
    watchdog = setTimeout(() => {
      stopStream();
      phase = { name: "noresult", link };
    }, STREAM_TIMEOUT_MS);
    source.onmessage = (event) => {
      eventQueue.push(JSON.parse(event.data) as StreamEvent);
      drain(link);
    };
    source.onerror = () => {
      source?.close();
      streamFailed = true;
      drain(link);
    };
  }

  function probeVerdict(probe: Probe): { text: string; good: boolean } {
    if (probe.kind === "control") {
      return probe.verdict === "different"
        ? { text: "ok", good: true }
        : { text: "no difference, giving up", good: false };
    }
    return probe.verdict === "same"
      ? { text: "same page", good: true }
      : { text: "different", good: false };
  }

  function removedParams(original: string, sanitized: string): string[] {
    try {
      const before = new Set(new URL(original).searchParams.keys());
      const after = new Set(new URL(sanitized).searchParams.keys());
      return [...before].filter((p) => !after.has(p));
    } catch {
      return [];
    }
  }

  function hostnameOf(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  }

  function issueQuery(fields: [string, string][]): string {
    return fields
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
  }

  function buildGitHubIssueUrl(url: string, sanitized: string | null): string {
    const domain = hostnameOf(url);

    let body = `## URL\n${url}\n\n## Details\nPlease describe what happened and which parameters look like trackers.`;
    if (sanitized) {
      try {
        const cleaned = new URL(sanitized);
        const allowedParams = [...new Set(cleaned.searchParams.keys())];
        const removed = removedParams(url, sanitized);
        body = `## Domain
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
      } catch {
        // fall back to the plain body
      }
    }

    const query = issueQuery([
      ["title", `Rule request: ${domain}`],
      ["body", body],
      ["labels", "rule-request"],
    ]);
    return `https://github.com/Tail-WTF/Rules/issues/new?${query}`;
  }
</script>

<Layout>
  {#if unsanitized.length === 0}
    <header>
      <H1 class="font-normal!">&#129300; No links found.</H1>
    </header>
    <p class="text-rose-450 mt-4">Add a link to your text and try again.</p>
  {:else if view.name === "choose"}
    <header>
      <H1 class="font-normal!">&#128546; Your links are not sanitized.</H1>
    </header>
    <p class="text-rose-450 mt-4">
      No rules matched. Choose a link to verify against its live page:
    </p>
    <div class="mt-6 flex flex-col gap-3">
      {#each unsanitized as link (link)}
        <button
          onclick={() => startVerification(link)}
          class="truncate border-2 border-gray-500 px-4 py-3 text-left text-gray-300 transition-colors hover:border-gray-300"
        >
          {link}
        </button>
      {/each}
    </div>
  {:else if view.name === "idle"}
    <header>
      <H1 class="font-normal!">&#128546; Your link is not sanitized.</H1>
    </header>
    <p class="text-rose-450 mt-4">
      We were unable to sanitize your link with our rules.
    </p>
    <div class="mt-6 flex gap-4">
      <button
        onclick={() => view.name === "idle" && startVerification(view.link)}
        class="border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
      >
        Verify against live page
      </button>
      <a
        href={buildGitHubIssueUrl(view.link, null)}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
      >
        Submit Rule to GitHub
      </a>
    </div>
    <p class="mt-4 max-w-prose text-sm text-pretty text-gray-400">
      Heuristic check that compares the page with and without its parameters.
      Some trackers may survive, and the result may not always work.
    </p>
  {:else}
    {#if view.name === "streaming"}
      <header>
        <H1
          class="animate-pulse font-normal! italic motion-reduce:animate-none"
        >
          Verifying...
        </H1>
      </header>
    {:else if view.name === "promoted"}
      <header>
        <H1 class="font-normal! italic">
          &#127881; Your link is now sanitized! Click to copy it.
        </H1>
      </header>
    {:else if view.name === "noresult" && view.reason === "budget"}
      <header>
        <H1 class="font-normal!">&#9203; Out of verification for now.</H1>
      </header>
      <p class="text-rose-450 mt-4 max-w-prose text-pretty">
        Try again in a few hours. Your link is unchanged.
      </p>
    {:else}
      <header>
        <H1 class="font-normal!">&#128566; Couldn't sanitize this link.</H1>
      </header>
      <p class="text-rose-450 mt-4">
        Comparing pages found nothing safe to remove. Your link is unchanged.
      </p>
    {/if}

    <div class="mt-6 flex flex-col gap-1 text-sm">
      {#each transcript as item, index (index)}
        {#if "notice" in item}
          <p class="text-gray-400">-&gt; retrying with a real browser</p>
        {:else}
          {@const probe = item}
          <p class="flex gap-2 text-gray-400">
            <span class="shrink-0">
              -&gt;{probe.kind === "control" ? " calibrating:" : ""}
            </span>
            <a
              href={probe.candidate}
              target="_blank"
              rel="noopener noreferrer"
              class="min-w-0 truncate transition-colors hover:text-gray-300 hover:underline"
            >
              {probe.candidate}
            </a>
            {#if probe.verdict === undefined}
              <span class="shrink-0 animate-pulse motion-reduce:animate-none">
                ...
              </span>
            {:else}
              <span class="shrink-0">...</span>
              <span
                class="shrink-0 {probeVerdict(probe).good
                  ? 'text-lime-550'
                  : 'text-gray-500'}"
              >
                {probeVerdict(probe).text}
              </span>
            {/if}
          </p>
        {/if}
      {/each}
      {#if view.name === "streaming" && !transcript.some((item) => !("notice" in item) && item.verdict === undefined)}
        <p class="animate-pulse text-gray-400 motion-reduce:animate-none">
          -&gt; _
        </p>
      {/if}
    </div>

    {#if view.name === "promoted"}
      <div class="mt-6">
        <ResultLink value={view.sanitized} href={view.sanitized} />
      </div>
      <p class="mt-2 max-w-prose text-sm text-pretty text-gray-400">
        The page looked identical without the removed parameters. This check is
        heuristic — confirm the link works before sharing.
      </p>
      {#if removedParams(view.link, view.sanitized).length > 0}
        <p class="mt-4 text-sm text-gray-400">
          Removed: {removedParams(view.link, view.sanitized).join(", ")}
        </p>
      {/if}
      <div class="mt-4 border border-gray-700 p-4">
        <p class="text-sm text-gray-300">
          Help others: submit this as a permanent rule.
        </p>
        <a
          href={buildGitHubIssueUrl(view.link, view.sanitized)}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-4 inline-block border-2 border-gray-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-300"
        >
          Submit Rule to GitHub
        </a>
      </div>
    {/if}

    {#if view.name === "noresult"}
      <div class="mt-6">
        <a
          href={buildGitHubIssueUrl(view.link, null)}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block border-2 border-gray-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-300"
        >
          Submit Rule to GitHub
        </a>
      </div>
    {/if}
  {/if}

  {#if onReset}
    <button
      onclick={onReset}
      class="mt-6 border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
    >
      Sanitize another link
    </button>
  {/if}
</Layout>
