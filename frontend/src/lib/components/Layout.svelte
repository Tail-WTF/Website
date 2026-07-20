<script lang="ts">
  import Footer from "./Footer.svelte";

  interface Props {
    paddingTop?: boolean;
    children: import("svelte").Snippet;
  }

  let { paddingTop = true, children }: Props = $props();
</script>

<main class="mx-auto max-w-screen-md px-8 md:px-0">
  <div
    class={`flex min-h-screen flex-col ${paddingTop ? "pt-[calc(10vh+4rem)]" : ""}`}
  >
    {@render children()}
    <div class="invisible grow"></div>
    <Footer />
  </div>
</main>
