# GitHub GraphQL — Where It Helps (and Where It Doesn't)

**Status:** Analysis · **Date:** 2026-06-27

Brutally honest assessment of where GitHub's GraphQL API adds value over the
REST API the app currently uses — both for the existing web app and for the
planned MCP server (`2026-06-27-mcp-server-design.md`).

## TL;DR

- The **single biggest GraphQL win is already captured**: collection
  directory listing already fetches every file's content inline in one
  query (`lib/github-cache-folders.ts:200-226`). There is no large untapped
  perf win lurking.
- There is **one worthwhile project**: collapse the per-request repo-context
  handshake (repo metadata + viewer permission + `.pages.yml` blob + branch
  head SHA) into a **single GraphQL round trip**.
- For the **MCP server**, that same handshake win is *more* valuable
  (agents make many sequential tool calls), plus one new tool —
  `search_content` — is best designed on GraphQL aliases.
- **Do not move writes to GraphQL.** Ever. No win, real risk.
- Everything is bounded by the existing D1 cache: GraphQL only matters on
  cache miss + cold context.

## Current GitHub API usage (call-site inventory)

REST dominates. Most-used calls:

```
6  repos.getContent          (single-file + media reads)
5  git.getRef
4  repos.get                 (permission / existence checks)
3  repos.getBranch
3  octokit.graphql           (already used!)
2  repos.createOrUpdateFileContents
2  actions.* (listWorkflowRuns / getWorkflowRun / createWorkflowDispatch)
1  git.getTree / createTree / createCommit / createRef / updateRef  (write path)
1  repos.listCommits         (entry history)
```

GraphQL is already used in `lib/github-cache-folders.ts` and
`lib/github-cache-file.ts`.

## What GraphQL already does well here

`lib/github-cache-folders.ts` queries a directory `Tree` and pulls each
`Blob`'s `text`, `oid`, and `byteSize` **inline in one request**. This
collapses the classic "list dir → read N files' frontmatter" N+1 into a
single call — the highest-value GraphQL pattern for a git-backed CMS. It is
done. Do not expect a second win of this magnitude.

## Where GraphQL genuinely still helps

Ranked by value:

1. **Per-request repo-context handshake (the real win).**
   Every authenticated request re-derives context via *separate* REST
   round trips scattered across files:
   - `repos.get` for permission — `github-cache-permissions.ts:34`,
     `authz-server.ts:24`, `token.ts:151`
   - `getContent` for `.pages.yml` — `config-store.ts:154`
   - `getBranch` / `getRef` for the head SHA
   From a Cloudflare Worker edge each is a separate latency hop. One GraphQL
   query can return repo metadata + `viewerPermission` + the `.pages.yml`
   blob + the branch head SHA in **one round trip**. Fold this into the
   planned `lib/content-service.ts`.

2. **The actions 3-call chains.**
   `actions/route.ts` and `actions/[runId]/route.ts` do
   `getBranch → getRef → getRef (tag)` sequentially. One GraphQL query
   collapses them. Small, easy.

3. **Rate-limit headroom for fan-out.**
   GraphQL's point budget is friendlier once you fan out (multi-collection
   views, MCP `search_content`). Not a problem today; the right tool when
   breadth is added.

## Where GraphQL does NOT help — or is a mistake

- **Writes — do not migrate.** The write path uses the git data API
  (`createTree → createCommit → updateRef`). GraphQL's
  `createCommitOnBranch` is more awkward (strict expected-head, base64
  additions), buys nothing, and rewriting the most dangerous code path is
  pure downside.
- **Single-file reads** (`entries/[path]/route.ts` `getContent`) — REST is
  simple and fine; marginal gain, not worth churn.
- **Per-file commit history** (`history/route.ts` `listCommits`) — GraphQL's
  `history(path:)` is ergonomically *worse* here. Keep REST.
- **Webhook push handler** — works off the push payload; GraphQL irrelevant.

## Cost to weigh

GraphQL queries here are stringly-typed with `any` responses (the existing
ones have no codegen). More GraphQL means more hand-maintained query strings
unless you add `@octokit/graphql-schema` + codegen — real tooling weight
against modest latency gains.

## MCP-server-specific assessment

Agent workloads differ from UI workloads in two ways that nudge GraphQL's
value *up*:

1. **Many sequential tool calls per task** (10–50 in a reasoning loop) vs a
   human's few clicks — so saving a round trip *compounds*.
2. **Breadth / fan-out** ("translate all posts", "find every entry
   mentioning X") far more than humans, who read one entry at a time.

### Where GraphQL earns its place in the MCP server

1. **The context handshake — now the dominant win.** A stateless Worker
   re-derives context potentially *per tool call*; the agent makes dozens.
   Collapsing it into one GraphQL query multiplies across the loop. #1
   reason to bother.
2. **`search_content` (and cross-collection "list with content").** GraphQL
   fetches multiple trees/blobs by alias in one query; REST is N+1. The
   existing folder query is the single-directory proof; `search_content` is
   the multi-directory generalization — design it on GraphQL from day one.
3. **Fatter single tools.** Design `get_entry` to return content + sha +
   last-modified commit in one GraphQL hit rather than two REST calls — an
   agent pays the doubling on every entry otherwise.

### Where it adds nothing for MCP

- `write_entry` / propose mode — commit via git data API, PR via REST.
- `scaffold_client` — pure codegen, zero GitHub calls.
- `run_action` — workflow dispatch, REST.

### The caveat that bounds all of it

The MCP server inherits the **D1 cache** (`content-cache`, folder cache).
Most `get_entry` / `list_entries` calls are **cache hits that never touch
GitHub**. GraphQL only matters on **cache miss + cold context** — a latency
optimization on a minority of calls, not a throughput unlock.

## Recommendation

Two targeted moves, nothing more:

1. Build the repo-context handshake as a **single GraphQL query** inside
   `lib/content-service.ts` (benefits UI, REST, and MCP).
2. Design the MCP **`search_content`** tool on GraphQL aliases; consider a
   GraphQL-backed `get_entry` that returns content + commit metadata in one
   hit.

Keep writes on the git data API. Reject any "REST → GraphQL everywhere"
migration — it's negative ROI here.
