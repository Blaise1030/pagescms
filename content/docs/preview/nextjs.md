---
title: "Preview — Next.js"
description: "Set up live preview in a Next.js app using the Pages CMS widget bridge."
---

# Preview with Next.js

Next.js pages can be previewed directly in the CMS iframe. Install the widget script, configure bindings in `.pages.yml`, and add stable DOM selectors to your page markup.

No custom React hooks are required for basic field bindings.

## Setup

### 1. Install the widget script

Add the script to your root layout:

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <script
          src="https://your-cms.example/pagescms-widget.js"
          data-pagescms-origin="https://your-cms.example"
          data-pagescms-owner="org"
          data-pagescms-repo="repo"
          data-pagescms-branch="main"
        />
      </body>
    </html>
  );
}
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

Add `id` or `class` attributes that match your binding targets:

```tsx
// app/blog/[slug]/page.tsx
import { getPost } from "@/lib/posts";

export default async function PostPage({ params }) {
  const post = await getPost(params.slug);

  return (
    <article>
      <h1 id="post-title">{post.title}</h1>
      <div id="post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
    </article>
  );
}
```

The server component renders the saved content. When the page loads inside the CMS preview iframe, the widget updates the bound elements as the editor types.

## How it works

1. Pages CMS builds a URL like `https://yourdomain.com/blog/my-post` from `settings.site.url` and `content[].site.path`.
2. The page loads in the preview iframe with `pagescms-widget.js`.
3. The widget receives binding updates and updates `#post-title`, `#post-body`, etc. directly.

Because bindings target DOM nodes rather than React state, the preview works without client components or `postMessage` listeners in your app code.

## Tips

- Use `id` attributes for unique elements and classes for repeated list items.
- For markdown `body` fields, use `bind: html` — the CMS converts markdown to HTML before sending.
- Keep selectors on the narrowest element that should update (e.g. `#post-title` on the `<h1>`, not the whole `<article>`).
- The widget is a no-op on public pages outside the CMS iframe.

## Performance notes

- Server components still render to HTML — first paint and LCP are unaffected.
- The widget script is small and only applies DOM updates when inside the CMS iframe.
- No extra React client components are needed for basic preview bindings.
