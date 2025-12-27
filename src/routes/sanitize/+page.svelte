<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import Layout from "$lib/components/Layout.svelte";
  import H1 from "$lib/components/H1.svelte";
  import ResultSuccess from "$lib/components/ResultSuccess.svelte";
  import ResultFailure from "$lib/components/ResultFailure.svelte";

  const API_URL = import.meta.env.VITE_API_URL || "";

  type State =
    | { status: "loading" }
    | { status: "success"; text: string; sanitizedURL: string }
    | { status: "error"; originalUrl: string };

  let state = $state<State>({ status: "loading" });

  const url = $derived(page.url.searchParams.get("url"));

  onMount(() => {
    if (!url) return;

    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ text: url });
        const res = await fetch(`${API_URL}/api/sanitize?${params}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.sanitizedURLs?.[0]) {
          state = {
            status: "success",
            text: data.text,
            sanitizedURL: data.sanitizedURLs[0],
          };
        } else {
          state = { status: "error", originalUrl: url };
        }
      } catch {
        if (!cancelled) state = { status: "error", originalUrl: url };
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head>
  {#if state.status === "success"}
    <title>Result - Tail.WTF</title>
  {:else if state.status === "error"}
    <title>Rule Missing - Tail.WTF</title>
  {:else}
    <title>Sanitizing... - Tail.WTF</title>
  {/if}
</svelte:head>

{#if !url || state.status === "loading"}
  <Layout>
    <header>
      <H1 class="animate-pulse font-normal! italic">Sanitizing...</H1>
    </header>
    <div class="mt-3.5">
      <div
        class="h-14 w-full animate-pulse rounded border-2 border-gray-700 bg-gray-800/50"
      ></div>
    </div>
  </Layout>
{:else if state.status === "success"}
  <ResultSuccess text={state.text} sanitizedURL={state.sanitizedURL} />
{:else}
  <ResultFailure originalUrl={state.originalUrl} />
{/if}
