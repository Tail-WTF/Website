<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    children: Snippet;
  }

  let { class: className = "", children }: Props = $props();
</script>

<h2 class={`text-md text-gray-500 md:text-xl ${className}`}>
  {@render children()}
</h2>
