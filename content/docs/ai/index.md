---
title: "AI & MCP"
description: "Use PagesCMS content with AI agents via MCP — setup skills, content service, and roadmap."
---

# AI & MCP

PagesCMS is evolving into an **AI-native, git-backed CMS**: structured content in your repository, validated against `.pages.yml`, and editable by humans or AI agents through the same pipeline.

The direction has two parts:

| Part | Role | Status |
| --- | --- | --- |
| **Setup Skill** | Interview-driven `.pages.yml` authoring for vibe-coding tools | **Available** — see `skills/setup-pages-cms/` |
| **MCP server** | Discover, read, and write content via the [Model Context Protocol](https://modelcontextprotocol.io/) | **Available** — `/api/mcp` with PAT auth |

Both parts share one idea: **git is the substrate**. AI edits land as commits (or pull requests), so every change is reviewable, revertable, and attributable.

## What ships today

### Setup Skill (Part 1)

Agent skills live in `skills/setup-pages-cms/`:

- Parent skill — project-type detection and dispatch
- Sub-skills — `blog`, `docs`, `marketing`
- Config reference — `content/docs/configuration/` (also exported as `public/llms.txt`)

Run `pnpm run generate:llms-txt` to refresh the machine-readable docs bundle. Validate drafts with `lib/validate-pages-config.ts` before writing `.pages.yml`.

### MCP server (Part 2)

- **Endpoint:** `POST /api/mcp` (Streamable HTTP)
- **Auth:** Create a token at [Settings → API tokens](/settings/api-tokens), then send `Authorization: Bearer cms_pat_…`
- **Tools:** `list_collections`, `get_entry_schema`, `list_entries`, `get_entry`, `write_entry`, `delete_entry`, `search_docs`, `get_doc`
- **Write mode:** `write_entry` and `delete_entry` default to `propose` (branch + PR). Pass `mode: "commit"` for direct commits.

The **content service** (`lib/content-service.ts`) is the shared core used by REST routes and MCP tools.

See [Content service](./content-service) for developer details.

## MCP connection

1. Open [Settings → API tokens](/settings/api-tokens) and create a token.
2. Configure your MCP client:

```json
{
  "mcpServers": {
    "pagescms": {
      "url": "https://your-pagescms-host/api/mcp",
      "headers": {
        "Authorization": "Bearer cms_pat_YOUR_TOKEN"
      }
    }
  }
}
```

3. Call `list_collections` with `owner`, `repo`, and `branch`, then `get_entry_schema` before writing content.

## Roadmap

- `search_content` — cross-collection search
- `rename_entry`, media upload, GitHub Actions tools
- OAuth 2.1 for one-click MCP client setup
- Additional setup sub-skills (portfolio, changelog, catalog)

## Why this matters

- **One integration, many platforms** — MCP is supported by Cursor, Claude Code/Desktop, and other AI builders; one server reaches all of them.
- **Schema as contract** — agents validate content against the same Zod schemas the UI uses.
- **Human in the loop** — propose mode opens a PR instead of committing directly; config stays human-owned.

## Related docs

- [Content service](./content-service) — the shared read core and REST adapters
- [Configuration](../configuration) — `.pages.yml` reference used by setup skills and agents
- [Quick start](../quick-start) — get a repository running with PagesCMS today
