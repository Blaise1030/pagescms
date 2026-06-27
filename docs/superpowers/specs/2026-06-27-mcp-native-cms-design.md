---
name: mcp-native-cms
description: Turn the git-native CMS into an MCP-native content backend for the AI / vibe-coding era — one content-service core exposed over REST (UI), MCP (agents/builders), and a public read API (deployed apps), so any platform that speaks MCP gets a CMS for free.
metadata:
  type: project
---

# MCP-Native CMS — Design

## Goal

Make this CMS the path of least resistance for any AI agent or vibe-coding
platform (Cursor, Claude, Lovable, Bolt, v0, Windsurf, ChatGPT) that needs
structured, writable, **reviewable** content. We do this by exposing the
existing content engine over the **Model Context Protocol** plus a public
read API — built once, reachable everywhere — under the `gitcms.dev` brand.

Why this is the right bet: a git-native CMS already stores content as typed
files with schema validation and commit history. That happens to be the
exact substrate AI needs — files (no DB lock-in), typed schema (a contract
agents validate against), and git (every AI edit is a reviewable,
revertable, attributable commit/PR). We are not bolting AI on; we are
exposing what already exists.

This spec concludes the discussion captured in the companion docs and is the
canonical design to build from:
- `2026-06-27-mcp-server-design.md` — detailed server spec
- `2026-06-27-mcp-platform-architecture.md` — multi-platform shape
- `2026-06-27-github-graphql-analysis.md` — GraphQL value assessment

## Architecture: one core, three transports

```
                 lib/content-service.ts          ← single source of truth
        (schema resolve · Zod validate · field codecs ·
         serialize · commit · operations + access gates)
            ▲                ▲                  ▲
       REST API          MCP server        Public read API
       (web UI)          (agents/          (deployed apps
       cookie auth        builders)         fetch content)
                          PAT / OAuth       read-only, key-gated
```

Everything routes through one framework-agnostic core. Building the MCP
server and the public API is overwhelmingly **transport + auth + tool
shaping** over logic that already exists inside the route handlers.

**The MCP server is build-time** (agent reads schema, edits content,
scaffolds client code); connectors are never shipped in the deployed app.
**The public read API is runtime** — the scaffolded code calls it to render
content. Both are required: setup with nothing to talk to is dead on
arrival.

## Scope

### Prerequisite (gates everything)

- **Extract `lib/content-service.ts`** — pure functions taking an explicit
  `RepoCtx` ({ user, token, config, octokit }) instead of `NextRequest` /
  session. CRUD logic currently lives inline in route handlers
  (`app/api/[owner]/[repo]/[branch]/files/[path]/route.ts`,
  `entries/[path]/route.ts`, `collections/[name]/route.ts`). Move it; make
  REST routes thin adapters. Independently valuable (testable core, less
  duplication) and unblocks all three transports.

Reuses, unchanged:
- `getSchemaByName` (`lib/schema.ts`) — resolve collection/file schema
- `generateZodSchema` — entry validator (**the agent guardrail**; → JSON
  Schema gives each MCP tool a typed input contract for free)
- `deepMap` + `getCodec().read/.write` — per-field transforms
- `parse` / `stringify` (`lib/serialization.ts`) — frontmatter & serial
- `buildCommitTokens` / `resolveCommitMessage` / `resolveCommitIdentity`
- `getToken` / `checkRepoAccess` / `isContentOperationAllowed`

### MCP server (`worker/index.ts` mount, Streamable HTTP)

Tool surface, in five capability groups:

1. **Discover** — `list_collections`, `get_entry_schema`
2. **Read** — `list_entries`, `get_entry`, `search_content`
3. **Write** — `write_entry`, `delete_entry`, `rename_entry`, with
   `mode: "commit" | "propose"` (propose = branch + PR; **default for
   agents** — human reviews the diff)
4. **Assets / automation** — `upload_media`, `list_actions`, `run_action`
5. **Scaffold (the integration adapter)** — `scaffold_client` with a
   `target` enum (react-vite, next, svelte, raw): emits a typed client + TS
   types (from `generateZodSchema`) + env config + example components into
   the host project. This one tool is how we "integrate with any platform"
   — neutral code the host agent writes in, which then calls the public
   read API. No per-platform code on our side.

Ship **static generic tools first**; layer **dynamic per-collection tools**
(generated from `.pages.yml`, e.g. `create_blog_post` with the collection's
JSON Schema) behind a flag — they make the CMS feel native but the list
changes per repo.

### Public read API

- `GET /api/public/{owner}/{repo}/{branch}/content/...` → parsed
  `contentObject` JSON (reuses `parse` + read codecs).
- Read-only transport over the core. Opt-in per repo; private repos require
  a read key.

### Auth

- **Phase 1 — PAT.** New `cms_token` table ({ id, userId, name, tokenHash,
  scopes, expiresAt }); minted from Settings UI; sent as `Bearer`. Resolves
  to the same `getToken` / `checkRepoAccess` gate the UI uses. Works on
  every MCP client.
- **Phase 2 — OAuth 2.1** (MCP auth spec) for one-click connect; degrades
  to PAT.
- **Invariant:** MCP auth never widens access beyond the user's GitHub
  permissions.

### GraphQL (targeted, not wholesale)

Only two moves (full rationale in the GraphQL analysis doc):
1. Build the **repo-context handshake** (repo + viewer permission +
   `.pages.yml` blob + branch head SHA) as a **single GraphQL query** inside
   `content-service.ts`. Compounds across an agent's many tool calls.
2. Design **`search_content`** (and `get_entry` returning content + commit
   meta) on **GraphQL aliases**.
Keep **writes on the git data API**. Everything is bounded by the existing
D1 cache (most reads are cache hits that never touch GitHub).

### Per-platform connection (docs, not code)

One server, N copy-paste guides: Cursor/Windsurf (`mcp.json`),
Claude (`claude mcp add`), Lovable (chat connector → invoke
`scaffold_client`), ChatGPT/other (remote URL). Engineering surface stays a
single server.

## Out of scope (deliberate)

- Editing `.pages.yml` via MCP (config reshapes the whole tool surface —
  keep human-only initially).
- Moving writes to GraphQL (negative ROI, high risk).
- A bespoke Lovable-only integration (MCP is the universal adapter).
- Hosted multi-tenant decision — see open questions; affects whether
  OAuth/discovery is core or optional.

## Safety

- Per-token scopes (repo globs + op set); read-only tokens for RAG agents.
- `operations` config enforced server-side regardless of agent request.
- `propose` mode default keeps a human in the loop.
- Edge rate-limiting per token.
- Audit via git: every mutation is an attributable commit; tag
  agent-originated commits (`Via: gitcms-mcp`).
- Content read back from the repo is untrusted; the server returns data, it
  does not act on instructions embedded in content.

## Validation / error contract

- All writes pass `generateZodSchema(fields).safeParse`; on failure return
  field-path messages (`message at path.to.field`) so agents self-correct.
- `sha` optimistic concurrency + `onConflict: "error" | "rename"` carry
  over from REST unchanged.

## Build order

1. Extract `lib/content-service.ts` (+ unit tests). Fold in the GraphQL
   handshake query.
2. PAT auth + `cms_token` table + Settings UI.
3. MCP endpoint on the Worker: Discover + Read tools (`search_content` on
   GraphQL aliases).
4. Public read API.
5. `scaffold_client` (react-vite + next targets first).
6. Write tools (`commit` + `propose`).
7. Media + actions tools.
8. Dynamic per-collection tools; OAuth 2.1; connection guides + directory
   listings.

## Open questions

- **Managed multi-tenant gitcms vs self-host-first** — decides whether
  discovery / OAuth is core or optional. *Highest-leverage decision.*
- Endpoint scoping: single `/mcp` (repo arg) vs per-repo
  `/{owner}/{repo}/mcp` (cleaner dynamic tools + tighter token scope).
- Default write mode for agents: `propose` (lean) vs `commit`.
- Public read API: fully public vs read-key-gated by default (lean: opt-in;
  private repos require a key).
- Dynamic tool-list explosion for large configs — may need a
  `select_collection` gate or grouping.
```
