---
title: "Preview — Nuxt"
description: "Set up live preview in a Nuxt app using the Pages CMS widget bridge."
---

# Preview with Nuxt

Nuxt pages can be previewed directly in the CMS iframe. Install the widget script, configure bindings in `.pages.yml`, and add stable DOM selectors to your templates.

No custom composables are required for basic field bindings.

## Setup

### 1. Install the widget script

Add the script to `app.vue` or your default layout:

```vue
<!-- app.vue -->
<template>
  <NuxtPage />
</template>

<script setup>
useHead({
  script: [
    {
      src: "https://your-cms.example/pagescms-widget.js",
      "data-pagescms-origin": "https://your-cms.example",
      "data-pagescms-owner": "org",
      "data-pagescms-repo": "repo",
      "data-pagescms-branch": "main",
    },
  ],
});
</script>
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

```vue
<!-- pages/blog/[slug].vue -->
<script setup>
const route = useRoute();
const { data: post } = await useAsyncData(() =>
  $fetch(`/api/posts/${route.params.slug}`)
);
</script>

<template>
  <article>
    <h1 id="post-title">{{ post.title }}</h1>
    <div id="post-body" v-html="post.bodyHtml" />
  </article>
</template>
```

The server renders the saved content. When the page loads inside the CMS preview iframe, the widget updates the bound elements as the editor types.

## How it works

1. Pages CMS builds a URL like `https://yourdomain.com/blog/my-post` from `settings.site.url` and `content[].site.path`.
2. The page loads in the preview iframe with `pagescms-widget.js`.
3. The widget receives binding updates and updates `#post-title`, `#post-body`, etc. directly.

Because bindings target DOM nodes rather than Vue reactivity, the preview works without composables or `postMessage` listeners in your app code.

## Tips

- Use `id` attributes for unique elements and classes for repeated list items.
- For markdown `body` fields, use `bind: html` — the CMS converts markdown to HTML before sending.
- The widget is a no-op on public pages outside the CMS iframe.

## Performance notes

- Nuxt still server-renders the page to HTML — first paint and LCP are unaffected.
- The widget script is small and only applies DOM updates when inside the CMS iframe.
- No extra client-side composables are needed for basic preview bindings.
