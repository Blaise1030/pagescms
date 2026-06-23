---
title: "Preview — Next.js"
description: "Set up live preview in a Next.js app using the usePreviewData hook."
---

# Preview with Next.js

Next.js renders pages server-side and hydrates them on the client. Client components can react to `postMessage` updates directly, so the preview integration requires minimal changes to your existing page structure.

## The pattern

Make your content component a client component. Pass server-fetched data as `initialData`. The `usePreviewData` hook returns the server data normally, and switches to postMessage data when the page is loaded inside the CMS preview iframe.

```tsx
// components/post-content.tsx
"use client";

import { usePreviewData } from "@/hooks/use-preview-data";

export function PostContent({ initialData }) {
  const data = usePreviewData(initialData);

  return (
    <article>
      <h1>{data.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
    </article>
  );
}
```

```tsx
// app/posts/[slug]/page.tsx
import { getPost } from "@/lib/posts";
import { PostContent } from "@/components/post-content";

export default async function PostPage({ params }) {
  const post = await getPost(params.slug);
  return <PostContent initialData={post} />;
}
```

The server component fetches and renders. The client component hydrates and can receive live updates.

## usePreviewData hook

Create this hook once in your project:

```ts
// hooks/use-preview-data.ts
"use client";

import { useState, useEffect } from "react";

export function usePreviewData<T>(initialData: T): T {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    if (window.parent === window) return; // not in an iframe

    function handler(e: MessageEvent) {
      if (e.data?.type === "cms:preview") setData(e.data.data);
    }

    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");

    return () => window.removeEventListener("message", handler);
  }, []);

  return data;
}
```

## Handling markdown body

If your content has a markdown `body` field, the CMS sends raw markdown. You need to parse it on the client when in preview mode:

```ts
import { useEffect, useState } from "react";
import { marked } from "marked"; // npm install marked

export function usePreviewData<T extends { body?: string; bodyHtml?: string }>(
  initialData: T
): T {
  const [data, setData] = useState(initialData);

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

  return data;
}
```

## Performance notes

- Next.js still server-renders client components to HTML — first paint and LCP are unaffected.
- The extra cost is hydration and the component JS bundle sent to the browser.
- Keep the client component scope narrow: wrap only the content area, not the full layout.
- The `window.parent === window` guard means the postMessage listener is a no-op on real pages outside the CMS iframe.
