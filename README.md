<p align="center">
    <img src="https://user-images.githubusercontent.com/59678453/180375518-92d24d0c-12d5-4255-8746-380a7aca2b20.png#gh-light-mode-only"
        alt="Logo" width=70>
    <img src="https://user-images.githubusercontent.com/59678453/180376465-90aad3ca-85e9-44b4-b61f-01beabca61ba.png#gh-dark-mode-only"
        alt="Logo" width=70>
    <h3 align="center">
        Tail.WTF: <em>Website</em>&nbsp;&nbsp;
        <a href="https://github.com/Tail-WTF/Website"><img src="https://img.shields.io/github/stars/tail-wtf/website?style=social" alt="stars"></a>
    </h3>
    <p align="center">
        <a href="https://tail.wtf/">Website</a> and API for Tail.WTF.  Contributions, corrections & requests can be made on GitHub.<br />
        Find more details on <a href="https://github.com/Tail-WTF">project homepage</a>.
    </p>
</p>

## How it works

Tail.WTF minimizes link parameters — it does not merely strip known trackers.
Every link goes through this pipeline, and the response reports honestly what
happened to it:

1. **Expand** — short links (`b23.tv`, `a.co`, …) are dereferenced by following
   redirects (HEAD, falling back to GET).
2. **Rules** — per-site allowlist rules decide which path segments and
   parameters survive. Rules live in
   [Tail-WTF/Rules](https://github.com/Tail-WTF/Rules); the build fetches the
   assembled ruleset and bundles it into the worker.
3. **Verification** (opt-in via `deep=true`) — for sites without rules, the
   worker compares the page's identity metadata (`<title>`, `og:title`,
   `og:description`, all of which must match) across candidate URLs, then
   binary-searches for the minimal set of parameters that still shows the same
   content. Before trusting any "same" verdict it first checks a control page
   that must differ — if the site serves identical metadata everywhere (e.g. a
   client-rendered shell), verification refuses to conclude anything.
   Parameters are removed only when the pages look identical without them —
   a heuristic: it can miss trackers and cannot guarantee the sanitized link
   still works. Unverifiable links are reported as not sanitized; there is
   deliberately no "strip `utm_*` and hope" fallback.

## Public API

One API for everyone: the web UI, iOS Shortcuts, clipboard tools, and bots all
use the same endpoints. CORS is open; no authentication.

### `GET /api/sanitize`

| Query param | Description |
| ----------- | ----------- |
| `text` (required) | Text containing one or more links |
| `deep` | `true` to enable live-page verification for unknown domains |
| `format` | `text` to get back only the sanitized text as `text/plain` |

### `POST /api/sanitize`

JSON body: `{ "text": "...", "deep": true }`. Same query params apply.

### Response

```json
{
  "text": "look https://example.com/item/42",
  "links": [
    {
      "original": "https://example.com/item/42?share_token=abc",
      "sanitized": "https://example.com/item/42",
      "method": "rule"
    }
  ]
}
```

`method` is one of:

| Method | Meaning |
| ------ | ------- |
| `rule` | Cleaned by a per-site rule |
| `expanded` | Short link dereferenced; no rule for the target, parameters untouched |
| `canonical` | Replaced by the page's own canonical URL (verified) |
| `verified` | Parameters removed after live-page comparison proved them removable |
| `none` | Nothing could be done safely; the link is unchanged |

### Examples

```bash
# JSON
curl -G "https://tail.wtf/api/sanitize" --data-urlencode "text=https://example.com/item/42?share_token=abc"

# Clean the clipboard in place (macOS)
pbpaste | curl -sG "https://tail.wtf/api/sanitize" --data-urlencode "text@-" --data-urlencode "format=text" | pbcopy
```

For iOS Shortcuts, use "Get Contents of URL" with the `GET` form and either
parse the JSON or pass `format=text`.

### Bot webhooks

- `POST /api/bot/telegram` — Telegram webhook (messages and inline queries)

## Repository layout

- `frontend/` — SvelteKit static site (UI only; talks to the public API)
- `api/` — Cloudflare Worker (Hono). Serves `/api/*` and the built frontend via
  Workers Assets from a single deployment (`api/wrangler.jsonc`,
  `run_worker_first: ["/api/*"]`)

## Development

Prerequisites: Node.js 24+, pnpm 9.

```bash
pnpm install
pnpm dev          # build UI once + wrangler dev on http://localhost:8787
pnpm run dev:ui   # UI hot reload on :5173, /api proxied to :8787
```

| Command | Description |
| ------- | ----------- |
| `pnpm run check` | Typecheck worker and frontend |
| `pnpm test` | Worker unit tests (vitest + @cloudflare/vitest-pool-workers) |
| `pnpm run test:e2e` | Playwright e2e against `wrangler dev` (real API, no mocks) |
| `pnpm run build` | Build the static site and bundle rules |
| `pnpm run deploy` | Build and `wrangler deploy` |

Rules live in [Tail-WTF/Rules](https://github.com/Tail-WTF/Rules), whose CI
publishes the assembled ruleset as a release asset. `api/scripts/build-rules.mjs`
converts it to JSON before dev/test/deploy, reading from the first available
source: the `TAIL_WTF_RULES_FILE` env var, a `Link-Sanitization-Rules` checkout
next to this repo, or the release asset.

## Deployment

A single Cloudflare Worker serves both the API and the static site, deployed
by [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/):
the Cloudflare GitHub App pulls the repository on push, builds it, and
authenticates with an API token it provisions and manages itself. Build
settings on the Worker:

| Setting | Value |
| ------- | ----- |
| Production branch | `main` |
| Build command | `pnpm run build` |
| Deploy command | `pnpm --dir api run deploy` |
| Non-production branch deploy command | `pnpm --dir api exec wrangler versions upload` |
| Root directory | `/` |

`.github/workflows/ci.yml` runs typecheck, unit tests, lint, and e2e on every
push and PR.
