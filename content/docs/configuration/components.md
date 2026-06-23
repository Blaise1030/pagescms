---
title: "Components"
description: "Reuse shared field definitions across multiple collections."
---

## What `components` does

Use `components` when the same field group appears in multiple places.

Typical examples:

- SEO fields,
- author objects,
- call-to-action blocks,
- repeated metadata groups.

Define the field group once, then reference it from `content`.

## Example

```yaml
components:
  seo:
    type: object
    label: SEO
    fields:
      - name: title
        type: string
      - name: description
        type: text

content:
  - name: pages
    type: collection
    path: content/pages
    fields:
      - name: heading
        type: string
      - name: seo
        component: seo
        label: Meta
```

## Override behavior

When you reference a component, field-level values can override component values.

In the example above the component label is `SEO`, but the field overrides it to `Meta`. The resolved field behaves as:

```yaml
- name: seo
  type: object
  label: Meta
  fields:
    - name: title
      type: string
    - name: description
      type: text
```
