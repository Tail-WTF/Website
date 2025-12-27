<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    id?: string;
    class?: string;
    children: Snippet;
  }

  let { id, class: className = "", children }: Props = $props();
</script>

<h1 {id} class={`text-lg font-extrabold md:text-xl ${className}`}>
  {@render children()}
</h1>
