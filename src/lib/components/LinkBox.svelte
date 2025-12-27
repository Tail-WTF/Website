<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props extends HTMLInputAttributes {
    class?: string;
  }

  let { class: className = "", value = $bindable(), ...rest }: Props = $props();
</script>

<input
  name="url"
  spellcheck="false"
  autocorrect="off"
  autocomplete="off"
  autocapitalize="off"
  bind:value
  class={`w-full rounded-none border-2 bg-transparent p-4 text-lg text-ellipsis italic focus:outline-none md:text-xl ${className}`}
  {...rest}
/>
