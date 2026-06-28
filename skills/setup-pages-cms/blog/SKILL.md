---
name: setup-pages-cms-blog
description: >-
  PagesCMS setup sub-skill for blog sites — interview script and schema template
  for posts collections with title, date, author, tags, cover image, and rich-text
  body. Dispatch from setup-pages-cms when the project is a blog.
---

# Setup Pages CMS — Blog

Opinion layer for blog projects. Config **facts** live in
`content/docs/configuration/*.md` — read those for valid keys and field types.

## Detection signals

- Folders: `content/posts/`, `src/content/blog/`, `_posts/`, `posts/`
- Framework content collections named `posts` or `blog`
- RSS/feed routes, `/blog` in routing config

## Interview script

Ask in order. Skip only when the repo already makes the answer obvious.

### Site basics

1. **Site name** — used for labels (e.g. "Acme Blog")
2. **Posts folder** — default `content/posts`; confirm or override
3. **Post URL pattern** — e.g. `/blog/{slug}` (for optional `site.path` preview)
4. **Site URL** — deployed base URL for preview (`settings.site.url`)

### Post fields

5. **Title** — always include (`string`, primary field)
6. **Publish date** — include `date` field? (`date` type, used in `view.sort`)
7. **Author** — how to model?
   - **Single string** — `author` as `string`
   - **Reference** — separate `authors` collection + `reference` field (recommended for multi-author sites)
   - **None** — omit
8. **Tags** — include `tags` as `list` of `string`?
9. **Cover image** — include `cover` or `image` as `image` field?
10. **Excerpt** — short `text` summary for listings?
11. **Body** — `rich-text` (default) or `text` for markdown-only?
12. **Draft flag** — `boolean` `draft` field?
13. **SEO** — add `components.seo` object (title + description)? See `configuration/components.md`

### Authors collection (if reference model)

14. **Authors path** — default `content/authors`
15. **Author fields** — typically `name` (string), `bio` (text), `avatar` (image)

### Media

16. **Media folder** — default `media` or `public/images`
17. **Public URL prefix** — default `/media`

### Conventions

18. **Filename template** — default `{primary}.md` (slug from title)
19. **Frontmatter format** — default `yaml-frontmatter`
20. **List view** — which columns in collection list? (title, date, author)
21. **Default sort** — usually `-date` (newest first)
22. **Operations** — allow create/rename/delete? (default: all enabled)

Confirm the sample post structure matches how the site's build reads frontmatter.

## Schema template

Adapt paths and optional fields from interview answers. Validate before write.

```yaml
media:
  input: media
  output: /media can be overridden

settings:
  site:
    url: https://example.com  # from interview

content:
  - name: posts
    label: Blog posts
    type: collection
    path: content/posts
    format: yaml-frontmatter
    filename: "{primary}.md"
    site:
      path: /blog/{{slug}}  # optional preview
    view:
      primary: title
      fields: [title, date, author]
      sort: [date]
      default:
        sort: date
        order: desc
    fields:
      - name: title
        label: Title
        type: string
        required: true
      - name: date
        label: Publish date
        type: date
        required: true
      - name: author
        label: Author
        type: reference
        options:
          collection: authors
          value: name
          label: name
      - name: tags
        label: Tags
        type: string
        list: true
      - name: cover
        label: Cover image
        type: image
      - name: excerpt
        label: Excerpt
        type: text
      - name: body
        label: Body
        type: rich-text
        required: true

  - name: authors
    label: Authors
    type: collection
    path: content/authors
    format: yaml-frontmatter
    filename: "{primary}.md"
    view:
      primary: name
      fields: [name]
    fields:
      - name: name
        label: Name
        type: string
        required: true
      - name: bio
        label: Bio
        type: text
      - name: avatar
        label: Avatar
        type: image
```

### Simpler variant (string author, no authors collection)

Remove the `authors` collection and replace the `author` field with:

```yaml
      - name: author
        label: Author
        type: string
```

### Example post file

```yaml
---
title: Hello World
date: 2026-06-28
author: Jane Doe
tags:
  - announcement
cover: /media/hello-cover.webp
excerpt: Our first post.
draft: false
---

Welcome to the blog.
```

## Idiom notes

- Use `view.primary: title` so filenames slug from the title
- Put `date` in `view.sort` and `view.default.sort` for chronological lists
- For Astro/Next content collections, align `path` and frontmatter keys with
  existing loader schemas
- Use `reference` + `authors` collection when the same author appears on many posts
- Add `components.seo` when the site renders meta tags from frontmatter

Return the draft to the parent skill for validation, preview, and write.
