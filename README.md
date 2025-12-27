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
        <a href="https://tail.wtf/">Website</a> for Tail.WTF.  Contributions, corrections & requests can be made on GitHub.<br />
        Find more details on <a href="https://github.com/Tail-WTF">project homepage</a>.
    </p>
</p>

## Development

### Prerequisites

- Node.js 24+
- npm

### Project Structure

```
src/
├── routes/           # SvelteKit pages
│   ├── +page.svelte  # Home page (sanitization UI)
│   ├── +error.svelte # 404 page
│   └── +layout.svelte
├── lib/
│   └── components/   # Reusable Svelte components
e2e/                  # Playwright e2e tests
worker/               # Cloudflare Worker API
```

---

## Frontend (SvelteKit)

### Setup

```bash
npm install
```

### Commands

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start development server with hot reload |
| `npm run build`       | Build static site to `out/` directory    |
| `npm run preview`     | Preview production build locally         |
| `npm run lint`        | Run ESLint and Prettier checks           |
| `npm run check`       | Run Svelte type checking                 |
| `npm run test:e2e`    | Run Playwright e2e tests (headless)      |
| `npm run test:e2e:ui` | Run Playwright tests with UI             |

### Deployment

Deployed to Cloudflare Pages on push to `main`.

---

## Worker API (Cloudflare Workers)

The API is built with [Hono](https://hono.dev/) and runs on Cloudflare Workers with Workers AI and Browser Rendering.

### Setup

```bash
cd worker
npm install
```

### Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start local dev server with Wrangler |
| `npm run deploy` | Deploy to Cloudflare Workers         |
| `npm run test`   | Run Vitest tests                     |

### Configuration

Edit `worker/wrangler.toml` to configure:

- `name` - Worker name
- `RULES_KV` - KV namespace for sanitization rules
- `AI` - Workers AI binding
- `BROWSER` - Browser Rendering binding

### Local Development

```bash
cd worker
npm run dev
```

The worker runs at `http://localhost:8787`. Use `VITE_API_URL=http://localhost:8787` when running the frontend to connect to local worker.

### Deployment

Deployed to Cloudflare Workers on push to `main` (when `worker/` files change).

---

## Required Secrets

Configure these in GitHub repository settings:

| Secret                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token with Workers and Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                   |
