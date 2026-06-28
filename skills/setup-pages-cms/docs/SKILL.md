---
name: setup-pages-cms-docs
description: >-
  PagesCMS setup sub-skill for documentation sites — nested docs tree, view.sort,
  code fields, sidebar groups, and subfolder collections. Dispatch from
  setup-pages-cms when the project is a docs site.
---

# Setup Pages CMS — Docs

Opinion layer for documentation sites. Config **facts** live in
`content/docs/configuration/*.md` — read those for valid keys and field types.

## Detection signals

- Folders: `docs/`, `content/docs/`, `src/content/docs/`
- Config: `docusaurus.config.*`, `vitepress`, `.vitepress/`, Starlight (`astro`)
- Nested markdown with `_meta.json`, `_category_.json`, or sidebar config files

## Interview script

### Site basics

1. **Site name** — e.g. "Project Docs"
2. **Docs root folder** — default `content/docs` or `docs`
3. **Site URL** — for preview (`settings.site.url`)
4. **Doc URL pattern** — e.g. `/docs/{{slug}}` or nested paths

### Structure

5. **Nested folders** — enable `subfolders: true`? (almost always yes for docs)
6. **Tree vs list** — use `view.layout: tree` for sidebar-style navigation?
7. **Index pages** — filename for section indexes (`index.md`, `README.md`)?
8. **Exclude files** — e.g. `["_index.md"]` or files not meant for CMS editing

### Page fields

9. **Title** — `string`, primary field
10. **Description** — short `text` for SEO/sidebar?
11. **Order / weight** — numeric `order` field for manual sort?
12. **Body** — `rich-text` or plain markdown via `text`?
13. **Code samples** — separate `code` fields or code blocks inside body?
14. **Last updated** — `date` field?
15. **Draft / hidden** — `boolean` `draft` or `hidden` field?

### Navigation (sidebar groups)

16. **Sidebar groups** — organize CMS sidebar with `group` entries?
    - Example groups: "Getting started", "Guides", "API reference"
17. **Multiple collections** — split by top-level folder (e.g. `guides` vs `api`) or one tree collection?

### List / sort behavior

18. **Default sort** — by `order` ascending, or by title, or by path?
19. **Search fields** — which fields are searchable in list view? (title, description)
20. **Primary display** — field shown as entry label (usually `title`)

### Media & code

21. **Media folder** — for diagrams/screenshots (default `media`)
22. **Code field language** — default language for standalone `code` fields?

### Conventions

23. **Frontmatter format** — default `yaml-frontmatter`
24. **Operations** — allow create/rename/delete in nested folders?

## Schema template

### Single nested tree collection

Best when all docs live under one root with subfolders.

```yaml
media:
  input: media
  output: /media

settings:
  site:
    url: https://example.com

content:
  - name: docs
    label: Documentation
    type: collection
    path: content/docs
    format: yaml-frontmatter
    filename: index.md
    subfolders: true
    exclude: [README.md]
    site:
      path: /docs/{{slug}}
    view:
      layout: tree
      primary: title
      fields: [title, order]
      sort: [order, title]
      search: [title, description]
      default:
        sort: order
        order: asc
    fields:
      - name: title
        label: Title
        type: string
        required: true
      - name: description
        label: Description
        type: text
      - name: order
        label: Order
        type: number
      - name: body
        label: Content
        type: rich-text
        required: true
```

### With sidebar groups

Use when the CMS sidebar should mirror major sections. Groups are navigation-only
(see `configuration/content.md`).

```yaml
content:
  - name: documentation
    label: Documentation
    type: group
    items:
      - name: getting-started
        label: Getting started
        type: collection
        path: content/docs/getting-started
        format: yaml-frontmatter
        filename: index.md
        subfolders: true
        view:
          layout: tree
          primary: title
          sort: [order]
        fields:
          - name: title
            type: string
            required: true
          - name: order
            type: number
          - name: body
            type: rich-text

      - name: guides
        label: Guides
        type: collection
        path: content/docs/guides
        format: yaml-frontmatter
        filename: index.md
        subfolders: true
        view:
          layout: tree
          primary: title
          sort: [order]
        fields:
          - name: title
            type: string
            required: true
          - name: order
            type: number
          - name: body
            type: rich-text

      - name: api
        label: API reference
        type: collection
        path: content/docs/api
        format: code
        subfolders: true
        view:
          layout: tree
          primary: title
        fields:
          - name: title
            type: string
            required: true
          - name: body
            type: code
            options:
              language: typescript
```

### Standalone code snippet collection

When API examples are separate files:

```yaml
  - name: examples
    label: Code examples
    type: collection
    path: content/examples
    format: code
    filename: "{primary}.{extension}"
    fields:
      - name: title
        type: string
        required: true
      - name: body
        type: code
        options:
          language: javascript
```

### Example doc page

```yaml
---
title: Quick start
description: Install and run the project locally.
order: 1
---

Follow these steps to get started.
```

## Idiom notes

- Enable `subfolders: true` for hierarchical docs; pair with `view.layout: tree`
- Use `view.sort` and `view.default` together so list/tree order is predictable
- Put `order` (number) in `view.sort` when manual sidebar ordering matters
- Use `format: code` + `type: code` for raw code reference pages, not prose docs
- Use `group` + `items` to mirror sidebar sections without changing file layout
- Match `filename` to existing conventions (`index.md` vs `{primary}.md`)
- For VitePress/Docusaurus, align paths with existing content dirs before moving files

Return the draft to the parent skill for validation, preview, and write.
