---
title: "Preview"
description: "Set up live content preview so editors can see changes before publishing."
---

# Preview

Pages CMS supports live preview — editors see their content rendered in a panel as they type, without saving or publishing first.

Preview loads your site in an iframe and pushes field bindings over `postMessage` using the `pagescms-widget.js` bridge script.

## How it works

1. Editor opens an entry. Pages CMS builds a preview URL from `settings.site.url` and `content[].site.path`.
2. The CMS loads that URL in an iframe and sends `pagescms:preview:hello` until the site bridge is ready.
3. The widget bridge responds with `pagescms:preview:ready`.
4. As the editor types, the CMS sends binding updates (debounced 250ms):
   ```json
   {
     "type": "pagescms:preview:update",
     "bindings": [
       { "target": "#title", "bind": "text", "value": "Hello world" }
     ]
   }
   ```

If the bridge is not detected within 5 seconds, the CMS shows a warning to install `pagescms-widget.js` and check iframe embedding settings.

## Site script

Add `pagescms-widget.js` to your public site:

```html
<script
  src="https://your-cms.example/pagescms-widget.js"
  data-pagescms-origin="https://your-cms.example"
  data-pagescms-owner="org"
  data-pagescms-repo="repo"
  data-pagescms-branch="main"
></script>
```

| Attribute | Description |
| --- | --- |
| `data-pagescms-origin` | CMS base URL. Defaults to the script's origin. |
| `data-pagescms-owner` | GitHub owner for admin bar links. |
| `data-pagescms-repo` | Repository name. |
| `data-pagescms-branch` | Branch name (default: `main`). |

The script also provides an admin bar. Activate it with `?pagescms` or `#pagescms` in the URL, or call `window.PagesCMS.show()`.

### Admin bar edit links

For the admin bar to link back to the correct entry, add meta tags to your page:

```html
<meta name="pagescms:name" content="posts" />
<meta name="pagescms:type" content="collection" />
<meta name="pagescms:path" content="content/posts/my-post.md" />
```

For single files, use `pagescms:type` = `file` and omit `pagescms:path`.

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
| `settings.site.preview.defaultOpen` | Open the preview panel by default when editing (optional). |
| `content[].site.path` | Preview path template (`{{slug}}`, `{{filename}}`, `{{basename}}`, field names). |
| `fields[].preview` | DOM binding rules for live updates. |

### Path templates

`content[].site.path` is resolved against the current form values and entry file path:

| Token | Source |
| --- | --- |
| `{{slug}}` | `slug` field, or filename without extension |
| `{{filename}}` | Entry filename (e.g. `my-post.md`) |
| `{{basename}}` | Filename without extension |
| `{{fieldName}}` | Any field value from the entry |

## Field bindings

Each field can define one or more `preview` rules that map CMS values to DOM elements on the page.

```yaml
fields:
  - name: title
    type: string
    preview:
      target: "#title"
      bind: text
      transform:
        - { fallback: "Untitled" }
  - name: body
    type: rich-text
    preview:
      target: "#body"
      bind: html
  - name: published
    type: boolean
    preview:
      target: "#published"
      bind: checked
```

A field can also define multiple rules as an array:

```yaml
preview:
  - { target: "h1", bind: text }
  - { target: "meta[property='og:title']", bind: content }
```

### Bind types

| Bind | Effect |
| --- | --- |
| `text` | Sets `textContent` |
| `html` | Sets `innerHTML` (markdown fields are converted to HTML automatically) |
| `value` | Sets form element `value` |
| `src` | Sets image/media `src` |
| `href` | Sets link `href` |
| `checked` | Sets checkbox `checked` |
| `content` | Sets `content` attribute (e.g. meta tags) |

### Transforms

Apply transforms before the value is sent to the page:

```yaml
transform:
  - { join: ", " }           # join array values
  - { date: "MMMM d, yyyy" }  # format dates (date-fns tokens)
  - { text: capitalize }      # uppercase | lowercase | capitalize
  - { fallback: "Untitled" }  # use when value is empty
  - { prefix: "By " }
  - { suffix: " | My Site" }
```

### Repeated list bindings

When a field value is an array, the widget updates multiple DOM nodes:

- Use `{n}` in the selector to target indexed elements: `.tag-{n}` matches `.tag-1`, `.tag-2`, etc.
- Or use a shared selector — the widget clones the first matched node to match the array length.

```yaml
fields:
  - name: tags
    type: string
    list: true
    preview:
      target: ".tag-{n}"
      bind: text
```

## Iframe embedding

Your site must allow embedding in the CMS iframe. Remove or relax `X-Frame-Options` and `Content-Security-Policy` `frame-ancestors` restrictions for the CMS origin.

## Migration from the old preview API

Earlier versions used root-level `siteUrl` and `previewPath`, and sent bulk form data via `cms:preview` postMessage events. That protocol has been replaced.

| Old | New |
| --- | --- |
| `siteUrl` | `settings.site.url` |
| `previewPath` | `content[].site.path` |
| `cms:preview` / `cms:preview:ready` | `pagescms:preview:*` events via `pagescms-widget.js` |
| Custom `usePreviewData` hooks | `fields[].preview` DOM bindings (no site code required for basic cases) |

## Framework guides

Choose your framework:

- [Next.js](./nextjs)
- [Nuxt](./nuxt)
- [SvelteKit](./sveltekit)
- [Astro](./astro)

## Framework compatibility

Preview updates DOM elements directly via the widget bridge. No framework-specific hooks are required for basic bindings.

| Framework | Integration effort | Notes |
| --- | --- | --- |
| Next.js | Low | Add stable selectors to rendered markup |
| Nuxt | Low | Add stable selectors to templates |
| SvelteKit | Low | Add stable selectors to markup |
| Astro (static) | Low | Works on real pages — no separate preview route needed |
| Astro (with islands) | Low | Bind to static HTML elements outside islands |
| 11ty / Hugo / Jekyll | Low | Pure HTML sites work well with DOM bindings |
| Custom SPAs | Medium | Ensure selectors exist after hydration |

For pure static site generators, live preview works well because the widget updates existing DOM nodes without requiring a reactive runtime.
