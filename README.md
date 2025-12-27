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

### Setup

```bash
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build static site to `out/` directory |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint and Prettier checks |
| `npm run check` | Run Svelte type checking |
| `npm run test:e2e` | Run Playwright e2e tests (headless) |
| `npm run test:e2e:ui` | Run Playwright tests with UI |

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
worker/               # Cloudflare Worker API (separate deployment)
```

### Deployment

The frontend is deployed to Cloudflare Pages on push to `main`. Required secrets:

- `CLOUDFLARE_API_TOKEN` - API token with Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

The worker API in `worker/` is deployed separately to Cloudflare Workers.
