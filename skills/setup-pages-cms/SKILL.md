---
name: setup-pages-cms
description: >-
  Interview-driven setup for PagesCMS — detect project type from the repo,
  run a type-specific sub-skill interview, generate a valid `.pages.yml`,
  validate with ConfigSchema, preview with the user, then write to the repo root.
  Use when setting up PagesCMS, authoring `.pages.yml`, or onboarding a static
  site to git-backed CMS editing.
---

# Setup Pages CMS

Part 1 of the AI-age CMS: configure `.pages.yml` through conversation. No backend
required — output is a validated file in the repo root.

## When to use

- User asks to set up PagesCMS, add a CMS, or create `.pages.yml`
- A static site needs editable content collections or single-file entries
- Project type is unclear but content folders exist (`content/posts`, `docs/`, etc.)

## Config knowledge (do not duplicate)

**Do not hand-copy the full config spec.** Read the authoritative docs:

| Topic | Path |
| --- | --- |
| Overview | `content/docs/configuration/index.md` |
| Content (collections, files, groups, view) | `content/docs/configuration/content.md` |
| Media | `content/docs/configuration/media.md` |
| Components | `content/docs/configuration/components.md` |
| Settings | `content/docs/configuration/settings.md` |
| Actions | `content/docs/configuration/actions.md` |

See also `skills/setup-pages-cms/references/README.md` for how agents should
consume these files. Optional machine-readable bundle: `public/llms.txt`
(generate with `pnpm run generate:llms-txt`).

## Workflow

### 1. Detect project type

Inspect the repo before asking. Signals (strongest first):

| Signal | Likely type |
| --- | --- |
| `content/posts/`, `src/content/blog/`, `_posts/` | **blog** |
| `docs/`, `content/docs/`, Docusaurus/VitePress/Starlight config | **docs** |
| `content/pages/`, landing sections, marketing copy folders | **marketing** |
| `content/projects/`, portfolio galleries | portfolio (not yet covered — ask user) |
| `CHANGELOG.md` + dated release notes | changelog (not yet covered — ask user) |

Also check `package.json` dependencies (`astro`, `next`, `@docusaurus/core`,
`vitepress`, `nuxt`, etc.) and README for site purpose.

If signals conflict or are weak, ask directly:

> What kind of site is this — blog, documentation, marketing/landing, or something else?

### 2. Dispatch to sub-skill

Read and follow **exactly one** sub-skill based on project type:

| Type | Sub-skill path |
| --- | --- |
| Blog | `skills/setup-pages-cms/blog/SKILL.md` |
| Docs | `skills/setup-pages-cms/docs/SKILL.md` |
| Marketing / landing | `skills/setup-pages-cms/marketing/SKILL.md` |

Each sub-skill provides an interview script, schema template, and idiom guidance.
The parent skill owns validation and write steps below.

### 3. Run the interview

Follow the sub-skill interview script. Capture:

- Site name and base URL (for `settings.site.url` if preview is wanted)
- Content paths that already exist vs paths to create
- Field list per collection/file
- Media folder conventions
- Filename patterns and allowed operations

Do not skip questions the sub-skill marks as required.

### 4. Generate draft `.pages.yml`

Map interview answers to config using sub-skill template + configuration docs.

Rules:

- Place `.pages.yml` at the **repository root**
- Define `media` before `content` (see `configuration/index.md` read order)
- Use field types and keys documented in `configuration/content.md` — do not invent keys
- Prefer existing repo paths over new ones when content already exists
- Keep names kebab-case, alphanumeric with dashes/underscores

### 5. Validate

Before showing the final preview or writing the file, validate the draft against
`ConfigSchema` using the helper (when available in this repo):

```bash
npx tsx lib/validate-pages-config.ts path/to/draft.pages.yml
```

Or pipe YAML on stdin:

```bash
cat draft.pages.yml | npx tsx lib/validate-pages-config.ts -
```

- **Exit 0** — config is valid; proceed to preview
- **Non-zero** — fix errors against `content/docs/configuration/*.md` and
  `lib/config-schema.ts`, then re-validate

If the validator is not yet present, parse heuristically from the docs and warn
the user that runtime validation happens when PagesCMS loads the config.

### 6. Preview (required before write)

Show the user:

1. **Structure summary** — collections, files, groups, media paths
2. **Field table** per entry — name, type, required/optional
3. **Sample entry** — realistic YAML/JSON frontmatter for one post/page/doc
4. **Full draft** — complete `.pages.yml` in a fenced code block

Ask explicitly:

> Does this match what you want to edit in PagesCMS? Any collections, fields, or paths to change?

Iterate until the user approves or requests specific edits. Re-validate after
each substantive change.

### 7. Write to repo

Only after user approval:

1. Write `.pages.yml` to the repository root
2. Re-run validation on the written file
3. Confirm path written and suggest next steps (connect repo in PagesCMS, add
   content files, run `pnpm run generate:llms-txt` if docs bundle is needed)

Do **not** commit unless the user asks. Do **not** push content (Part 2 / MCP).

## Error recovery

| Problem | Action |
| --- | --- |
| Validation fails on unknown field type | Look up type in configuration docs; check `getCodec` types in `lib/config-schema.ts` |
| Path already used differently in repo | Align `path` with existing folders or confirm migration with user |
| User wants multiple types (blog + docs) | Combine sub-skill outputs using `group` entries; read `configuration/content.md` |
| Existing `.pages.yml` | Read it first; merge or replace only with user consent |

## Related

- Design spec: `docs/superpowers/specs/2026-06-27-cms-setup-skill-design.md`
- AI overview: `content/docs/ai/index.md`
- Runtime schema: `lib/config-schema.ts` (`ConfigSchema`)
