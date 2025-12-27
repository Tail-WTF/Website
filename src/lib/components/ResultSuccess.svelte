<script lang="ts">
  import Layout from "./Layout.svelte";
  import H1 from "./H1.svelte";
  import LinkBox from "./LinkBox.svelte";

  interface Props {
    text: string;
    sanitizedURL: string;
  }

  let { text, sanitizedURL }: Props = $props();
  let copyState = $state<boolean | null>(null);

  function handleInputClick(e: MouseEvent) {
    const target = e.target as HTMLInputElement;
    target.select();
    try {
      navigator.clipboard.writeText(text);
      copyState = true;
    } catch {
      copyState = false;
    }
  }
</script>

<Layout>
  <header>
    <H1 class="font-normal! italic">
      &#127881; Your link is now sanitized! Click to copy it.
    </H1>
  </header>

  <div class="relative mt-3.5">
    <LinkBox
      readonly
      value={text}
      class="border-lime-200 pr-14 text-lime-200"
      onclick={copyState === null ? handleInputClick : undefined}
    />
    <a
      href={sanitizedURL}
      target="_self"
      rel="noopener noreferrer"
      class="absolute inset-y-0 right-4 my-auto flex h-6 w-6"
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 fill-lime-200"
      >
        <title>Open Sanitized Link</title>
        <path
          d="M24 0H13.09v2.182h6.546v2.182h-2.181v2.181h-2.182v2.182H13.09v2.182h-2.182v2.182h2.182v-2.182h2.182V8.727h2.182V6.545h2.181V4.364h2.182v6.545H24ZM0 2.182h8.727v2.182H2.182v17.454h17.454v-6.545h2.182V24H0Z"
        />
      </svg>
    </a>
  </div>
  {#if copyState !== null}
    <p
      class={`mt-4 transition-opacity duration-200 ${copyState ? "text-lime-550" : "text-rose-450"}`}
    >
      {copyState ? "Copied!" : "Unable to copy link. Please try manually."}
    </p>
  {/if}
</Layout>
