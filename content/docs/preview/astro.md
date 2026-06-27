---
title: "Preview — Astro"
description: "Set up live preview in an Astro site using the Pages CMS widget bridge."
---

# Preview with Astro

Astro sites work well with the widget bridge because pages are rendered as HTML with stable DOM nodes. Install the widget script, configure bindings in `.pages.yml`, and add selectors to your templates.

Unlike the previous preview approach, you do not need a separate `/preview/[slug]` route or a client-side framework island for basic bindings.

## Setup

### 1. Install the widget script

Add the script to your base layout:

```astro
---
// src/layouts/Layout.astro
---
<html>
  <body>
    <slot />
    <script
      src="https://your-cms.example/pagescms-widget.js"
      data-pagescms-origin="https://your-cms.example"
      data-pagescms-owner="org"
      data-pagescms-repo="repo"
      data-pagescms-branch="main"
    ></script>
  </body>
</html>
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

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from "astro:content";
import Layout from "@/layouts/Layout.astro";

const { slug } = Astro.params;
const post = await getCollection("blog").then((entries) =>
  entries.find((e) => e.slug === slug)
);
const { Content } = await post.render();
---

<Layout>
  <article>
    <h1 id="post-title">{post.data.title}</h1>
    <div id="post-body">
      <Content />
    </div>
  </article>
</Layout>
```

The page is fully static. When it loads inside the CMS preview iframe, the widget updates the bound elements as the editor types.

## How it works

1. Pages CMS builds a URL like `https://yourdomain.com/blog/my-post` from `settings.site.url` and `content[].site.path`.
2. The real page loads in the preview iframe — no separate preview route is needed.
3. The widget receives binding updates and updates `#post-title`, `#post-body`, etc. directly.

## Astro with islands

If your content area is a client island (React, Vue, Svelte), place binding targets on static HTML elements outside the island, or ensure the island renders elements with stable selectors on first paint.

For example, bind to a static wrapper rather than content inside a `client:only` island:

```astro
<article>
  <h1 id="post-title">{post.data.title}</h1>
  <div id="post-body">
    <PostContent client:load post={post} />
  </div>
</article>
```

## Tips

- Astro's zero-JS default is ideal for preview — the widget updates existing DOM nodes without hydration.
- For markdown `body` fields, use `bind: html` — the CMS converts markdown to HTML before sending.
- Add `pagescms:*` meta tags if you want the admin bar to link back to the entry (see the [Preview overview](./index#admin-bar-edit-links)).

## Performance notes

- The real page stays fully static — no extra JS is added for preview on public pages.
- The widget script is the only addition, and DOM updates only run inside the CMS iframe.
