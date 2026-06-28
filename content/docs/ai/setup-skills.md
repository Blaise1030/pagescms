---
title: "Setup skills"
description: "Agent skills for interview-driven .pages.yml authoring — blog, docs, and marketing site templates."
---

# Setup skills

Part 1 of the AI-age CMS ships as **Agent Skills** in `skills/setup-pages-cms/`. No backend is required — the host agent interviews the user and writes `.pages.yml` into the repository.

## Parent skill

Read `skills/setup-pages-cms/SKILL.md` first. It:

1. Detects project type from the repo (framework, existing content folders)
2. Dispatches to a specialized sub-skill
3. Points to `content/docs/configuration/` for the config contract
4. Validates output with `lib/validate-pages-config.ts`
5. Previews the schema with the user before writing `.pages.yml`

## Sub-skills

| Skill | Path | Best for |
| --- | --- | --- |
| Blog | `skills/setup-pages-cms/blog/SKILL.md` | Posts, authors, tags, cover images |
| Docs | `skills/setup-pages-cms/docs/SKILL.md` | Nested docs tree, sidebar groups, code fields |
| Marketing | `skills/setup-pages-cms/marketing/SKILL.md` | Hero, features blocks, FAQ file entries |

## Config reference

- Human docs: [Configuration](../configuration)
- Machine bundle: `public/llms.txt` (regenerate with `pnpm run generate:llms-txt`)
- Validation: `validatePagesConfig()` in `lib/validate-pages-config.ts`

## Usage in Cursor

Copy or symlink `skills/setup-pages-cms/` into your project's `.cursor/skills/` directory, or reference the skill from this repository when setting up a new site.

After the schema is written, connect the [MCP server](./index) to populate content.
