# PagesCMS — MCP Server Roadmap

> Dated: 2026-06-28  
> Stack: Next.js · Cloudflare Workers · D1 · GitHub via Octokit

---

## Vision

PagesCMS becomes an **MCP server**. No AI is embedded in the product. Instead, users connect their PagesCMS instance to Claude (Desktop, Code, or any MCP-compatible client) and automate their entire content pipeline through conversation.

Example workflows users get for free:
- *"Draft a new blog post about our Q3 launch, schedule it for Friday, and add it to the newsletter collection."*
- *"Find all unpublished drafts older than 30 days and give me a summary of each."*
- *"Rename the slug on every post tagged 'legacy' and republish them."*
- *"Pull the pricing page, rewrite the hero copy, and open a GitHub PR for review."*

PagesCMS provides the **tools**. Claude provides the **intelligence**.

---

## What needs to be built

### 1 — MCP Server endpoint

Implement the [Model Context Protocol](https://modelcontextprotocol.io) server spec as a Cloudflare Worker route.

**Transport:** HTTP with Server-Sent Events (SSE) — works in any MCP client without WebSocket complexity.

**Route:** `GET /mcp` (capability negotiation) + `POST /mcp` (tool calls)

**Auth:** Bearer token — user generates a scoped API key in settings, pastes it into their MCP client config.

---

### 2 — Tools to expose

These map directly to what PagesCMS already does:

| Tool | Description |
|------|-------------|
| `list_collections` | Return all collection definitions from the workspace config |
| `get_schema` | Return the field schema for a given collection |
| `list_content` | List entries in a collection (with pagination, status filter) |
| `get_content` | Fetch a single entry by path — returns raw Markdown + frontmatter |
| `create_content` | Create a new entry (writes to GitHub via Octokit) |
| `update_content` | Update an existing entry |
| `delete_content` | Delete an entry |
| `publish_content` | Flip `draft: false` and commit |
| `search_content` | Full-text search across the workspace |
| `list_media` | List files in the media library |
| `upload_media` | Upload a file (base64 encoded) to the media path |
| `get_github_pr` | Get the PR status for a content branch |
| `list_scheduled` | List entries with a future `publishAt` date |

---

### 3 — Resources to expose

MCP resources are read-only context the AI can browse without calling a tool:

| Resource URI | Content |
|---|---|
| `pagescms://config` | Full workspace config (collections, fields, media paths) |
| `pagescms://content/{collection}` | Index of all entries in a collection |
| `pagescms://content/{collection}/{slug}` | Raw content of a single entry |
| `pagescms://schema/{collection}` | Field definitions for a collection |

---

### 4 — API key management UI

Users need a way to generate and revoke MCP credentials inside PagesCMS:

- "Integrations" settings page
- Generate named API keys with scope: `read` / `read-write`
- Show the exact JSON snippet to paste into `claude_desktop_config.json` or `.mcp.json`
- Revoke anytime

---

### 5 — Prompt library (skills)

Ship a set of ready-made Claude slash commands (`.claude/commands/`) that users can drop into their project:

| Skill | What it does |
|-------|-------------|
| `/cms-draft` | Creates a new draft in a chosen collection from a topic |
| `/cms-publish` | Publishes a named draft |
| `/cms-audit` | Lists all stale drafts with summaries |
| `/cms-bulk-update` | Updates a frontmatter field across multiple entries |
| `/cms-pr` | Opens a GitHub PR for a content branch |

These are shipped as `.md` files in a `pagescms-skills` directory users can copy into their `.claude/commands/` folder.

---

## Implementation order

```
Week 1:   API key model (D1 schema + generation UI)
Week 2:   MCP server route (capability negotiation + auth)
Week 3:   Read tools (list_collections, get_schema, list_content, get_content, search_content)
Week 4:   Write tools (create_content, update_content, delete_content, publish_content)
Week 5:   Media tools + resource endpoints
Week 6:   Prompt library + setup docs
```

---

## What NOT to build

- No AI models inside PagesCMS
- No embeddings, no vector search, no LLM calls from the server
- No "AI writing assistant" in the editor
- No dependency on any AI provider

The CMS stays fast, predictable, and cheap to run. The AI layer is the user's Claude subscription — they already have it.

---

## Stack fit

| Need | How |
|------|-----|
| MCP HTTP transport | New Worker route in `worker/index.ts` |
| Tool execution | Existing `lib/` GitHub + D1 logic, re-exported as MCP tools |
| Auth | New `api_keys` table in D1 via Drizzle |
| Docs | `content/docs/` (already a collection in the CMS itself) |
