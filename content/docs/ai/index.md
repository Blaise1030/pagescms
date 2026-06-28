---
title: "AI & MCP"
description: "Use PagesCMS content with AI agents via MCP — setup skills, content service, and roadmap."
---

# AI & MCP

PagesCMS is evolving into an **AI-native, git-backed CMS**: structured content in your repository, validated against `.pages.yml`, and editable by humans or AI agents through the same pipeline.

The direction has two parts:

| Part | Role | Status |
| --- | --- | --- |
| **Setup Skill** | Interview-driven `.pages.yml` authoring for vibe-coding tools | Planned |
| **MCP server** | Discover, read, and write content via the [Model Context Protocol](https://modelcontextprotocol.io/) | In progress |

Both parts share one idea: **git is the substrate**. AI edits land as commits (or pull requests), so every change is reviewable, revertable, and attributable.

## What ships today

This repository now includes a **content service** — a framework-agnostic core extracted from the REST API routes. It is the foundation the MCP server will call into.

Read operations are implemented today:

- `listCollections` — summarize content entries from `.pages.yml`
- `getEntrySchema` — JSON Schema + field list for a collection
- `listEntries` — collection listing with search
- `getEntry` / `getRawEntry` — fetch and parse a single file

REST routes for entries and collections already delegate to this service. Write operations (`writeEntry`, `deleteEntry`, propose-via-PR mode) and the MCP endpoint are next.

See [Content service](./content-service) for developer details.

## Setup Skill (planned)

A family of Agent Skills (`setup-pages-cms` + per-project-type sub-skills) will interview you about your site and produce a valid `.pages.yml`:

- Detect or ask project type (blog, docs, marketing site, portfolio, …)
- Run a type-specific interview (collections, fields, media, operations)
- Validate against the same schema the CMS uses at runtime
- Write `.pages.yml` into the repo — no backend required

Skills source the config contract from the [Configuration](../configuration) docs so guidance stays in sync with the product.

## MCP server (planned)

The MCP server exposes repo content to Claude, Cursor, and other MCP clients:

| Tool group | Examples |
| --- | --- |
| Discover | `list_collections`, `get_entry_schema` |
| Read | `list_entries`, `get_entry`, `search_content` |
| Write | `write_entry`, `delete_entry`, `rename_entry` (`commit` or `propose` PR mode) |
| Docs | `search_docs`, `get_doc` — sourced from this documentation |

Authentication will start with scoped API tokens (PAT), with OAuth 2.1 for one-click client setup later. Agent access never exceeds the connecting user's GitHub permissions.

## Why this matters

- **One integration, many platforms** — MCP is supported by Cursor, Claude Code/Desktop, and other AI builders; one server reaches all of them.
- **Schema as contract** — agents validate content against the same Zod schemas the UI uses.
- **Human in the loop** — propose mode opens a PR instead of committing directly; config stays human-owned.

## Related docs

- [Content service](./content-service) — the shared read core and REST adapters
- [Configuration](../configuration) — `.pages.yml` reference used by setup skills and agents
- [Quick start](../quick-start) — get a repository running with PagesCMS today
