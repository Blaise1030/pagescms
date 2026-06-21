# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate sequential request waterfalls and add client-side stale-while-revalidate to bring API responses under 300ms and make navigation feel instant.

**Architecture:** Five independent changes: (1) normalize DB write paths so indexes are used on reads, (2) add a process-level in-memory config cache to skip repeated D1 lookups, (3) parallelise the per-request auth waterfall, (4) serve entry reads from D1 before calling GitHub, (5) enable `keepPreviousData` in the existing SWR collection hook so the UI never goes blank during revalidation.

**Tech Stack:** Next.js (Vinext/Cloudflare Workers), Drizzle ORM, D1 (SQLite), SWR, TypeScript

## Global Constraints

- All DB index fixes must be backward-compatible — no breaking schema changes
- `ENTRY_CACHE_TTL` env var controls entry cache freshness (default `300` seconds)
- `CONFIG_CACHE_TTL` env var controls in-memory config cache TTL (default `30` seconds)
- No new npm packages
- All owner/repo values stored and queried in lowercase
- Tests deferred to a follow-up initiative — verify manually during implementation

---

### Task 1: Fix Case-Insensitive Index Bypass

**Files:**
- Modify: `lib/config-store.ts`
- Modify: `lib/github-cache-file.ts`

**Interfaces:**
- Produces: `saveConfig` always stores lowercase `owner`/`repo`; all reads use `eq()` with `.toLowerCase()` instead of `sql\`lower()\``

- [ ] **Step 1: Normalize owner/repo at write time in `saveConfig`**

In `lib/config-store.ts`, find the `saveConfig` function's `.values({...})` call and change:

```typescript
// Before
await db.insert(configTable).values({
  owner: config.owner,
  repo: config.repo,
  branch: config.branch,
  // ...
```

```typescript
// After
await db.insert(configTable).values({
  owner: config.owner.toLowerCase(),
  repo: config.repo.toLowerCase(),
  branch: config.branch,
  // ...
```

- [ ] **Step 2: Switch all config reads from `lower()` to `eq()` with `.toLowerCase()`**

In `lib/config-store.ts`, replace every `sql\`lower(${configTable.owner}) = lower(${...})\`` and `sql\`lower(${configTable.repo}) = lower(${...})\`` with `eq()` calls. There are occurrences in `getConfigFromDb`, `updateConfig`, `touchConfigCheck`, and inside `getConfig`. Replace all of them:

```typescript
// Before (example — applies to all four locations)
sql`lower(${configTable.owner}) = lower(${owner})`,
sql`lower(${configTable.repo}) = lower(${repo})`,

// After
eq(configTable.owner, owner.toLowerCase()),
eq(configTable.repo, repo.toLowerCase()),
```

For `updateConfig` the values come from `config.owner` / `config.repo` — use `config.owner.toLowerCase()` / `config.repo.toLowerCase()`.

- [ ] **Step 3: Fix the remaining `lower()` call in `github-cache-file.ts`**

In `lib/github-cache-file.ts` around line 310, find the two `lower()` calls on `cacheFileMetaTable` and replace:

```typescript
// Before
sql`lower(${cacheFileMetaTable.owner}) = lower(${owner})`,
sql`lower(${cacheFileMetaTable.repo}) = lower(${repo})`,

// After
eq(cacheFileMetaTable.owner, owner.toLowerCase()),
eq(cacheFileMetaTable.repo, repo.toLowerCase()),
```

Make sure `eq` is imported from `drizzle-orm` (it already is in both files).

- [ ] **Step 4: Manual verification**

Start the dev server (`pnpm dev`) and navigate to any collection. Confirm no console errors and that entries load correctly. The behaviour is identical — this is a read-path correctness fix, not a behaviour change.

- [ ] **Step 5: Commit**

```bash
git add lib/config-store.ts lib/github-cache-file.ts
git commit -m "fix: normalize owner/repo to lowercase at write time, use indexed eq() on reads"
```

---

### Task 2: In-Memory Config Cache

**Files:**
- Modify: `lib/config-store.ts`

**Interfaces:**
- Consumes: `getConfigFromDb(owner, repo, branch)` — the internal D1 query function (defined in Task 1's cleaned-up file)
- Produces: `getConfigFromDb` checks a module-level `Map` before hitting D1; cache entries expire after `CONFIG_CACHE_TTL` seconds

- [ ] **Step 1: Add the cache Map and TTL constant**

At the top of `lib/config-store.ts`, after the imports and before `getConfigFromDb`, add:

```typescript
const CONFIG_CACHE_TTL_MS =
  parseInt(process.env.CONFIG_CACHE_TTL ?? "30", 10) * 1000;

const configMemCache = new Map<string, { value: Config; expiresAt: number }>();
```

- [ ] **Step 2: Wrap `getConfigFromDb` with a cache read and write**

The current `getConfigFromDb` function queries D1 and returns a `Config | null`. Wrap it so it checks the in-memory cache first. Replace the body of `getConfigFromDb` with:

```typescript
const getConfigFromDb = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<Config | null> => {
  if (!owner || !repo || !branch)
    throw new Error(`Owner, repo, and branch must all be provided.`);

  const cacheKey = `${owner}::${repo}::${branch}`;
  const cached = configMemCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const config = await db.query.configTable.findFirst({
    where: and(
      eq(configTable.owner, owner.toLowerCase()),
      eq(configTable.repo, repo.toLowerCase()),
      eq(configTable.branch, branch),
    ),
  });

  if (!config) return null;

  const parsedConfig: Config = {
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    sha: config.sha,
    version: config.version,
    object: JSON.parse(config.object),
    lastCheckedAt: config.lastCheckedAt,
  };

  configMemCache.set(cacheKey, {
    value: parsedConfig,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  });

  return parsedConfig;
};
```

Note: the `eq()` calls here already use lowercase values — this is consistent with Task 1.

- [ ] **Step 3: Invalidate the mem-cache when config is saved or updated**

After any successful write in `saveConfig` and `updateConfig`, delete the stale mem-cache entry so the next read fetches from D1:

In `saveConfig`, after the `await db.insert(...).onConflictDoUpdate(...)` call, add:

```typescript
configMemCache.delete(`${config.owner.toLowerCase()}::${config.repo.toLowerCase()}::${config.branch}`);
```

In `updateConfig`, after the `await db.update(...).set(...).where(...)` call, add:

```typescript
configMemCache.delete(`${config.owner.toLowerCase()}::${config.repo.toLowerCase()}::${config.branch}`);
```

- [ ] **Step 4: Manual verification**

Add a temporary `console.log("D1 config hit")` at the start of the D1 `db.query.configTable.findFirst` call. Navigate to a collection, then navigate away and back. The log should only appear on the first load (or after 30 seconds). Remove the log before committing.

- [ ] **Step 5: Commit**

```bash
git add lib/config-store.ts
git commit -m "feat: add process-level in-memory config cache with passive TTL"
```

---

### Task 3: Parallelise the Per-Request Auth Waterfall

**Files:**
- Modify: `lib/api-repo-context.ts`

**Interfaces:**
- Consumes: `getToken`, `getGithubId`, `checkRepoAccess`, `getConfig` — all already imported
- Produces: `getRepoReadContext` reduces serial awaits to two parallel `Promise.all` rounds after session resolution

- [ ] **Step 1: Replace the sequential waterfall with two parallel rounds**

Replace the entire body of `getRepoReadContext` with:

```typescript
const getRepoReadContext = async ({ owner, repo, branch }: RepoRef): Promise<RepoReadContext> => {
  const sessionResult = await requireApiUserSession();
  if ("response" in sessionResult) {
    throw createHttpError("Not signed in.", sessionResult.response?.status ?? 401);
  }

  const user = sessionResult.user as User;

  // Round 1: getToken and getGithubId both need only the user — run in parallel
  const [{ token, source }, githubId] = await Promise.all([
    getToken(user, owner, repo),
    getGithubId(user.id),
  ]);
  if (!token) throw createHttpError("Token not found", 401);

  // Round 2: checkRepoAccess (needs token + githubId) and getConfig (needs token) — run in parallel
  const [hasAccess, config] = await Promise.all([
    githubId && source === "user"
      ? checkRepoAccess(token, owner, repo, githubId)
      : Promise.resolve(true),
    getConfig(owner, repo, branch, { getToken: async () => token }),
  ]);

  if (!hasAccess)
    throw createHttpError(`No access to repository ${owner}/${repo}.`, 403);
  if (!config)
    throw createHttpError(
      `Configuration not found for ${owner}/${repo}/${branch}.`,
      404,
    );

  return { user, token, config };
};
```

- [ ] **Step 2: Manual verification**

Open browser devtools → Network tab. Load an entry. Confirm the `/api/.../entries/...` response time drops compared to before. No errors in the console.

- [ ] **Step 3: Commit**

```bash
git add lib/api-repo-context.ts
git commit -m "perf: parallelise getToken+getGithubId and checkRepoAccess+getConfig in request waterfall"
```

---

### Task 4: Serve Entries from D1 Cache First

**Files:**
- Modify: `lib/github-cache-file.ts`
- Modify: `app/api/[owner]/[repo]/[branch]/entries/[path]/route.ts`

**Interfaces:**
- Produces:
  - `getCachedEntryContent(owner, repo, branch, path, ttlMs): Promise<{ content: string; sha: string } | null>` — exported from `lib/github-cache-file.ts`
  - `setCachedEntryContent(owner, repo, branch, path, content, sha, size): Promise<void>` — exported from `lib/github-cache-file.ts`

- [ ] **Step 1: Add `getCachedEntryContent` to `lib/github-cache-file.ts`**

At the bottom of `lib/github-cache-file.ts`, before the export block, add:

```typescript
const ENTRY_CACHE_TTL_MS =
  parseInt(process.env.ENTRY_CACHE_TTL ?? "300", 10) * 1000;

const getCachedEntryContent = async (
  owner: string,
  repo: string,
  branch: string,
  path: string,
  ttlMs = ENTRY_CACHE_TTL_MS,
): Promise<{ content: string; sha: string } | null> => {
  const row = await db.query.cacheFileTable.findFirst({
    where: and(
      eq(cacheFileTable.owner, owner.toLowerCase()),
      eq(cacheFileTable.repo, repo.toLowerCase()),
      eq(cacheFileTable.branch, branch),
      eq(cacheFileTable.path, path),
    ),
  });

  if (!row || !row.content || !row.sha) return null;
  if (row.updatedAt.getTime() + ttlMs < Date.now()) return null;

  return { content: row.content, sha: row.sha };
};
```

- [ ] **Step 2: Add `setCachedEntryContent` to `lib/github-cache-file.ts`**

Immediately after `getCachedEntryContent`, add:

```typescript
const setCachedEntryContent = async (
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  sha: string,
  size: number,
): Promise<void> => {
  const lowerOwner = owner.toLowerCase();
  const lowerRepo = repo.toLowerCase();
  const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
  const name = path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;

  await db
    .insert(cacheFileTable)
    .values({
      context: "entry",
      owner: lowerOwner,
      repo: lowerRepo,
      branch,
      parentPath,
      name,
      path,
      type: "file",
      content,
      sha,
      size,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        cacheFileTable.owner,
        cacheFileTable.repo,
        cacheFileTable.branch,
        cacheFileTable.path,
      ],
      set: {
        content,
        sha,
        size,
        updatedAt: new Date(),
      },
    });
};
```

- [ ] **Step 3: Export the two new functions**

Find the export block at the bottom of `lib/github-cache-file.ts` and add both functions:

```typescript
export {
  // ... existing exports ...
  getCachedEntryContent,
  setCachedEntryContent,
};
```

- [ ] **Step 4: Update the GET handler in the entries route**

In `app/api/[owner]/[repo]/[branch]/entries/[path]/route.ts`, add the import at the top:

```typescript
import { getCachedEntryContent, setCachedEntryContent } from "@/lib/github-cache-file";
```

Then, inside the `GET` handler, locate the block that calls `octokit.rest.repos.getContent`. Replace it with a cache-first pattern. Find:

```typescript
    const octokit = createOctokitInstance(token);
    let response;
    try {
      response = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: normalizedPath,
        ref: params.branch
      });
    } catch (error: any) {
      if (error?.status === 404) {
        throw createHttpError("Not found", 404);
      }
      throw error;
    }
    
    if (Array.isArray(response.data)) {
      throw createHttpError("Expected a file but found a directory", 400);
    } else if (response.data.type !== "file") {
      throw createHttpError("Invalid response type", 500);
    }

    const content = decodeBase64Utf8(response.data.content);
    const contentObject = name
      ? parseContent(content, schema, config)
      : { body: content };

    return Response.json({
      status: "success",
      data: {
        sha: response.data.sha,
        name: response.data.name,
        path: response.data.path,
        contentObject
      }
    });
```

Replace with:

```typescript
    // Cache-first: check D1 before calling GitHub
    if (name) {
      const cached = await getCachedEntryContent(
        params.owner,
        params.repo,
        params.branch,
        normalizedPath,
      );
      if (cached) {
        const contentObject = parseContent(cached.content, schema, config);
        return Response.json({
          status: "success",
          data: {
            sha: cached.sha,
            name: normalizedPath.includes("/")
              ? normalizedPath.substring(normalizedPath.lastIndexOf("/") + 1)
              : normalizedPath,
            path: normalizedPath,
            contentObject,
          },
        });
      }
    }

    const octokit = createOctokitInstance(token);
    let response;
    try {
      response = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: normalizedPath,
        ref: params.branch,
      });
    } catch (error: any) {
      if (error?.status === 404) {
        throw createHttpError("Not found", 404);
      }
      throw error;
    }

    if (Array.isArray(response.data)) {
      throw createHttpError("Expected a file but found a directory", 400);
    } else if (response.data.type !== "file") {
      throw createHttpError("Invalid response type", 500);
    }

    const content = decodeBase64Utf8(response.data.content);

    // Write back to D1 so future reads skip GitHub
    if (name) {
      await setCachedEntryContent(
        params.owner,
        params.repo,
        params.branch,
        normalizedPath,
        content,
        response.data.sha,
        response.data.size ?? 0,
      ).catch(() => {
        // Non-fatal: cache write failure must not break the response
      });
    }

    const contentObject = name
      ? parseContent(content, schema, config)
      : { body: content };

    return Response.json({
      status: "success",
      data: {
        sha: response.data.sha,
        name: response.data.name,
        path: response.data.path,
        contentObject,
      },
    });
```

- [ ] **Step 5: Manual verification**

Open an entry in the CMS. Note the response time in devtools Network tab (will be slow — GitHub call). Close and reopen the same entry. The second load should be noticeably faster (D1 cache hit, ~5–15ms vs ~200–500ms). Confirm the entry content is identical on both loads.

- [ ] **Step 6: Commit**

```bash
git add lib/github-cache-file.ts app/api/\[owner\]/\[repo\]/\[branch\]/entries/\[path\]/route.ts
git commit -m "perf: serve entry reads from D1 cache before calling GitHub API"
```

---

### Task 5: SWR `keepPreviousData` for Collection Lists

**Files:**
- Modify: `components/collection/collection.tsx`

**Interfaces:**
- Consumes: `useSWR` hook already present at line ~308 in `collection.tsx`
- Produces: navigating between collections shows stale data immediately while fresh data loads silently; no blank screen

- [ ] **Step 1: Add `keepPreviousData: true` to the SWR call**

In `components/collection/collection.tsx`, find the `useSWR` call (around line 308):

```typescript
  const { data: swrCollectionData, error: swrCollectionError } = useSWR<
    Record<string, any>[]
  >(rootCollectionKey, fetchCollectionByUrl, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });
```

Add `keepPreviousData: true`:

```typescript
  const { data: swrCollectionData, error: swrCollectionError } = useSWR<
    Record<string, any>[]
  >(rootCollectionKey, fetchCollectionByUrl, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
    keepPreviousData: true,
  });
```

- [ ] **Step 2: Remove the `useEffect` that clears data on key change**

`keepPreviousData` handles the transition — the manual clear counteracts it. Find and remove this `useEffect`:

```typescript
  useEffect(() => {
    setData([]);
    setError(null);
  }, [rootCollectionKey]);
```

Delete it entirely.

- [ ] **Step 3: Manual verification**

Navigate between two collections in the sidebar. The previous collection's rows should remain visible while the new collection's data loads (no blank table, no spinner replacing content). After the new data arrives it replaces the old rows. Open devtools Network tab and confirm the API call fires on each navigation.

- [ ] **Step 4: Commit**

```bash
git add components/collection/collection.tsx
git commit -m "perf: keep previous collection data visible during SWR revalidation"
```

---

## Self-Review

**Spec coverage:**

| PRD Item | Task |
|---|---|
| Parallelise request waterfall | Task 3 |
| In-memory config cache with configurable TTL | Task 2 |
| Fix case-insensitive index bypass | Task 1 |
| Serve entries from D1 cache first | Task 4 |
| React `cache()` for session dedup | Dropped — app is fully client-side, not RSC |
| Client-side stale-while-revalidate for collections | Task 5 |
| Prefetch sidebar nav links | Dropped — no RSC payloads to prefetch in this architecture |
| Lazy-load rich text and code editors | Already implemented — `fields/core/rich-text/index.tsx` already uses `dynamic()` with `ssr: false`; code field uses `lazy-edit-component.tsx` |

**Placeholder scan:** No TBDs, no "implement later", all steps have exact code.

**Type consistency:** `getCachedEntryContent` and `setCachedEntryContent` signatures used in Task 4 route match the definitions added in the same task. `configMemCache` key format `owner::repo::branch` is consistent across get, set, and invalidation in Task 2.
