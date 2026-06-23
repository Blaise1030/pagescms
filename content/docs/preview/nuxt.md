---
title: "Preview — Nuxt"
description: "Set up live preview in a Nuxt app using a usePreviewData composable."
---

# Preview with Nuxt

Nuxt renders pages server-side and hydrates them with Vue on the client. The integration is a single composable that wraps your server-fetched data and overrides it with postMessage updates when inside the CMS preview iframe.

## The pattern

Use `useAsyncData` to fetch on the server, then pass the result to `usePreviewData`. The composable returns a reactive ref — your template updates automatically when the CMS sends new data.

```vue
<!-- pages/posts/[slug].vue -->
<script setup>
import { usePreviewData } from "~/composables/usePreviewData";

const route = useRoute();
const { data: initialData } = await useAsyncData(() =>
  $fetch(`/api/posts/${route.params.slug}`)
);

const post = usePreviewData(initialData);
</script>

<template>
  <article>
    <h1>{{ post.title }}</h1>
    <div v-html="post.bodyHtml" />
  </article>
</template>
```

## usePreviewData composable

Create this composable once in your project:

```ts
// composables/usePreviewData.ts
import { ref, watch, type Ref } from "vue";

export function usePreviewData<T>(initialData: Ref<T | null>): Ref<T | null> {
  const data = ref(initialData.value);

  watch(initialData, (val) => {
    data.value = val;
  });

  if (import.meta.client) {
    window.addEventListener("message", (e) => {
      if (e.data?.type === "cms:preview") data.value = e.data.data;
    });
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
  }

  return data as Ref<T | null>;
}
```

The `import.meta.client` guard ensures the postMessage listener is never included in the server bundle.

## Handling markdown body

If your content has a markdown `body` field, parse it client-side when in preview mode:

```ts
// composables/usePreviewData.ts
import { ref, watch, type Ref } from "vue";
import { marked } from "marked"; // npm install marked

export function usePreviewData<T extends { body?: string; bodyHtml?: string }>(
  initialData: Ref<T | null>
): Ref<T | null> {
  const data = ref(initialData.value);

  watch(initialData, (val) => {
    data.value = val;
  });

  if (import.meta.client) {
    window.addEventListener("message", async (e) => {
      if (e.data?.type !== "cms:preview") return;
      const raw = e.data.data;
      data.value = {
        ...raw,
        bodyHtml: raw.body ? await marked.parse(raw.body) : "",
      };
    });
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
  }

  return data as Ref<T | null>;
}
```

## Performance notes

- Nuxt still server-renders the page to HTML — first paint and LCP are unaffected.
- Vue runtime is already shipped to the browser by Nuxt, so there is no extra bundle cost for adding this composable.
- The `import.meta.client` guard tree-shakes the postMessage code from the server bundle.
