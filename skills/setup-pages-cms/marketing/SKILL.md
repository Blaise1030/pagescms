---
name: setup-pages-cms-marketing
description: >-
  PagesCMS setup sub-skill for marketing and landing sites — file entries for
  hero, features block list, FAQ, and other single-file page sections. Dispatch
  from setup-pages-cms when the project is a marketing or landing site.
---

# Setup Pages CMS — Marketing

Opinion layer for marketing / landing sites. Most editable content is **`file`**
(single) entries — hero copy, feature lists, FAQ, pricing, footer CTA.

Config **facts** live in `content/docs/configuration/*.md` — read those for valid
keys, `object`/`block` field types, and `components`.

## Detection signals

- Folders: `content/pages/`, `src/data/`, `_data/`, `content/home/`
- Single JSON/YAML files for site copy (`hero.json`, `site.yaml`, `landing.yml`)
- Marketing frameworks with section-based content (no blog post archive)

## Interview script

### Site basics

1. **Site / product name**
2. **Site URL** — `settings.site.url` for preview
3. **Content storage** — JSON, YAML, or markdown frontmatter? (sets `format`)

### Sections to manage

Ask which sections editors should change without code deploys:

4. **Hero** — headline, subheadline, primary CTA (label + URL), background image?
5. **Features** — repeatable list (icon, title, description)?
6. **Social proof** — logos, testimonials, stats?
7. **Pricing** — tiers with price, features list, CTA?
8. **FAQ** — question/answer pairs?
9. **Footer / CTA banner** — closing call-to-action?
10. **SEO / meta** — global site title, description, OG image?

For each selected section, confirm **file path** (e.g. `content/hero.json`).

### Features block design

11. **Feature item fields** — icon (image or string), title, description, link?
12. **Max items** — any limit, or open-ended list?
13. **Reuse** — define a `components.feature` and reference it?

### FAQ design

14. **FAQ structure** — flat list or grouped by category?
15. **Answer format** — `text` or `rich-text`?

### Media

16. **Media folder** — hero images, logos (default `media`)
17. **Public URL prefix** — default `/media`

### Settings

18. **Merge mode** — `settings.content.merge: true` to preserve extra JSON keys?
19. **Preview paths** — per-section public URLs for live preview?

## Schema template

Marketing sites typically use multiple `file` entries under a `group`.

```yaml
media:
  input: media
  output: /media

settings:
  site:
    url: https://example.com
  content:
    merge: true

components:
  cta:
    type: object
    label: Call to action
    fields:
      - name: label
        type: string
      - name: url
        type: string

  feature:
    type: object
    label: Feature
    fields:
      - name: icon
        type: image
      - name: title
        type: string
        required: true
      - name: description
        type: text

content:
  - name: marketing
    label: Marketing
    type: group
    items:
      - name: hero
        label: Hero
        type: file
        path: content/hero.json
        format: json
        site:
          path: /
        fields:
          - name: headline
            label: Headline
            type: string
            required: true
          - name: subheadline
            label: Subheadline
            type: text
          - name: cta
            label: Primary CTA
            component: cta
          - name: image
            label: Hero image
            type: image

      - name: features
        label: Features
        type: file
        path: content/features.json
        format: json
        fields:
          - name: heading
            label: Section heading
            type: string
          - name: items
            label: Features
            type: block
            list: true
            blocks:
              - name: feature
                component: feature

      - name: faq
        label: FAQ
        type: file
        path: content/faq.json
        format: json
        fields:
          - name: heading
            label: Section heading
            type: string
          - name: items
            label: Questions
            type: object
            list: true
            fields:
              - name: question
                type: string
                required: true
              - name: answer
                type: rich-text
                required: true

      - name: site
        label: Site settings
        type: file
        path: content/site.json
        format: json
        fields:
          - name: title
            type: string
          - name: description
            type: text
          - name: url
            type: string
```

### Example `content/hero.json`

```json
{
  "headline": "Ship faster with PagesCMS",
  "subheadline": "Git-backed content editing for static sites.",
  "cta": {
    "label": "Get started",
    "url": "/docs/quick-start"
  },
  "image": "/media/hero.webp"
}
```

### Example `content/features.json`

```json
{
  "heading": "Why choose us",
  "items": [
    {
      "icon": "/media/icons/git.svg",
      "title": "Git-native",
      "description": "Every edit is a commit you can review."
    },
    {
      "icon": "/media/icons/schema.svg",
      "title": "Schema-driven",
      "description": "Structured fields, not a blank page."
    }
  ]
}
```

### Example `content/faq.json`

```json
{
  "heading": "Frequently asked questions",
  "items": [
    {
      "question": "Do I need a database?",
      "answer": "<p>No. Content lives in your repository.</p>"
    }
  ]
}
```

## Idiom notes

- Prefer **`type: file`** for singleton sections (hero, FAQ) — not collections
- Use **`type: block` with `list: true`** for repeatable feature rows; define
  block shape once in `components` or inline `blocks`
- Enable **`settings.content.merge: true`** when JSON files may contain keys
  outside the schema (common in generated sites)
- Use **`group`** to keep the CMS sidebar organized by page section
- Match `format` to what the site's data loader expects (`json`, `yaml`, etc.)
- For markdown-based landings, switch `format` to `yaml-frontmatter` and use
  `type: file` with a single markdown path per section

Return the draft to the parent skill for validation, preview, and write.
