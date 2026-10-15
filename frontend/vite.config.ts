import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({
        pages: "out",
        assets: "out",
        fallback: "404.html",
        precompress: false,
        strict: true,
      }),
      prerender: {
        entries: ["/"],
      },
    }),
  ],
  server: {
    // wrangler dev serves the API during development
    proxy: { "/api": "http://localhost:8787" },
  },
});
