# MCP-Native CMS — Platform Architecture (High Level)

**Status:** Draft · **Date:** 2026-06-27 · **Brand:** gitcms.dev

Companion to `2026-06-27-mcp-server-design.md` (the detailed server spec)
and `2026-06-27` Lovable notes. This doc is the *strategic* shape: how one
MCP server turns gitcms into the CMS backend for the whole vibe-coding
ecosystem.

## 1. Thesis: build once, integrate everywhere

Every AI builder platform — Cursor, Claude (Code/Desktop), Lovable, Bolt,
v0, Windsurf, ChatGPT — speaks **MCP**. So we do not build N integrations.
We build **one MCP server** and one public read API. Each platform differs
only in *how it connects a server* (Lovable = chat connector, Cursor =
`mcp.json`, Claude = connector UI). That's documentation, not engineering.

The moat: a CMS that is *MCP-native* is the path of least resistance for
any agent that needs structured, writable, reviewable content. Git gives us
provenance and review for free; MCP gives us universal reach.

## 2. The layering (one core, many transports)

```
                  ┌──────────────────────────────────────┐
                  │        lib/content-service.ts         │  ← single source of truth
                  │  schema resolve · Zod validate ·      │    (framework-agnostic,
                  │  field codecs · serialize · commit ·  │     takes RepoCtx)
                  │  operations + access gates            │
                  └──────────────────────────────────────┘
                     ▲            ▲                ▲
        ┌────────────┘     ┌──────┘         ┌──────┘
   ┌─────────┐       ┌───────────┐    ┌──────────────────┐
   │ REST API│       │ MCP server│    │ Public read API  │
   │ (web UI)│       │ (agents/  │    │ (deployed apps   │
   │         │       │  builders)│    │  fetch content)  │
   └─────────┘       └───────────┘    └──────────────────┘
   cookie auth       PAT / OAuth      public or API-key, read-only
```

Everything routes through `lib/content-service.ts`. Building the MCP server
is overwhelmingly *transport + auth + tool shaping* over logic that already
exists in the route handlers — the prerequisite is extracting that core
(see detailed spec §3).

Two transports matter for the ecosystem play:

- **MCP server** — build time. The agent reads schema, lists/edits content,
  and (key) scaffolds client code into the project. Connectors do **not**
  ship in the deployed app.
- **Public read API** — runtime. The scaffolded code calls this to render
  content in the shipped app. Without it, MCP setup has nothing to talk to.

## 3. The MCP server, at altitude

### Tool taxonomy (5 capability groups)

1. **Discover** — `list_collections`, `get_entry_schema`. The agent learns
   the repo's typed content model.
2. **Read** — `list_entries`, `get_entry`, `search_content`.
3. **Write** — `write_entry`, `delete_entry`, `rename_entry`, with
   `mode: "commit" | "propose"` (propose = PR, default for agents).
4. **Assets/automation** — `upload_media`, `list_actions`, `run_action`.
5. **Scaffold (the integration adapter)** — `scaffold_client` /
   `setup_client`: emits a runtime client + TS types + env config + example
   components for a given `target` (react-vite, next, svelte, raw). This one
   tool is how we "integrate with any vibe-coding platform" — platform-
   neutral code the host agent writes into the project, which then calls the
   public read API. No per-platform code on our side.

### Schema-driven dynamic tools (the differentiator)

Tools can be **generated per repo from `.pages.yml`** (e.g.
`create_blog_post` with the collection's JSON Schema as its input), reusing
`generateZodSchema`. This makes gitcms feel *native* on any platform: the
agent sees typed, repo-specific operations, not a generic blob. Ship static
generic tools first; layer dynamic tools behind a flag.

## 4. Cross-platform requirements (what "works everywhere" demands)

| Concern | Decision |
|---|---|
| **Transport** | Streamable HTTP (remote) — the common denominator all platforms support. Offer an `npx` stdio shim for local-only clients that wraps the remote endpoint. |
| **Auth** | PAT (`Bearer`, works on every client) as the floor; OAuth 2.1 (MCP auth spec) for one-click clients. Always degrades to PAT. Never widens beyond the user's GitHub access. |
| **Scoping** | Per-repo endpoints (`/{owner}/{repo}/mcp`) + scoped tokens → clean dynamic tool lists and tight blast radius. Single `/mcp` with a repo arg is the fallback. |
| **Stability** | Versioned tool names + a documented capability set so platform configs don't break on updates. |
| **Discoverability** | Publish a `/.well-known/mcp` descriptor and listings (mcp directories) so platforms/users find the server. |
| **Safety** | Per-token rate limits at the Worker edge; `operations` config enforced server-side; propose-mode default; every mutation is an attributable git commit. |

## 5. Why Cloudflare Workers fits

The app already runs on Workers (Streamable HTTP = request/response, no
long-lived process), with D1 for tokens and the existing GitHub cache. The
MCP endpoint mounts in `worker/index.ts` alongside the current routes — same
deploy, same edge, same auth substrate.

## 6. Per-platform connection (docs, not code)

One server, N short setup guides:

- **Cursor / Windsurf** — add to `mcp.json` (URL + PAT).
- **Claude Code / Desktop** — add as a connector / `claude mcp add`.
- **Lovable** — add as a *chat connector*; invoke `setup_client` in chat.
- **ChatGPT / others** — add the remote MCP URL.

Each is a copy-paste snippet. The engineering surface stays a single server.

## 7. Build order (ecosystem-first)

1. Extract `lib/content-service.ts` (+ tests). *Prerequisite for all three
   transports.*
2. PAT auth + token table + Settings UI.
3. MCP server: discover + read tools (Streamable HTTP on the Worker).
4. Public read API (read-only transport over the core).
5. `scaffold_client` tool (react-vite + next targets first).
6. Write tools (`commit` + `propose`).
7. Dynamic per-collection tools; OAuth 2.1; connection guides + directory
   listings.

## 8. Open questions

- Is `scaffold_client` one tool with a `target` enum, or a small family of
  per-framework tools? (Lean: one tool, `target` enum.)
- Public read API: fully public vs read-key-gated by default? (Lean: opt-in
  per repo; private repos require a read key.)
- Do we host a managed multi-tenant gitcms, or stay self-host-first? This
  decides whether discovery/OAuth is core or optional.
- Tool-list size: dynamic per-collection tools can explode the list for big
  configs — may need grouping or a `select_collection` gate.
```
