# @pagescms/widget

TypeScript source for the Pages CMS site widget script (`pagescms-widget.js`).

This script is installed on a user's public website. It provides:

- An admin bar for quick edit/create actions when activated
- Live preview bindings via `postMessage` when embedded in the CMS iframe

## Build

```bash
pnpm --filter @pagescms/widget build
```

Output: `public/pagescms-widget.js` (bundled into the main CMS app at `/pagescms-widget.js` on deploy).

The root `pnpm build` runs the widget build before `vinext build`, so CI ships the script with the main application worker.

## Development

```bash
pnpm --filter @pagescms/widget dev
```

Rebuilds automatically on file changes.

## Usage on a site

```html
<script
  src="https://your-cms.example/pagescms-widget.js"
  data-pagescms-origin="https://your-cms.example"
  data-pagescms-owner="org"
  data-pagescms-repo="repo"
  data-pagescms-branch="main"
></script>
```

Activate the admin bar with `?pagescms` or `#pagescms` in the URL.

## Preview bridge protocol

When the page is loaded inside the CMS preview iframe, the widget handles these `postMessage` events:

| Event | Direction | Purpose |
| --- | --- | --- |
| `pagescms:preview:hello` | CMS → site | Poll until bridge is ready |
| `pagescms:preview:ready` | Site → CMS | Bridge acknowledged |
| `pagescms:preview:update` | CMS → site | `{ bindings: [{ target, bind, value }] }` |
| `pagescms:preview:debug` | Site → CMS | Target-not-found warnings |

Bind types: `text`, `html`, `value`, `src`, `href`, `checked`, `content`. Array values update repeated DOM targets (use `{n}` in selectors for indexed elements).

## Ported from

Upstream reference: [hunvreus/pagescms `feature/preview`](https://github.com/hunvreus/pagescms/blob/feature/preview/public/pagescms-site.js)
