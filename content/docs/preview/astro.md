---
title: "Preview — Astro"
description: "Set up live preview in an Astro site using a framework island."
---

# Preview with Astro

Astro renders pages as static HTML at build time. Because postMessage data arrives at runtime in the browser, a dedicated preview route with a client-side framework island is required to receive and render live updates.

## How it works

Astro's islands architecture lets you drop a React, Vue, or Svelte component into an otherwise static page. The preview route uses a `client:only` island that renders the page layout and subscribes to postMessage updates.

The real page (`/posts/[slug]`) stays fully static. The preview page (`/preview/[slug]`) is a separate route that loads the same layout component as a client island.

## Setup

### 1. Create a shared content component

This component handles rendering for both the real page and the preview. Here it uses React, but Vue or Svelte work the same way.

```tsx
// src/components/PostContent.tsx
import { useState, useEffect } from "react";
import { marked } from "marked"; // npm install marked

export interface PostData {
  title?: string;
  body?: string;
  bodyHtml?: string;
}

export function PostContent({ initialData }: { initialData?: PostData }) {
  const [data, setData] = useState<PostData | undefined>(initialData);

  useEffect(() => {
    if (window.parent === window) return;

    async function handler(e: MessageEvent) {
      if (e.data?.type !== "cms:preview") return;
      const raw = e.data.data;
      setData({
        ...raw,
        bodyHtml: raw.body ? await marked.parse(raw.body) : "",
      });
    }

    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <article>
      <h1>{data?.title ?? "Waiting for preview…"}</h1>
      <div dangerouslySetInnerHTML={{ __html: data?.bodyHtml ?? "" }} />
    </article>
  );
}
```

### 2. Create the preview route

```astro
---
// src/pages/preview/[slug].astro
import Layout from "@/layouts/Layout.astro";
import { PostContent } from "@/components/PostContent";

const { slug } = Astro.params;
---

<Layout>
  <PostContent client:only="react" />
</Layout>

<script is:inline>
  // Bridge postMessage from the CMS to a CustomEvent that the React island can receive.
  window.addEventListener("message", function (e) {
    if (e.data?.type !== "cms:preview") return;
    window.dispatchEvent(
      new CustomEvent("cms-preview-data", { detail: e.data.data })
    );
  });
</script>
```

### 3. Configure the preview URL

In `.pages.yml`, point `previewPath` to the preview route:

```yaml
object:
  siteUrl: https://yourdomain.com
  previewPath: /preview/{slug}
```

## Real page vs preview page

The real `/posts/[slug]` page remains a standard Astro page — fully static, no JS added:

```astro
---
// src/pages/posts/[slug].astro
import { getCollection } from "astro:content";
import Layout from "@/layouts/Layout.astro";

const { slug } = Astro.params;
const post = await getCollection("blog").then(entries =>
  entries.find(e => e.slug === slug)
);
const { Content } = await post.render();
---

<Layout>
  <h1>{post.data.title}</h1>
  <Content />
</Layout>
```

The preview page exists only for the CMS. Editors are pointed to `/preview/[slug]`; the real page is unaffected.

## Performance notes

Astro ships zero JS by default. Adding a `client:only` island to the preview route adds the React runtime and the component bundle to that route. Because the preview route is only ever loaded inside the CMS iframe, this has no impact on your real pages or your site's public performance metrics.
