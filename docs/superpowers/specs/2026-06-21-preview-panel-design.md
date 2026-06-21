# Preview Panel Design

**Date:** 2026-06-21  
**Status:** Approved

## Overview

Add a side-by-side live preview panel to the collection item edit page and file editor. The panel is conditionally shown when the current schema has a `previewPath` configured. It loads the user's website in an iframe and syncs form state in real-time via `postMessage`.

## Config Schema

Two new fields added to the CMS config:

### Root config — `siteUrl`
The base URL of the user's website. Used to construct the full preview URL.

```yaml
siteUrl: https://mysite.com
```

### Per-collection / per-file schema — `previewPath`
A static path pointing to the user's client-side preview page.

```yaml
collections:
  - name: products
    previewPath: /preview/products
    fields: [...]
```

Full preview URL: `siteUrl + previewPath` (e.g. `https://mysite.com/preview/products`)

If either `siteUrl` or `previewPath` is absent, the preview panel is hidden and the editor renders full-width as today.

## Layout

When `previewPath` is present, the `Entry` component's content area splits into two columns:

- **Left** — editor form (existing content, unchanged)
- **Right** — `PreviewPanel` component

The split is **user-resizable** via a drag handle between the two columns. A resize library (e.g. `react-resizable-panels`) handles this. On screens below the `lg` breakpoint, the preview panel is hidden entirely.

A toggle button in the existing entry header (only rendered when `previewPath` is set) shows/hides the preview panel. Toggle state is local to `Entry`.

## PreviewPanel Component

`components/entry/preview-panel.tsx`

Props:
- `previewUrl: string` — full iframe src
- `formValues: Record<string, unknown>` — current form state, updated on every change

Contains:
- Toolbar with **Refresh** button (reloads iframe) and **Open in new tab** button (opens `previewUrl`)
- `<iframe>` filling remaining height, ref forwarded for postMessage targeting

## Real-time Sync (postMessage)

Inside `Entry`, `useWatch` from react-hook-form observes the full form state. A `useEffect` fires on every change and posts to the iframe:

```ts
iframeRef.current.contentWindow.postMessage(
  { type: 'cms:preview', data: formValues },
  siteUrl  // targetOrigin scoped to user's domain, not '*'
)
```

An initial message is sent after the iframe `load` event fires so the preview renders immediately without requiring a field change.

### User-side listener (documented for users)

```js
window.addEventListener('message', (e) => {
  if (e.data.type === 'cms:preview') renderPreview(e.data.data)
})
```

## Files to Create / Modify

| Action | File |
|--------|------|
| Create | `components/entry/preview-panel.tsx` |
| Modify | `components/entry/entry.tsx` — add toggle state, split layout, resizable panels, `useWatch` + postMessage effect |
| Modify | `types/config.ts` — add `siteUrl` to root config type |
| Modify | Schema/config parsing — add `previewPath` to collection and file schema types |

## Error Handling

- If the iframe fails to load (e.g. wrong `siteUrl`, CORS block on iframe), show a fallback message inside the panel: "Could not load preview. Check your `siteUrl` config."
- postMessage failures are silent (no try/catch needed — browser handles missing iframe ref gracefully).

## Out of Scope

- Device-width toggle (mobile/tablet/desktop frame) — YAGNI
- Dynamic URL interpolation (e.g. `/preview/products/{slug}`) — static path only
- Resizing below `lg` breakpoint — panel is hidden on small screens
