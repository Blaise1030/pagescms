# Markdown-driven docs

**Date:** 2026-06-23  
**Status:** Approved

## Goal

Replace the 4 hardcoded TSX doc pages with a file-based markdown system. Content lives in `.md` files under `content/docs/`. A single Next.js catch-all route renders any doc page dynamically. Adding a new doc page requires only dropping a markdown file — no code changes.

## Content structure

```
content/
  docs/
    index.md                        → /docs
    quick-start.md                  → /docs/quick-start
    configuration/
      index.md                      → /docs/configuration
      media.md                      → /docs/configuration/media
      content.md                    → /docs/configuration/content
      components.md                 → /docs/configuration/components
      settings.md                   → /docs/configuration/settings
      actions.md                    → /docs/configuration/actions
    deployment/
      cloudflare.md                 → /docs/deployment/cloudflare
```

Content sourced from https://pagescms.org/docs/ and adapted for this fork.

## Routing

Replace the 4 static page directories under `app/(marketing)/docs/` with a single:

```
app/(marketing)/docs/[[...slug]]/page.tsx
```

Slug resolution:
- No slug → reads `content/docs/index.md`
- `["quick-start"]` → reads `content/docs/quick-start.md`
- `["configuration"]` → reads `content/docs/configuration/index.md`
- `["configuration", "media"]` → reads `content/docs/configuration/media.md`

If the resolved file does not exist, `notFound()` is called.

Metadata (title, description) comes from YAML frontmatter in each `.md` file, parsed at render time.

## Rendering

```
react-markdown + remark-gfm
```

A `components` prop map passed to `<ReactMarkdown>` remaps elements to match existing visual conventions (headings, code blocks, links, tables). The `DocsContent` wrapper component is reused as the outer shell so the layout stays identical.

## Navigation

`lib/docs-navigation.ts` expanded to include all new pages:

- Introduction
- Quick start
- Configuration (group)
  - Overview
  - Media
  - Content
  - Components
  - Settings
  - Actions
- Deployment (group)
  - Cloudflare Workers

## Files changed

| Action | Path |
|--------|------|
| Delete | `app/(marketing)/docs/page.tsx` |
| Delete | `app/(marketing)/docs/quick-start/page.tsx` |
| Delete | `app/(marketing)/docs/configuration/page.tsx` |
| Delete | `app/(marketing)/docs/deployment/cloudflare/page.tsx` |
| Create | `app/(marketing)/docs/[[...slug]]/page.tsx` |
| Create | `content/docs/index.md` |
| Create | `content/docs/quick-start.md` |
| Create | `content/docs/configuration/index.md` |
| Create | `content/docs/configuration/media.md` |
| Create | `content/docs/configuration/content.md` |
| Create | `content/docs/configuration/components.md` |
| Create | `content/docs/configuration/settings.md` |
| Create | `content/docs/configuration/actions.md` |
| Create | `content/docs/deployment/cloudflare.md` |
| Update | `lib/docs-navigation.ts` |

## Dependencies

```
react-markdown
remark-gfm
```

No build config changes required. Both are pure JS packages.

## Out of scope

- MDX or React component embedding in markdown
- Search indexing
- Edit-on-GitHub links
- Pagination between pages
