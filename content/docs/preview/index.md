---
title: "Preview"
description: "Set up live content preview so editors can see changes before publishing."
---

# Preview

Pages CMS supports live preview — editors see their content rendered in a panel as they type, without saving or publishing first.

Preview works by loading your site in an iframe and sending content updates via `postMessage`. Your site listens for these messages and updates its rendered output.

## How it works

1. Editor opens an entry. Pages CMS loads your site's preview URL in an iframe.
2. As the editor types, the CMS sends a `postMessage` to the iframe:
   ```json
   { "type": "cms:preview", "data": { "title": "...", "body": "..." } }
   ```
3. Your site receives the message and re-renders with the new data.
4. When the iframe is ready, it signals back:
   ```json
   { "type": "cms:preview:ready" }
   ```

## Configuration

Add `siteUrl` and `previewPath` to your `.pages.yml`:

```yaml
object:
  siteUrl: https://yourdomain.com
  previewPath: /preview/{slug}
```

| Key | Description |
| --- | --- |
| `siteUrl` | Base URL of your deployed site. |
| `previewPath` | Path to your preview page. Use `{slug}` or any content field as a token. |

The CMS constructs the preview URL as `siteUrl + previewPath` and loads it in the preview panel.

## Framework guides

Choose your framework:

- [Next.js](./preview/nextjs)
- [Nuxt](./preview/nuxt)
- [SvelteKit](./preview/sveltekit)
- [Astro](./preview/astro)

## Framework compatibility

Preview relies on client-side reactivity to update the rendered page without a full reload. The integration experience varies by framework:

| Framework | Integration effort | Notes |
| --- | --- | --- |
| Next.js | Low | Client components hydrate and react to postMessage naturally |
| Nuxt | Low | Vue hydration handles updates via a composable |
| SvelteKit | Low | Svelte stores react to postMessage naturally |
| Astro (with islands) | Medium | Requires a framework island for the content area |
| Astro (static, no islands) | High | No reactive runtime — see Astro guide |
| 11ty / Hugo / Jekyll | Not recommended | Pure static HTML, no client-side component model |

For pure static site generators (11ty, Hugo, Jekyll), live preview is not well-supported via postMessage. A full page reload on save is the most practical option for those frameworks.
