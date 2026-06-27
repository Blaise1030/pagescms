---
title: "Preview"
description: "Set up live content preview so editors can see changes before publishing."
---

# Preview

Pages CMS supports live preview — editors see their content rendered in a panel as they type, without saving or publishing first.

Preview loads your site in an iframe and pushes field bindings over `postMessage` using the `pagescms-widget.js` bridge script.

## How it works

1. Editor opens an entry. Pages CMS loads a preview URL in an iframe.
2. The CMS sends `pagescms:preview:hello` until the site bridge is ready.
3. The site bridge responds with `pagescms:preview:ready`.
4. As the editor types, the CMS sends binding updates:
   ```json
   {
     "type": "pagescms:preview:update",
     "bindings": [
       { "target": "#title", "bind": "text", "value": "Hello world" }
     ]
   }
   ```

## Site script

Add `pagescms-widget.js` to your public site:

```html
<script
  src="https://pagescms-widget.<subdomain>.workers.dev/pagescms-widget.js"
  data-pagescms-origin="https://your-cms.example"
  data-pagescms-owner="org"
  data-pagescms-repo="repo"
  data-pagescms-branch="main"
></script>
```

The script also provides an admin bar (activate with `?pagescms` in the URL).

## Configuration

Add site settings and a per-collection path to `.pages.yml`:

```yaml
settings:
  site:
    url: https://yourdomain.com
    preview:
      defaultOpen: true
content:
  - name: posts
    site:
      path: /blog/{{slug}}
    fields:
      - name: title
        type: string
        preview:
          target: "#title"
          bind: text
```

| Key | Description |
| --- | --- |
| `settings.site.url` | Base URL of your deployed site. |
| `content[].site.path` | Preview path template (`{{slug}}`, field names, etc.). |
| `fields[].preview` | DOM binding rules for live updates. |

## Framework guides

Choose your framework:

- [Next.js](./nextjs)
- [Nuxt](./nuxt)
- [SvelteKit](./sveltekit)
- [Astro](./astro)

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
