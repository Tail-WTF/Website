<script lang="ts">
  import Layout from "./Layout.svelte";
  import H1 from "./H1.svelte";
  import LinkBox from "./LinkBox.svelte";

  const API_URL = import.meta.env.VITE_API_URL || "";

  interface Props {
    originalUrl: string;
  }

  interface SanitizeResult {
    sanitizedUrl: string;
    removedParams: string[];
    suggestedRule: { pattern: string; allowedParams: string[] } | null;
    confidence?: number;
    requiredParams?: string[];
  }

  let { originalUrl }: Props = $props();
  let method = $state<"idle" | "ai" | "browser">("idle");
  let fetchState = $state<"idle" | "loading" | "success" | "error">("idle");
  let result = $state<SanitizeResult | null>(null);
  let copyState = $state<boolean | null>(null);

  async function trySanitize(type: "ai" | "browser") {
    method = type;
    fetchState = "loading";
    try {
      const endpoint =
        type === "ai" ? "/api/ai-sanitize" : "/api/browser-sanitize";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: originalUrl }),
      });
      const data = await res.json();
      if (data.sanitizedUrl) {
        result = data;
        fetchState = "success";
      } else {
        fetchState = "error";
      }
    } catch {
      fetchState = "error";
    }
  }

  function handleCopy() {
    if (!result) return;
    try {
      navigator.clipboard.writeText(result.sanitizedUrl);
      copyState = true;
    } catch {
      copyState = false;
    }
  }

  function buildGitHubIssueUrl(domain: string, result: SanitizeResult): string {
    const title = `Rule request: ${domain}`;

    const body = `## Domain
\`${domain}\`

## Removed Parameters
${result.removedParams.length > 0 ? result.removedParams.map((p) => `- \`${p}\``).join("\n") : "None"}

## Suggested Rule
\`\`\`yaml
${domain}:
  sanitize:
    - pattern: "${result.suggestedRule?.pattern || "^/.*$"}"
      allowedParams: [${result.suggestedRule?.allowedParams.map((p) => `"${p}"`).join(", ") || ""}]
\`\`\`
`;

    const params = new URLSearchParams({
      title,
      body,
      labels: "rule-request",
    });

    return `https://github.com/Tail-WTF/Rules/issues/new?${params}`;
  }
</script>

<Layout>
  <header>
    <H1 class="font-normal!">&#128546; Your link is not sanitized.</H1>
  </header>
  <p class="text-rose-450 mt-4">
    We were unable to sanitize your link with our rules.
  </p>

  {#if fetchState === "idle"}
    <div class="mt-6 flex gap-4">
      <button
        onclick={() => trySanitize("ai")}
        class="border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
      >
        Try AI
      </button>
      <button
        onclick={() => trySanitize("browser")}
        class="border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
      >
        Try Browser Render
      </button>
    </div>
  {/if}

  {#if fetchState === "loading"}
    <p class="mt-6 animate-pulse text-gray-400">
      {method === "ai"
        ? "AI is analyzing your URL..."
        : "Browser is testing parameters..."}
    </p>
  {/if}

  {#if fetchState === "error"}
    <p class="text-rose-450 mt-6">
      {method === "ai" ? "AI" : "Browser"} sanitization failed.
    </p>
  {/if}

  {#if fetchState === "success" && result}
    <div class="mt-6">
      <p class="text-lime-550">
        {method === "ai" && result.confidence !== undefined
          ? `AI suggestion (confidence: ${Math.round(result.confidence * 100)}%):`
          : "Browser-verified suggestion:"}
      </p>
      <div class="relative mt-2">
        <LinkBox
          readonly
          value={result.sanitizedUrl}
          class="border-lime-200 pr-14 text-lime-200"
          onclick={handleCopy}
        />
      </div>
      {#if copyState}
        <p class="text-lime-550 mt-2">Copied!</p>
      {/if}

      {#if result.removedParams.length > 0}
        <p class="mt-4 text-sm text-gray-400">
          Removed: {result.removedParams.join(", ")}
        </p>
      {/if}

      {#if result.suggestedRule}
        <div class="mt-4 border border-gray-700 p-4">
          <p class="text-sm text-gray-300">Suggested rule:</p>
          <pre class="mt-2 overflow-auto text-xs text-gray-400">
            {JSON.stringify(result.suggestedRule, null, 2)}
          </pre>
          <a
            href={buildGitHubIssueUrl(new URL(originalUrl).hostname, result)}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 inline-block border-2 border-gray-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-300"
          >
            Submit Rule to GitHub
          </a>
        </div>
      {/if}
    </div>
  {/if}
</Layout>
