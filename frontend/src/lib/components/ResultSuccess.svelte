<script lang="ts">
  import Layout from "./Layout.svelte";
  import H1 from "./H1.svelte";
  import ResultLink from "./ResultLink.svelte";

  interface Link {
    original: string;
    sanitized: string;
    method: string;
  }

  interface Props {
    text: string;
    links: Link[];
    onReset?: () => void;
  }

  let { text, links, onReset }: Props = $props();
  const changed = $derived(
    links.filter(
      (link) => link.method !== "none" && link.sanitized !== link.original,
    ),
  );
</script>

<Layout>
  <header>
    <H1 class="font-normal! italic">
      &#127881; Your link is now sanitized! Click to copy it.
    </H1>
  </header>

  <div class="mt-3.5">
    <ResultLink value={text} href={changed[0]?.sanitized ?? text} />
  </div>

  {#if onReset}
    <button
      onclick={onReset}
      class="mt-6 border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
    >
      Sanitize another link
    </button>
  {/if}
</Layout>
