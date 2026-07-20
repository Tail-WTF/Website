<script lang="ts">
  interface Props {
    value: string;
    href: string;
  }

  let { value, href }: Props = $props();
  let copyState = $state<boolean | null>(null);

  function handleCopy() {
    try {
      navigator.clipboard.writeText(value);
      copyState = true;
    } catch {
      copyState = false;
    }
  }
</script>

<div class="relative">
  <button
    onclick={handleCopy}
    class="w-full border-2 border-lime-200 bg-transparent p-4 pr-14 text-left text-lg break-all text-lime-200 italic md:text-xl"
  >
    {value}
  </button>
  <a
    {href}
    target="_blank"
    rel="noopener noreferrer"
    class="absolute top-4 right-4 flex h-6 w-6"
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
