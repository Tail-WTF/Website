import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
          TELEGRAM_BOT_TOKEN: "test-bot-token",
          BROWSER_VERIFY: "off",
          ACTOR_HASH_KEY: "test-actor-hash-key",
        },
      },
    }),
  ],
});
