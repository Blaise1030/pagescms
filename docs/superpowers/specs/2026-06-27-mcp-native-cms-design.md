---
name: mcp-native-cms
description: The AI-age CMS in two separate parts — (1) a Setup Skill the vibe-coding agent runs to interview the user and author the .pages.yml schema (no backend), and (2) an MCP server that lets Claude discover existing content and push content into the platform. Both sit on one content-service core.
metadata:
  type: project
---

# AI-Age CMS — Two-Part Design (umbrella)

## The two parts

The AI-age direction for this CMS is **two separate products** with
different audiences, lifecycles, and infrastructure. Keeping them separate
is the whole point.

| | **Part 1 — Setup Skill** | **Part 2 — Content MCP server** |
|---|---|---|
| Job | **Configure** — author the `.pages.yml` schema | **Populate** — discover & push content |
| Trigger | Once at setup (+ on model changes) | Continuously |
| Form | Agent **Skill(s)** run in the host platform | Running **MCP server** (Streamable HTTP) |
| Backend | **None** — writes a file into the repo | Worker + D1 + GitHub, PAT/OAuth auth |
| Audience | Vibe-coding platforms (Lovable, Cursor…) | Claude / any MCP agent |
| Spec | `2026-06-27-cms-setup-skill-design.md` | `2026-06-27-mcp-server-design.md` |

Part 1 defines the **shape**; Part 2 fills it. A user vibe-codes a site, the
Setup Skill interviews them and writes the schema, then Claude (via MCP)
keeps the content flowing against that schema.

```
 Part 1 (Skill, no backend)            Part 2 (MCP server)
 ┌───────────────────────┐            ┌───────────────────────┐
 │ interview user        │            │ discover content       │
 │ → pick project type   │  writes    │ list/get/search entry  │
 │ → author .pages.yml   │ ─────────▶ │ push content           │
 │ → optional preview    │  schema    │ write/propose entry    │
 └───────────────────────┘  to repo   └───────────────────────┘
        configures the shape                fills the shape
```

## Why this is the right bet

A git-native CMS already stores content as typed files with schema
validation and commit history — exactly the substrate AI needs: files (no
DB lock-in), typed schema (a contract agents validate against), git (every
AI edit is a reviewable, revertable, attributable commit/PR). We expose what
already exists rather than bolt AI on. Distributed as a Skill + an MCP
server, it reaches every platform that speaks those standards — built once,
reachable everywhere — under the `gitcms.dev` brand.

## Part 1 — Setup Skill (configure)

A **family of Skills** the host agent runs: a parent `setup-pages-cms` that
detects/asks the project type, dispatching to a specialized sub-skill (blog,
docs, marketing, portfolio, changelog, catalog, knowledge-base). Each
sub-skill carries its own interview script + schema template + field
guidance, because the right questions and schema shape genuinely differ by
project type. Output **must validate** against `ConfigSchema`
(`lib/config-schema.ts`). It writes `.pages.yml` into the repo — no backend.

Optionally it also scaffolds runtime content-fetching code + types (the
codegen that does **not** belong in the MCP server). Full detail:
`2026-06-27-cms-setup-skill-design.md`.

## Part 2 — Content MCP server (populate)

Lets Claude **know what content exists** and **push content in**. Tool
groups:

1. **Discover** — `list_collections`, `get_entry_schema`
2. **Read** — `list_entries`, `get_entry`, `search_content`
3. **Write** — `write_entry`, `delete_entry`, `rename_entry`, with
   `mode: "commit" | "propose"` (propose = branch + PR; default for agents)
4. **Assets / automation** — `upload_media`, `list_actions`, `run_action`

Static generic tools first; dynamic per-collection tools (from `.pages.yml`)
behind a flag later. **`scaffold_client` is removed from the MCP server** —
it belongs to Part 1's Skill. Full detail:
`2026-06-27-mcp-server-design.md`.

## Shared foundation (both parts depend on it)

### `lib/content-service.ts` (prerequisite for Part 2)

Extract a framework-agnostic core taking an explicit `RepoCtx`
({ user, token, config, octokit }) from the inline route-handler logic
(`files/[path]/route.ts`, `entries/[path]/route.ts`,
`collections/[name]/route.ts`). REST routes and MCP tools become thin
adapters. Reuses `getSchemaByName`, `generateZodSchema` (the agent guardrail
→ JSON Schema input contract), field codecs, `parse`/`stringify`, commit
helpers, `getToken`/`checkRepoAccess`/`isContentOperationAllowed`.

### The config contract (the bridge between the parts)

`ConfigSchema` (`lib/config-schema.ts`) is what Part 1 *writes* and Part 2
*reads*. Field types: `string`, `text`, `rich-text`, `number`, `boolean`,
`date`, `select`, `image`, `file`, `reference`, `code`, `uuid`; structural
`object`/`block` (+ `list`). Entry types: `collection`, `file`, `group`.

### Public read API (runtime)

`GET /api/public/{owner}/{repo}/{branch}/content/...` → parsed JSON,
read-only, opt-in per repo (private repos need a read key). Supports the
runtime code Part 1 may scaffold. Sits on the same core.

### Auth (Part 2)

PAT first (`cms_token` table, `Bearer`, resolves to the same GitHub access
gate the UI uses), OAuth 2.1 later. Never widens beyond the user's GitHub
permissions.

### GraphQL (targeted)

Two moves only: build the repo-context handshake as one GraphQL query in
`content-service.ts`, and design `search_content` on GraphQL aliases. Keep
writes on the git data API. Bounded by the D1 cache. Detail:
`2026-06-27-github-graphql-analysis.md`.

## Safety

- Part 1: output validated against `ConfigSchema`; human reviews before
  write; config stays human-owned.
- Part 2: per-token scopes; `operations` enforced server-side; `propose`
  default keeps a human in the loop; every mutation is an attributable git
  commit (tag `Via: gitcms-mcp`); content read back is untrusted data, not
  instructions.

## Build order

**Part 1 (ships independently, no backend):**
1. Parent `setup-pages-cms` skill + project-type detection.
2. Sub-skills: blog, docs, marketing (then portfolio, changelog, catalog,
   knowledge-base).
3. Optional runtime scaffold (react-vite, next).

**Part 2 (needs the core):**
4. Extract `lib/content-service.ts` (+ tests; fold in GraphQL handshake).
5. PAT auth + `cms_token` + Settings UI.
6. MCP endpoint: Discover + Read (`search_content` on GraphQL aliases).
7. Public read API.
8. Write tools (`commit` + `propose`); media + actions.
9. Dynamic per-collection tools; OAuth 2.1; per-platform connection guides.

Part 1 and Part 2 are independently shippable; Part 1 has no backend
dependency and can land first.

## Open questions

- **Managed multi-tenant vs self-host-first** — decides whether
  discovery/OAuth is core (Part 2). Highest-leverage decision.
- Skill distribution mechanism per platform (published Agent Skills vs
  host-served) — confirm how Lovable surfaces skills.
- Does Part 1 stop at `.pages.yml` or also scaffold runtime rendering?
- Endpoint scoping (single `/mcp` vs per-repo); default write mode
  (`propose` vs `commit`); public read API public vs key-gated.
