# PRD: Performance Optimization — Sub-300ms API Responses & Fast Client Navigation

## Problem Statement

Users of the CMS experience slow page loads and sluggish transitions between collections and entries. API responses frequently exceed 300ms, and navigating between sidebar items causes a full loading state even when the data was recently fetched. Editing an entry involves a noticeable delay before the form renders. These delays erode trust in the tool and slow down content workflows.

## Solution

Eliminate the sequential request waterfall on the server, add an in-memory config cache to avoid redundant D1 lookups, serve cached entry content from D1 instead of always hitting the GitHub API, and add client-side prefetching and stale-while-revalidate data fetching so navigation between pages feels instant.

## User Stories

1. As a content editor, I want collection lists to appear immediately when I click a sidebar item, so that I don't have to wait for a loading spinner on every navigation.
2. As a content editor, I want the entry form to open quickly after clicking an item in the collection table, so that I can start editing without delay.
3. As a content editor, I want previously-loaded collections to remain visible while fresh data loads in the background, so that the UI never goes blank during a refresh.
4. As a content editor, I want the rich text editor to not delay the initial page render, so that the rest of the form is interactive before the editor finishes loading.
5. As a content editor, I want sidebar navigation links to feel instant when I hover over them, so that the transition to a new collection is already prepared before I click.
6. As a repository admin, I want API responses for entry reads to be served from cache when possible, so that opening entries does not depend on GitHub API latency.
7. As a repository admin, I want config lookups to be fast even under concurrent requests, so that multiple users on the same repository do not each trigger a D1 query for the same config data.
8. As a developer, I want database index usage to be reliable across owner/repo lookups, so that query performance does not degrade as the dataset grows.
10. As a developer, I want the token and config fetches to run in parallel where there is no dependency between them, so that the server-side request waterfall is minimised.
11. As a developer, I want the in-memory config cache to have a configurable TTL, so that config freshness can be tuned without a deployment.
12. As a developer, I want the session deduplication to apply within a single RSC render tree, so that layouts and child routes do not each pay the auth cost separately.
13. As a developer, I want the entry fetch path to attempt the D1 file cache before calling the GitHub API, so that cache hits skip the external network entirely.
14. As a developer, I want the collection table to use stale-while-revalidate semantics, so that cached data displays immediately and updates silently.
15. As a developer, I want the rich text and code editor field implementations to be lazy-loaded, so that the heavy editor bundle does not block the initial form render.

## Implementation Decisions

### 1. Parallelise the Per-Request Waterfall
The current sequence — `getSession → getToken → getConfig → GitHub API` — has unnecessary sequential dependencies. `getToken` and `getConfig` both depend on the session user, but not on each other. After session resolution, `getToken` and `getConfig` should be initiated with `Promise.all`. The GitHub API call can then proceed as soon as both resolve.

### 2. In-Memory Config Cache
Wrap `getConfig` with a process-level `Map<string, { value: Config; expiresAt: number }>` keyed by `owner/repo/branch`. Default TTL: 30 seconds (configurable via env var). On a Cloudflare Workers deployment, each isolate has its own memory — the cache is per-isolate, not global. This is acceptable: the goal is to eliminate repeated D1 hits within the same isolate's request burst, not to provide cross-isolate consistency. The existing D1 config table remains the source of truth; the in-memory cache is a read-through layer only.

### 3. Fix Case-Insensitive Index Bypass
All DB queries using `sql\`lower(${table.owner}) = lower(${owner})\`` prevent the existing indexes from being used. The fix is to enforce lowercase at write time (already done in cache write paths) and switch read queries to `eq(table.owner, owner.toLowerCase())` so the indexed column is matched directly. This applies to the config table, cache file table, and any other table where `lower()` appears on a lookup.

### 4. Serve Entries from D1 Cache First
The `GET /api/[owner]/[repo]/[branch]/entries/[path]` route currently always calls the GitHub REST API. It should first check the `cacheFileTable` for an entry matching the path. If a cache hit exists and the folder scope is in a verified state, return the cached content directly. If the cache misses or the scope is stale, fall back to GitHub and update the cache. This is the highest-impact backend change — a GitHub REST call costs 200–500ms; a D1 read costs 5–15ms.

### 5. React `cache()` for Session Deduplication
Wrap `requireApiUserSession` (and `getServerSession`) with React's `cache()` so that within a single RSC render pass, the session is resolved once and the result is shared across all server components and route handlers that call it. This prevents layout + child route from each paying the session cost separately.

### 6. Client-Side Stale-While-Revalidate for Collection Lists
Replace raw `fetch` calls in the collection table component with SWR or React Query using `staleWhileRevalidate` semantics. The previously fetched list renders immediately from cache; a background revalidation replaces it silently. The existing IndexedDB infrastructure can act as the persistent SWR cache layer across page reloads.

### 7. Prefetch Sidebar Navigation Links
Add `prefetch={true}` to all `<Link>` elements in the repo sidebar that point to collection and media routes. Next.js will fetch the RSC payload on hover (or on mount in the viewport), so the navigation appears instant. This is a zero-risk change with no server cost beyond the prefetch request itself.

### 8. Lazy-Load Heavy Field Editors
The rich text editor (Tiptap) and code editor are bundled eagerly into the entry form. Wrap their field implementations with `React.lazy()` / `next/dynamic` with `{ ssr: false }`. The lazy-edit-component pattern already exists for the code field (`fields/core/code/lazy-edit-component.tsx`) — apply the same pattern to the rich text field. The form shell renders and becomes interactive before the editor bundle parses.

## Testing Decisions

Good tests for this work verify externally observable behaviour — response time characteristics, data returned, and cache state — not internal implementation details like which function was called or how many times.

**Modules to test:**

- **In-memory config cache:** Test that a second call within TTL returns the cached value without hitting the DB adapter, and that a call after TTL expiry refetches. Test that lowercasing the key works correctly for case variations of owner/repo.
- **Entry cache-first fetch:** Test that when the D1 cache contains a valid entry, the response matches and no GitHub API call is made. Test that a stale/missing cache entry falls back to GitHub correctly.
- **DB query index correctness:** Integration test that queries for owner/repo using `eq()` with lowercase values return the same results as the previous `lower()` approach — this guards against regressions in case handling.
- **Parallel fetch waterfall:** Test that token and config resolution complete before the GitHub call, and that they were initiated concurrently (i.e. total wall time ≈ max(token, config) rather than sum).

Prior art: the existing cache route tests and `github-cache-file` integration patterns provide the model for asserting cache state changes and fallback behaviour.

## Out of Scope

- Cross-isolate shared cache (e.g. Cloudflare KV or Durable Objects as a shared config cache layer) — the in-memory per-isolate cache is sufficient for the target latency and avoids added infrastructure complexity.
- Changing the GitHub OAuth token storage or refresh strategy.
- Pagination or virtual scrolling for very large collection tables.
- CDN-level caching of API responses (requires careful cache-key design around auth; deferred to a separate initiative).
- Changing the D1 schema in a breaking way — all index fixes must be backward compatible.

## Further Notes

- The biggest single win is item 4 (entries from D1 cache) because it removes a 200–500ms external network call from the critical path of the most-used route. Items 1–3 together save ~50–80ms per request, which compounds across the waterfall but is secondary to avoiding the GitHub round-trip.
- The `lower()` index fix (item 3) should be applied carefully — verify that all write paths are already lowercasing before removing the `lower()` wrappers from reads, or data written before the fix may become unfindable.
- Cloudflare Workers isolate recycling means the in-memory config cache will occasionally cold-start. This is acceptable — cold starts fall back to D1 transparently.
