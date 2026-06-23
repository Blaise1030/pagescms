---
title: "Preview — SvelteKit"
description: "Set up live preview in a SvelteKit app using a writable store."
---

# Preview with SvelteKit

SvelteKit loads data server-side via `load` functions and hydrates with Svelte on the client. A writable store bridges the postMessage events to your component's reactive state.

## The pattern

Load data in `+page.server.ts`, pass it to `+page.svelte`, then pipe it through `usePreviewData` which returns a reactive store. The component re-renders automatically when the CMS sends new data.

```ts
// +page.server.ts
export async function load({ params }) {
  const post = await getPost(params.slug);
  return { post };
}
```

```svelte
<!-- +page.svelte -->
<script>
  import { usePreviewData } from "$lib/usePreviewData";

  export let data;
  const post = usePreviewData(data.post);
</script>

<article>
  <h1>{$post.title}</h1>
  <div>{@html $post.bodyHtml}</div>
</article>
```

## usePreviewData store

Create this utility once in your project:

```ts
// lib/usePreviewData.ts
import { writable } from "svelte/store";
import { browser } from "$app/environment";

export function usePreviewData<T>(initialData: T) {
  const store = writable(initialData);

  if (browser) {
    window.addEventListener("message", (e) => {
      if (e.data?.type === "cms:preview") store.set(e.data.data);
    });
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
  }

  return store;
}
```

The `browser` check from `$app/environment` ensures the listener is never registered on the server.

## Handling markdown body

If your content has a markdown `body` field, parse it client-side when in preview mode:

```ts
// lib/usePreviewData.ts
import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { marked } from "marked"; // npm install marked

export function usePreviewData<T extends { body?: string; bodyHtml?: string }>(
  initialData: T
) {
  const store = writable(initialData);

  if (browser) {
    window.addEventListener("message", async (e) => {
      if (e.data?.type !== "cms:preview") return;
      const raw = e.data.data;
      store.set({
        ...raw,
        bodyHtml: raw.body ? await marked.parse(raw.body) : "",
      });
    });
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
  }

  return store;
}
```

## Performance notes

- SvelteKit still server-renders the page to HTML — first paint and LCP are unaffected.
- Svelte's runtime is already present on the client, so there is no extra bundle cost.
- The `browser` guard ensures no postMessage code runs or ships in the server bundle.
