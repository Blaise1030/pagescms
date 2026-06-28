# MCP Server — Technical Design

**Status:** Draft · **Date:** 2026-06-27 · **Target brand:** gitcms.dev

## 1. Goal

Expose a repo's PagesCMS content as a **remote MCP server** so AI agents
(Claude Code, Cursor, Claude Desktop, custom agents) can read and write
content with the *same schema validation, field codecs, commit semantics,
and access control* the web UI already uses. Every agent write lands as a
git commit (or PR), making it reviewable, revertable, and attributable.

This is the concrete proof of the "git-native is the right AI substrate"
thesis: structured enough to be safe, git-native enough for agents,
reviewable enough to trust.

## 2. Why this is low-risk to build

The write pipeline already exists and is the contract we reuse verbatim:

- `getSchemaByName(config.object, name)` — resolve a collection/file schema
  from `.pages.yml`.
- `generateZodSchema(fields)` (`lib/schema.ts`) — produce a Zod validator
  for an entry's content. **This is the agent guardrail.** Zod → JSON
  Schema gives each MCP tool a typed input contract for free.
- `deepMap` + field codecs (`getCodec(type).read/.write`) — per-field
  read/write transforms.
- `parse` / `stringify` (`lib/serialization.ts`) — frontmatter (yaml/toml/
  json), straight serial formats, raw/code.
- Commit semantics — `buildCommitTokens`, `resolveCommitMessage`,
  `resolveCommitIdentity` (app vs user), per-schema templates.
- Access control — `getToken(user, owner, repo)`, `checkRepoAccess`,
  `isContentOperationAllowed("create"|"rename"|"delete", { schema })`.

The MCP server is a **new transport over existing logic**, not new logic.

## 3. Required refactor (prerequisite)

Today the CRUD logic lives *inline* inside the Next.js route handlers
(e.g. `app/api/[owner]/[repo]/[branch]/files/[path]/route.ts` does parse →
validate → codec → serialize → commit in one function). MCP tools must not
duplicate this.

**Extract a framework-agnostic content service** (`lib/content-service.ts`)
with pure functions that take an explicit context instead of reading
`NextRequest`/session:

```ts
type RepoCtx = { user: User; token: string; config: Config; octokit: Octokit };

listCollections(ctx): CollectionSummary[]
getEntrySchema(ctx, name): { jsonSchema, fields, format }
listEntries(ctx, name, { search?, sort?, page? }): EntrySummary[]
getEntry(ctx, name, path): { sha, path, contentObject }
writeEntry(ctx, { name, path?, content, sha?, onConflict, mode }): WriteResult
deleteEntry(ctx, name, path): WriteResult
renameEntry(ctx, name, from, to): WriteResult
```

Then both the REST routes **and** the MCP tools become thin adapters over
this service. `withRepoContext` (`lib/api-repo-context.ts`) already builds
`RepoCtx` for the REST side; MCP builds the same struct from its own auth.

Do this refactor first — it's independently valuable (testable core, less
duplication) and de-risks everything below.

## 4. Transport & hosting

- **Streamable HTTP MCP** (the remote-server transport), served from the
  same Cloudflare Worker. stdio is a non-starter for a hosted product.
- Endpoint: `https://gitcms.dev/mcp` (or per-repo
  `https://gitcms.dev/{owner}/{repo}/mcp` — see §6 on scoping).
- Use the official `@modelcontextprotocol/sdk` server with a Workers
  fetch handler, mounted alongside the existing app routes in
  `worker/index.ts`. Workers + Streamable HTTP is a good fit (request/
  response, no long-lived stdio process).

## 5. Authentication

Two phases:

**Phase 1 — scoped API tokens (PAT).** New `cms_token` table:
`{ id, userId, name, tokenHash, scopes (repo globs + op set), createdAt,
lastUsedAt, expiresAt }`. Issued from Settings UI. Client sends
`Authorization: Bearer cms_pat_…`. Server hashes, looks up user, then
reuses `getToken`/`checkRepoAccess` exactly as the REST path does. Fast to
ship; familiar to users; no OAuth dance.

**Phase 2 — OAuth 2.1** per the MCP authorization spec, so Claude
Desktop/Code can connect with a click. better-auth can front this; the MCP
SDK has auth helpers. Tokens still resolve to the same `RepoCtx`.

Critical invariant: **MCP auth never widens access beyond the user's GitHub
permissions.** It resolves to the same `token` + `checkRepoAccess` gate the
UI uses. An agent can do exactly what the connecting user can do, no more.

## 6. Tool surface

Two options for how schema-shaped the tools are:

- **A. Static generic tools** — `list_entries`, `get_entry`, `write_entry`
  take a `collection` arg; content is a generic object validated server-
  side. Simple, stable tool list, but the agent sees the field contract
  only after calling `get_entry_schema`.
- **B. Dynamic per-collection tools** — generate
  `create_blog_post`, `update_blog_post`, … from the config, each with the
  collection's JSON Schema as its input schema. Best agent ergonomics
  (typed args, inline validation) but the tool list changes per repo and on
  config edits.

**Recommendation: ship A first, layer B on top.** A is the stable
foundation; B is generated from the same `generateZodSchema` output and can
be feature-flagged once A is proven.

### Core tools (Phase 1, option A)

| Tool | Purpose |
|------|---------|
| `list_collections` | Collections/files from `.pages.yml` (name, label, type, path, operations). |
| `get_entry_schema` | JSON Schema + field list + format for a collection. The agent's contract. |
| `list_entries` | Paginated list with search/sort (mirrors `view` config). |
| `get_entry` | Parsed `contentObject` + `sha` for one entry. |
| `write_entry` | Create/update. Validates via Zod, runs write codecs, serializes, commits. Returns commit + new `sha`. |
| `delete_entry` / `rename_entry` | Gated by `operations`. |
| `search_content` | Cross-collection text search (uses existing cache where available). |
| `upload_media` | Write to the media folder per `media` config. |
| `list_actions` / `run_action` | Trigger configured GitHub Actions workflows (deploy, etc.). |
| `search_docs` | Retrieve relevant documentation chunks for a query (config/content conventions). |
| `get_doc` | Return a full documentation page by slug. |

### Write modes (the trust knob)

`write_entry` / `delete_entry` accept `mode: "commit" | "propose"`:

- `"commit"` — direct commit to the working branch (current REST behavior).
- `"propose"` — commit to a generated branch + open a PR. This is the
  default we'd recommend for agents: human reviews the diff before it's
  live. Reuses commit templates for the PR title/body.

### Documentation (so agents author correctly)

An agent that knows the *tools* still needs to know the *conventions* — how
`.pages.yml` is shaped, what field types and formats exist, how `view`/
`operations`/`media` work. Rather than bake that into tool descriptions
(which bloats every session) or rely on the model's priors (which drift),
the server exposes the same documentation the setup skill sources from:
`content/docs/`. This is the **single source of truth** shared across the
setup skill (Part 1) and the MCP server (Part 2).

Two surfaces, both backed by the existing docs loader (`lib/docs-content-
loader.ts` / `content/docs/**`):

- **MCP Resources** — expose docs as readable resources (e.g.
  `docs://configuration/content`), so clients that support resources can
  list/attach them on demand. Good for "show me the config reference."
- **Tools** — `search_docs(query)` returns the most relevant chunks (FTS /
  embeddings over the docs), `get_doc(slug)` returns a full page. Works on
  every client even where MCP resources aren't supported, and keeps token
  cost low (retrieve only what's needed) versus dumping all docs.

Design notes:

- **Index once, reuse.** Build a docs index (chunk + FTS, optionally
  embeddings) at deploy time from `content/docs/**`. The same index can back
  `search_content`-style retrieval and a published `llms.txt` export.
- **Two doc scopes:** *product docs* (how the CMS/config works — static,
  repo-independent) and *this-repo context* (the live `.pages.yml` +
  `get_entry_schema`, which is repo-specific). `search_docs` covers the
  former; the discover tools cover the latter. An agent typically reads a
  bit of both before writing.
- **Versioning:** pin docs to the deployed app version so guidance matches
  the running server's behavior.
- **Cheap win, early:** `search_docs` is low-risk, read-only, and
  dramatically improves write quality — worth shipping in the read-tools
  phase, before write tools.

## 7. Validation & error contract

- All content writes pass through `generateZodSchema(fields).safeParse`.
  On failure, return MCP tool errors with the **field-path messages**
  already produced in the files route (`message at path.to.field`) so the
  agent can self-correct.
- `onConflict: "error" | "rename"` and `sha` optimistic-concurrency carry
  over from the REST API unchanged — an agent updating a stale entry gets a
  clear conflict instead of clobbering.

## 8. Safety / guardrails

- Per-token scopes limit repos and operations (read-only tokens for RAG-
  style agents).
- `operations` config (`create`/`rename`/`delete`) is enforced server-side
  regardless of what the agent requests.
- `propose` mode keeps a human in the loop by default.
- Rate limiting per token at the Worker edge.
- Audit: every mutation is already a git commit with identity; optionally
  tag agent-originated commits in the trailer (e.g. `Via: gitcms-mcp`).
- Prompt-injection note: content read back from the repo is untrusted; the
  server returns data, it does not act on instructions embedded in content.

## 9. Phasing

1. **Refactor** route logic into `lib/content-service.ts` (+ unit tests).
2. **PAT auth** + `cms_token` table + Settings UI to mint tokens.
3. **Docs index + `search_docs` / `get_doc`** (and MCP resources) from
   `content/docs/**`. Read-only, low-risk, lifts write quality — ship with
   the read tools.
4. **MCP endpoint** on the Worker with core read tools
   (`list_collections`, `get_entry_schema`, `list_entries`, `get_entry`,
   `search_content`).
5. **Write tools** (`write_entry`, `delete_entry`, `rename_entry`) with
   `commit` + `propose` modes.
6. **Media + actions** tools.
7. **Dynamic per-collection tools** (option B) behind a flag.
8. **OAuth 2.1** for one-click client connection.

## 10. Open questions

- Endpoint scoping: single `/mcp` with repo as a tool arg, vs per-repo
  `/{owner}/{repo}/mcp`. Per-repo gives cleaner dynamic tool lists (§6B)
  and tighter token scoping; single endpoint is simpler to document.
- Default write mode: `propose` (safer) vs `commit` (matches UI). Lean
  `propose` for agents.
- Branch targeting: expose `branch` per call, or pin per token?
- Do we surface `.pages.yml` editing via MCP, or keep config human-only?
  (Recommend human-only initially — config changes reshape the whole tool
  surface.)
```
