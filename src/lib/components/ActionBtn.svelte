<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends HTMLButtonAttributes {
    class?: string;
    children: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
</script>

<button
  class={`flex items-center border-2 border-gray-700 fill-gray-700 px-8 py-3 text-lg font-bold text-gray-700 italic focus:border-gray-300 focus:outline-none md:text-xl ${className}`}
  {...rest}
>
  {@render children()}
</button>
