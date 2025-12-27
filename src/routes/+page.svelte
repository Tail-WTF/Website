<script lang="ts">
  import { goto } from "$app/navigation";
  import Layout from "$lib/components/Layout.svelte";
  import H1 from "$lib/components/H1.svelte";
  import H2 from "$lib/components/H2.svelte";
  import LinkBox from "$lib/components/LinkBox.svelte";
  import ActionBtn from "$lib/components/ActionBtn.svelte";

  let url = $state("");

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    goto(`/sanitize?url=${encodeURIComponent(url)}`);
  }

  async function handleInputClick() {
    if (url === "") {
      try {
        url = await navigator.clipboard.readText();
      } catch {}
    }
  }
</script>

<svelte:head>
  <title>Link Sanitizer - Tail.WTF</title>
</svelte:head>

<Layout paddingTop={false}>
  <div class="flex h-screen flex-col">
    <header class="mt-[calc(10vh+4rem)]">
      <H1>Link Sanitizer</H1>
      <H2>Chop trackers from shared link</H2>
    </header>

    <div class="mt-10">
      <form action="/sanitize" method="get" onsubmit={handleSubmit}>
        <LinkBox
          required
          bind:value={url}
          placeholder="-> Paste your link here <-"
          class="peer placeholder:text-lime-550 border-gray-500 transition-colors valid:border-gray-700! focus:border-gray-300"
          onclick={url === "" ? handleInputClick : undefined}
          autofocus
          enterkeyhint="go"
        />
        <ActionBtn
          type="submit"
          class="peer-valid:border-lime-550 mt-8 ml-auto transition-colors peer-valid:fill-lime-200 peer-valid:text-lime-200 hover:border-gray-300 hover:fill-gray-300 hover:text-gray-300 peer-valid:hover:border-lime-200"
        >
          <svg
            role="img"
            viewBox="0 0 24 24"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            class="mr-3 h-6 w-6"
          >
            <path
              d="M15.273 2.182h6.545v6.545H24V24H13.09V8.727h2.183V6.545h2.182v2.182h2.181V4.364h-4.363zm6.545 8.727h-6.545v6.546h2.182V13.09h4.363zm-4.363 8.727h-2.182v2.182h2.182zM6.545 9.818H4.364V12H2.182v2.182h2.182v2.182h2.181v-2.182h2.182V12H6.545ZM4.364 0H2.182v2.182H0v2.182h2.182v2.181h2.182V4.364h2.181V2.182H4.364Zm6.545 4.364H8.727v2.181H6.545v2.182h2.182v2.182h2.182V8.727h2.182V6.545h-2.182z"
            />
          </svg>
          Sanitize
        </ActionBtn>
      </form>
    </div>
    <div class="invisible grow"></div>
    <div class="mb-7 animate-bounce text-base">&#8595; Why? &#8595;</div>
  </div>
  <!-- First screen ends here -->
  <div class="mt-20">
    <H1 id="about" class="font-bold!">Why sanitize links?</H1>
    <div class="mt-7">
      <p class="break-all text-gray-500">https://example.com/foo</p>
      <div
        class="flex w-full flex-row gap-10 overflow-auto pr-5 whitespace-nowrap"
      >
        <p class="text-gray-500">
          ?<span class="text-rose-450">share_source=copy_web</span>
          <br />
          &amp;
          <span class="text-rose-450">track=12345abcdef67890</span>
        </p>
        <p class="text-lime-550 mt-auto">
          "link generated on webpage"
          <br />
          "and shared by <i>user</i> at <i>date</i>... "
        </p>
      </div>
    </div>
    <p class="mt-7 text-justify hyphens-auto md:w-4/6">
      Because online services want to monitor your digital life! When you tap
      share buttons, innocent-looking random strings are placed in the links you
      get - they are actually
      <span class="text-rose-450">"trackers"</span>
      tied to your account. Every time your friends open these links, service providers
      learn more about your social connections such as how often you talk to a particular
      friend, topics you discuss, etc. They can further exploit this information
      in conjunction with other data they have about you and your friends.
      <br />
      <br />
      Tail.WTF protects your privacy by chopping the annoying
      <span class="text-rose-450">"tails"</span>
      off these links, and also makes them look succinct and nicer.
    </p>
    <H1 id="privacy" class="mt-24 font-bold!">Privacy</H1>
    <p class="mt-7 text-justify hyphens-auto md:w-4/6">
      As a service that aims to protect your privacy, we do not collect any
      information from you without your explicit consent. When we fail to
      sanitize specific link(s), we may ask if you would like to share info
      about them to improve this service.
      <br />
      <br />
      This site is proxied through and powered by
      <a
        href="https://www.cloudflare.com"
        target="_blank"
        rel="noopener noreferrer"
        class="text-cyan-600 hover:underline">Cloudflare</a
      >. We use Cloudflare Workers for our API, Workers AI for intelligent URL
      analysis, and Browser Rendering for verifying page content. Your requests
      are processed through Cloudflare's infrastructure. For details on how
      Cloudflare handles data, please see
      <a
        href="https://www.cloudflare.com/privacypolicy/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-cyan-600 hover:underline">Cloudflare's Privacy Policy</a
      >.
    </p>
  </div>
</Layout>
