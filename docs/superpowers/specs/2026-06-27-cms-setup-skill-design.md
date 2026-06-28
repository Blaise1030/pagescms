---
name: cms-setup-skill
description: Part 1 of the AI-age CMS — a set of Skills the vibe-coding agent runs to interview the user about their site, then author a valid .pages.yml schema (project-type-specialized), optionally preview it, and write it into the repo. No backend required.
metadata:
  type: project
---

# CMS Setup Skill — Interview-Driven Schema Authoring (Part 1)

## Goal

Give vibe-coding platforms (Lovable, Cursor, Claude, etc.) a **Skill** that
sets up this CMS for a project by *interviewing* the user — "what is this
site about? what content do you want to manage?" — and producing a correct,
idiomatic `.pages.yml` for their project, with an optional preview. The
right interview and the right schema differ by project type, so this is a
**family of skills**, one specialized skillset per project type.

This is **Part 1 of two** (see `2026-06-27-mcp-native-cms-design.md`):

- **Part 1 — this doc — *configure*.** A Skill authors the schema
  (`.pages.yml`). Runs once at setup and again when the model changes.
  **No backend** — it writes a file into the repo the vibe-coding tool
  already controls.
- **Part 2 — the MCP server — *populate*.** Lets Claude discover existing
  content and push content against that schema. Runs continuously.

Part 1 defines the **shape**; Part 2 fills it.

## Why a Skill (not an MCP tool)

Schema setup is a *conversation that ends in a file*, run inside the host
agent's environment, which already has repo/filesystem access. It needs no
running service, no auth handshake, no content API — just good interview
logic and deep knowledge of the config format. That is exactly what an Agent
Skill is. Packaging it as a Skill means any platform whose agent loads
skills can offer "set up a CMS" with zero infrastructure on our side.

## Why per-project-type skillsets

A single generic skill produces mediocre, generic schemas. Specialized
skills produce idiomatic ones because the interview questions, schema shape,
and field choices genuinely differ:

| Project type | Distinct schema shape |
|---|---|
| **Blog** | `posts` collection; title, date, author (reference), tags, rich-text body, cover image |
| **Docs** | nested tree layout, ordering/`view.sort`, sidebar grouping, code fields |
| **Marketing / landing** | mostly `file` (single) entries — hero, features, FAQ as `object`/`block` lists |
| **Portfolio** | `projects` collection; gallery (image list), links, dates |
| **Changelog** | dated entries, version field, categories |
| **Catalog / e-commerce-lite** | `products`; price (number), variants (block), images, SKU |
| **Knowledge base** | categories (group) + articles, references between entries |

Architecture: a **parent skill** (`setup-pages-cms`) that detects/asks the
project type and dispatches to a **sub-skill** per type. Each sub-skill
carries its own interview script + schema template + field guidance.

## The setup flow

1. **Detect or ask project type.** Infer from repo (framework, existing
   folders like `content/posts`, `docs/`) or ask directly.
2. **Run the interview** (sub-skill-specific). Establish: what the site is
   about, which content types exist, fields per type, single vs collection,
   media needs, filename/URL conventions, which operations to allow.
3. **Generate `.pages.yml`** mapping answers to the config format. Output
   **must validate** against `ConfigSchema` (`lib/config-schema.ts`).
4. **Preview (optional).** Show the resulting collections/fields and a
   sample entry; iterate with the user before writing.
5. **Write `.pages.yml`** into the repo root. Optionally scaffold runtime
   content-fetching code + TS types so the built site can render the content
   (this is the codegen previously mis-placed in the MCP server).

## Knowledge source: the documentation (single source of truth)

The skill **does not hand-duplicate the `.pages.yml` contract**. It sources
its config knowledge from the existing documentation in
`content/docs/configuration/` — which is already the authoritative,
maintained, human-facing spec for the format:

| Doc | Teaches |
| --- | --- |
| `configuration/content.md` | `collection` / `file` / `group`, `path`, `format`, `filename`, `view`, `subfolders`, `list`, `operations` |
| `configuration/media.md` | `media` (input/output paths, extensions, categories) |
| `configuration/components.md` | reusable `components` + `object`/`block` |
| `configuration/settings.md` | top-level `settings`, commit identity/templates |
| `configuration/actions.md` | `actions` / workflow triggers |
| `content.md` field table | the field types (`string`, `text`, `rich-text`, `number`, `boolean`, `date`, `select`, `image`, `file`, `reference`, `code`, `uuid`; structural `object`/`block`) |

Why source from docs rather than embed:

- **No drift.** Docs are maintained as the product evolves; the skill stays
  correct automatically instead of going stale against a hand-copied spec.
- **One place to change.** New field type or key → update the doc, the skill
  follows.
- **Reuses existing work.** These docs already exist and render on the docs
  site.

### How the skill consumes the docs

- **Primary:** bundle the `content/docs/configuration/*.md` files into the
  skill at build time (or reference them), so the skill teaches from the
  live contract.
- **Alternative:** fetch from the published docs site, ideally a
  machine-readable bundle (an `llms.txt` / concatenated docs export) so any
  host environment can pull the current spec. (This dovetails with the
  "content-out for AIs" idea — worth generating regardless.)
- **Backstop:** `ConfigSchema` (`lib/config-schema.ts`) remains the
  validation ground truth. Where the host can execute it, validate the draft
  before writing; otherwise the CMS rejects invalid config on load.

The per-project-type sub-skills add *opinion* (which collections/fields suit
a blog vs a catalog) on top of the docs' *facts* (what keys/types are
valid). Docs supply the grammar; sub-skills supply the idiom.

## Scope

- Parent skill `setup-pages-cms` (project-type detection + dispatch).
- Sub-skills: `blog`, `docs`, `marketing`, `portfolio`, `changelog`,
  `catalog`, `knowledge-base` (start with blog + docs + marketing).
- Each: `SKILL.md` (interview script + schema template + idiom guidance) —
  the *opinion* layer, kept thin.
- A shared **config-docs bundle** the sub-skills reference for the *facts*
  (sourced from `content/docs/configuration/*.md`), plus the pipeline that
  produces/refreshes it (bundle at build time, or publish a machine-readable
  docs export / `llms.txt`).
- Optional helper to emit/validate `.pages.yml` against `ConfigSchema`.
- Optional runtime scaffold per framework target (react-vite, next).

## Out of scope

- Pushing or editing content (that is Part 2 / MCP).
- A running backend or auth (Part 1 is file-output only).
- Editing `.pages.yml` programmatically post-setup via MCP (config stays a
  human-reviewed, skill-driven artifact).

## Supporting infra (shared with Part 2)

The optional runtime scaffold needs a way to read published content. That is
the **public read API** (`GET /api/public/.../content/...`) defined in the
umbrella spec — read-only, key-gated for private repos. It is the only
backend Part 1's *generated code* depends on; the skill itself needs none.

## Open questions

- Docs-as-source mechanism: bundle the markdown at skill build time vs fetch
  a published `llms.txt`/docs export at runtime. (Lean: publish a
  machine-readable docs export and bundle a snapshot for offline use.)
- Should we generate the docs export (`llms.txt`) now, since it benefits
  both the skill and the broader "content-out for AIs" goal?
- Skill distribution: published Agent Skills, an MCP "prompt"/skill served
  by the host, or both? (Lovable exposes chat connectors; confirm how it
  surfaces skills.)
- Does the skill also generate runtime fetch code, or stop at `.pages.yml`
  and hand off to the host agent to wire rendering?
- Validation in-environment: can the skill run the Zod `ConfigSchema` where
  it executes, or must it validate heuristically and rely on the CMS to
  reject bad config?
- How aggressively to infer project type vs always ask.
