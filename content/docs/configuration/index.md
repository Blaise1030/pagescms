---
title: "Configuration"
description: "`.pages.yml` is the single source of truth for PagesCMS configuration."
---

## What `.pages.yml` does

Place `.pages.yml` at the repository root. PagesCMS reads it per repository and per branch.

## Top-level keys

| Key | Description |
| --- | --- |
| `media` | Defines where uploaded files are stored and what URLs are written. |
| `content` | Defines editable collections and single files. |
| `components` | Reuses shared field definitions across collections. |
| `settings` | Sets repository-wide behavior such as merge mode and commit templates. |
| `actions` | Adds repository-level GitHub Actions buttons. |

## Read order

1. Define `media`.
2. Define `content`.
3. Add `components` if fields repeat.
4. Add `settings` if you need global behavior.
5. Add `actions` if you want custom workflow buttons.

## Minimal example

```yaml
media: media
content:
  - name: posts
    label: Posts
    type: collection
    path: content/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
```

## Example with a collection and a single file

```yaml
media:
  input: src/media
  output: /media
content:
  - name: posts
    label: Posts
    type: collection
    path: src/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
  - name: site
    label: Site settings
    type: file
    path: src/_data/site.json
    fields:
      - name: title
        type: string
      - name: description
        type: text
      - name: url
        type: string
actions:
  - name: deploy-site
    label: Deploy site
    workflow: pages-cms-action.yml
```
