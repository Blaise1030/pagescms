---
title: "Preview — SvelteKit"
description: "Set up live preview in a SvelteKit app using the Pages CMS widget bridge."
---

# Preview with SvelteKit

SvelteKit pages can be previewed directly in the CMS iframe. Install the widget script, configure bindings in `.pages.yml`, and add stable DOM selectors to your markup.

No custom stores or `postMessage` listeners are required for basic field bindings.

## Setup

### 1. Install the widget script

Add the script to `src/app.html`:

```html
<!-- src/app.html -->
<body data-sveltekit-preload-data="hover">
  <div style="display: contents">%sveltekit.body%</div>
  <script
    src="https://your-cms.example/pagescms-widget.js"
    data-pagescms-origin="https://your-cms.example"
    data-pagescms-owner="org"
    data-pagescms-repo="repo"
    data-pagescms-branch="main"
  ></script>
</body>
```

### 2. Configure preview in `.pages.yml`

```yaml
settings:
  site:
    url: https://yourdomain.com
content:
  - name: posts
    type: collection
    path: content/posts
    site:
      path: /blog/{{slug}}
    fields:
      - name: title
        type: string
        preview:
          target: "#post-title"
          bind: text
      - name: body
        type: rich-text
        preview:
          target: "#post-body"
          bind: html
```

### 3. Add selectors to your page

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  export let data;
</script>

<article>
  <h1 id="post-title">{data.post.title}</h1>
  <div id="post-body">{@html data.post.bodyHtml}</div>
</article>
```

```ts
// src/routes/blog/[slug]/+page.server.ts
export async function load({ params }) {
  const post = await getPost(params.slug);
  return { post };
}
```

The server renders the saved content. When the page loads inside the CMS preview iframe, the widget updates the bound elements as the editor types.

## How it works

1. Pages CMS builds a URL like `https://yourdomain.com/blog/my-post` from `settings.site.url` and `content[].site.path`.
2. The page loads in the preview iframe with `pagescms-widget.js`.
3. The widget receives binding updates and updates `#post-title`, `#post-body`, etc. directly.

Because bindings target DOM nodes rather than Svelte stores, the preview works without client-side bridge code in your app.

## Tips

- Use `id` attributes for unique elements and classes for repeated list items.
- For markdown `body` fields, use `bind: html` — the CMS converts markdown to HTML before sending.
- The widget is a no-op on public pages outside the CMS iframe.

## Performance notes

- SvelteKit still server-renders the page to HTML — first paint and LCP are unaffected.
- The widget script is small and only applies DOM updates when inside the CMS iframe.
- No extra client-side stores are needed for basic preview bindings.
