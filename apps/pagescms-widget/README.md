# @pagescms/widget

TypeScript source for the Pages CMS site widget script (`pagescms-widget.js`).

This script is installed on a user's public website. It provides:

- An admin bar for quick edit/create actions when activated
- Live preview bindings via `postMessage` when embedded in the CMS iframe

## Build

```bash
pnpm --filter @pagescms/widget build
```

Outputs:

- `apps/pagescms-widget/dist/pagescms-widget.js` — worker assets
- `public/pagescms-widget.js` — local copy for the main CMS app

## Deploy (Cloudflare Worker)

The widget is deployed as a separate Cloudflare Worker named `pagescms-widget`:

```bash
pnpm deploy:widget
```

Production and preview deployments run automatically via GitHub Actions alongside the main CMS worker.

| Environment | Worker name | Script URL |
|-------------|-------------|------------|
| Production | `pagescms-widget` | `https://pagescms-widget.<subdomain>.workers.dev/pagescms-widget.js` |
| PR preview | `pagescms-widget-pr-<N>` | `https://pagescms-widget-pr-<N>.<subdomain>.workers.dev/pagescms-widget.js` |

## Development

```bash
pnpm --filter @pagescms/widget dev
```

Rebuilds automatically on file changes.

## Usage on a site

```html
<script
  src="https://pagescms-widget.<subdomain>.workers.dev/pagescms-widget.js"
  data-pagescms-origin="https://your-cms.example"
  data-pagescms-owner="org"
  data-pagescms-repo="repo"
  data-pagescms-branch="main"
></script>
```

Activate the admin bar with `?pagescms` or `#pagescms` in the URL.

## Ported from

Upstream reference: [hunvreus/pagescms `feature/preview`](https://github.com/hunvreus/pagescms/blob/feature/preview/public/pagescms-site.js)
