<script lang="ts">
  import { page } from "$app/state";
  import Layout from "$lib/components/Layout.svelte";
  import H1 from "$lib/components/H1.svelte";
  import H2 from "$lib/components/H2.svelte";
</script>

<svelte:head>
  <title>Page Not Found - Tail.WTF</title>
</svelte:head>

<Layout>
  <H1>{page.status} - Page Not Found</H1>
  <H2 class="mt-2">We cannot find the page you are looking for :-(</H2>
  <a href="/" class="mt-10 block text-lg text-cyan-600 md:text-xl">
    &lt;- Back to home page
  </a>
</Layout>
