# TanStack Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SWR with TanStack Query for all client-side data fetching, with the full query cache persisted to IndexedDB via the official IDB persister and optimistic cache updates on save/delete/rename.

**Architecture:** `PersistQueryClientProvider` wraps the app in `providers.tsx`; a new `lib/query-keys.ts` provides typed structured keys that replace string-prefix `mutate` invalidation; `useQuery` replaces `useSWR` for reads; `useQueryClient` + `invalidateQueries`/`setQueryData` replace `useSWRConfig().mutate`; the old manual `file-cache` IDB store is dropped and replaced by the persister; `file-drafts` store is unchanged.

**Tech Stack:** Next.js 15, React 19, `@tanstack/react-query` v5, `@tanstack/react-query-persist-client`, `@tanstack/query-idb-persister`, `idb` (already installed), Vitest

**Spec:** `docs/superpowers/specs/2026-06-22-tanstack-query-migration-design.md`

---

## Global Constraints

- TanStack Query v5 API only — `useQuery`, `useMutation`, `useQueryClient`, `QueryClient`
- `staleTime: 30_000` (30 s) on all queries
- `gcTime: 86_400_000` (24 h) on QueryClient default
- IDB persister store key: `'pagescms-query-cache'`
- `file-drafts` IDB store and its helpers (`getFileDraft`, `setFileDraft`, `deleteFileDraft`) must not be touched
- `idbCacheKey` must remain exported from `lib/idb.ts` — still used for draft keys
- No server-side route handler changes
- Remove `swr` import from each file in its own task; do not touch other files' SWR imports ahead of their task

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add 3 TQ packages; remove `swr` in Task 5 |
| `lib/query-keys.ts` | **Create** | Typed query key factory |
| `lib/idb.ts` | Modify | Remove `CACHE_STORE`, `getFileCache`, `setFileCache`; bump DB_VERSION to 2 |
| `components/providers.tsx` | Modify | Wrap with `PersistQueryClientProvider` + `createIDBPersister` |
| `hooks/use-entry-store.ts` | Modify | Replace `useSWR` → `useQuery`; expose `mutateEntry` via `invalidateQueries` |
| `components/collection/collection.tsx` | Modify | Replace `useSWR`/`cache`/`mutate` → `useQuery`/`useQueryClient` |
| `components/entry/entry.tsx` | Modify | Replace history `useSWR` and four `mutate(predicate)` calls → `useQuery`/`invalidateQueries` |
| `lib/__tests__/query-keys.test.ts` | **Create** | Tests for query key factory |

---

## Task 1: Packages, query key factory, IDB cleanup, QueryClient setup

**Files:**
- Modify: `package.json`
- Create: `lib/query-keys.ts`
- Modify: `lib/idb.ts`
- Modify: `components/providers.tsx`
- Create: `lib/__tests__/query-keys.test.ts`

**Interfaces:**
- Produces:
  - `queryKeys.entry(owner, repo, branch, path, name)` → `['entry', owner, repo, branch, path, name]`
  - `queryKeys.entryHistory(owner, repo, branch, path, name)` → `['entryHistory', owner, repo, branch, path, name]`
  - `queryKeys.collection(owner, repo, branch, name, collectionPath)` → `['collection', owner, repo, branch, name, collectionPath]`
  - `queryKeys.collectionAll(owner, repo, branch, name)` → `['collection', owner, repo, branch, name]` (prefix of `collection` key — used for broad invalidation)
  - `idbCacheKey`, `getFileDraft`, `setFileDraft`, `deleteFileDraft` still exported from `lib/idb.ts` (unchanged)

- [ ] **Step 1: Install TanStack Query packages**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && pnpm add @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-idb-persister
```

Expected: three entries appear in `dependencies` in `package.json`; `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write failing tests for query key factory**

Create `lib/__tests__/query-keys.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { queryKeys } from '../query-keys'

describe('queryKeys', () => {
  it('entry key contains all segments in order', () => {
    expect(queryKeys.entry('alice', 'blog', 'main', 'posts/hello.md', 'posts'))
      .toEqual(['entry', 'alice', 'blog', 'main', 'posts/hello.md', 'posts'])
  })

  it('entryHistory key contains all segments in order', () => {
    expect(queryKeys.entryHistory('alice', 'blog', 'main', 'posts/hello.md', 'posts'))
      .toEqual(['entryHistory', 'alice', 'blog', 'main', 'posts/hello.md', 'posts'])
  })

  it('collection key contains collectionPath as last element', () => {
    expect(queryKeys.collection('alice', 'blog', 'main', 'posts', 'content/posts'))
      .toEqual(['collection', 'alice', 'blog', 'main', 'posts', 'content/posts'])
  })

  it('collectionAll is a prefix of collection (enables broad invalidation)', () => {
    const all = queryKeys.collectionAll('alice', 'blog', 'main', 'posts')
    const specific = queryKeys.collection('alice', 'blog', 'main', 'posts', 'content/posts')
    expect([...specific].slice(0, all.length)).toEqual([...all])
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm vitest run lib/__tests__/query-keys.test.ts
```

Expected: FAIL — `Cannot find module '../query-keys'`

- [ ] **Step 4: Create `lib/query-keys.ts`**

```typescript
export const queryKeys = {
  entry: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entry', owner, repo, branch, path, name] as const,

  entryHistory: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entryHistory', owner, repo, branch, path, name] as const,

  collection: (owner: string, repo: string, branch: string, name: string, collectionPath: string) =>
    ['collection', owner, repo, branch, name, collectionPath] as const,

  collectionAll: (owner: string, repo: string, branch: string, name: string) =>
    ['collection', owner, repo, branch, name] as const,
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm vitest run lib/__tests__/query-keys.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Update `lib/idb.ts` — remove file-cache store, bump DB version**

Replace the entire file:

```typescript
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pagescms";
const DB_VERSION = 2;
const DRAFT_STORE = "file-drafts";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE);
      },
    });
  }
  return dbPromise;
}

async function idbGet(store: string, key: string): Promise<Record<string, unknown> | undefined> {
  try { return (await getDb()).get(store, key); } catch { return undefined; }
}

async function idbSet(store: string, key: string, value: Record<string, unknown>): Promise<void> {
  try { await (await getDb()).put(store, value, key); } catch { /* non-fatal */ }
}

async function idbDel(store: string, key: string): Promise<void> {
  try { await (await getDb()).delete(store, key); } catch { /* non-fatal */ }
}

export function idbCacheKey(owner: string, repo: string, branch: string, path: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${branch}/${path}`;
}

export const getFileDraft = (key: string) => idbGet(DRAFT_STORE, key);
export const setFileDraft = (key: string, value: Record<string, unknown>) => idbSet(DRAFT_STORE, key, value);
export const deleteFileDraft = (key: string) => idbDel(DRAFT_STORE, key);
```

Note: `DB_VERSION` bumped to 2 so the browser's `upgrade` callback runs for existing users (the old `file-cache` object store is simply not re-created — it will be ignored by the new code).

- [ ] **Step 7: Update `components/providers.tsx` — wrap with `PersistQueryClientProvider`**

Replace the entire file:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "@tanstack/query-idb-persister";
import { ThemeProvider } from "@/components/theme-provider";
import { ActionToastProvider } from "@/contexts/action-toast-context";
import { UserProvider } from "@/contexts/user-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyPointerCursors } from "@/lib/preferences";
import { User } from "@/types/user";

const persister = createIDBPersister("pagescms-query-cache");

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24h — survive browser restarts
        staleTime: 1000 * 30,          // 30s — fresh window before background refetch
        retry: 1,
      },
    },
  });
}

export function Providers({ children, user }: { children: React.ReactNode; user: User | null }) {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) queryClientRef.current = makeQueryClient();

  useEffect(() => { applyPointerCursors(); }, []);

  return (
    <PersistQueryClientProvider
      client={queryClientRef.current}
      persistOptions={{ persister }}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <UserProvider user={user}>
          <TooltipProvider>
            <ActionToastProvider>
              {children}
            </ActionToastProvider>
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
```

- [ ] **Step 8: Verify TypeScript for changed files**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "query-keys|idb\.ts|providers\.tsx"
```

Expected: no errors for those three files. Errors in `use-entry-store.ts`, `collection.tsx`, `entry.tsx` about SWR are expected — they are fixed in Tasks 2–4.

- [ ] **Step 9: Commit**

```bash
git add lib/query-keys.ts lib/__tests__/query-keys.test.ts lib/idb.ts components/providers.tsx package.json pnpm-lock.yaml
git commit -m "feat: add TanStack Query + IDB persister, query key factory, drop file-cache store"
```

---

## Task 2: Migrate `hooks/use-entry-store.ts`

**Files:**
- Modify: `hooks/use-entry-store.ts`

**Interfaces:**
- Consumes from Task 1:
  - `queryKeys.entry(owner, repo, branch, path, name)` from `lib/query-keys.ts`
  - `queryKeys.collectionAll(owner, repo, branch, name)` from `lib/query-keys.ts`
  - `idbCacheKey`, `getFileDraft`, `setFileDraft`, `deleteFileDraft` from `lib/idb.ts`
- Public API (unchanged — callers in `entry.tsx` depend on this shape):
  - `useEntryStore(path, options): UseEntryStoreReturn`
  - All fields on `UseEntryStoreReturn` — same names and types as before

**Key changes:**
- `useSWR` → `useQuery` (enabled only when `path` is set)
- `useSWRConfig().mutate` → `useQueryClient().invalidateQueries` / `setQueryData`
- `mutateEntry` now calls `queryClient.invalidateQueries({ queryKey: entryKey })`
- `setFileCache` call removed (persister owns cache now)
- In-flight queue logic (refs) stays inside the manual `save` callback — unchanged

- [ ] **Step 1: Replace `hooks/use-entry-store.ts` in full**

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  idbCacheKey,
  getFileDraft,
  setFileDraft,
  deleteFileDraft,
} from "@/lib/idb";
import { queryKeys } from "@/lib/query-keys";
import { requireApiSuccess } from "@/lib/api-client";
import type { Config } from "@/types/config";
import type { EntryData } from "@/types/api";

type UseEntryStoreOptions = {
  config: Config;
  name: string;
  schema?: Record<string, unknown> | null;
  schemaType?: string;
  onSave?: (data: Record<string, unknown>) => void;
};

type UseEntryStoreReturn = {
  entry: EntryData | null | undefined;
  hasDraft: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: Error | null;
  save: (contentObject: Record<string, unknown>, savePath: string) => Promise<{ path: string; sha: string }>;
  saveDraft: (values: Record<string, unknown>) => void;
  discard: () => Promise<void>;
  mutateEntry: () => void;
};

export function useEntryStore(
  path: string | undefined,
  { config, name, schema, schemaType, onSave }: UseEntryStoreOptions,
): UseEntryStoreReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const shaRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);
  const pendingFlushRef = useRef<Record<string, unknown> | null>(null);
  const queryClient = useQueryClient();

  const entryKey = path
    ? queryKeys.entry(config.owner, config.repo, config.branch, path, name)
    : null;

  const {
    data: entry,
    error: queryError,
    isLoading,
  } = useQuery<EntryData>({
    queryKey: entryKey ?? ['entry-disabled'],
    queryFn: async () => {
      const url = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path!)}?name=${encodeURIComponent(name)}`;
      const response = await fetch(url);
      const data = await requireApiSuccess<{ data: EntryData }>(response, "Failed to fetch entry");
      const result = data.data as EntryData;

      if (path && result.contentObject) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        const draft = await getFileDraft(key);
        if (draft) setHasDraft(true);
      }

      if (result.sha) shaRef.current = result.sha;
      return result;
    },
    enabled: !!path,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  });

  const mutateEntry = useCallback(() => {
    if (!entryKey) return;
    void queryClient.invalidateQueries({ queryKey: entryKey });
  }, [queryClient, entryKey]);

  const saveDraft = useCallback((values: Record<string, unknown>) => {
    if (!path) return;
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    setHasDraft(true);
    void setFileDraft(key, values);
  }, [config, path]);

  const save = useCallback(async (
    contentObject: Record<string, unknown>,
    savePath: string,
  ): Promise<{ path: string; sha: string }> => {
    if (inFlightRef.current) {
      pendingFlushRef.current = contentObject;
      return { path: savePath, sha: shaRef.current ?? "" };
    }

    inFlightRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: savePath === ".pages.yml" ? "settings" : "content",
            name,
            content: schema && typeof schema === "object" && "list" in schema && schema.list === true
              ? (contentObject as any).listWrapper
              : contentObject,
            sha: shaRef.current,
          }),
        },
      );
      const data = await requireApiSuccess<{ data: { path: string; sha: string } & Record<string, unknown> }>(
        response,
        "Failed to save file",
      );
      const result = { path: data.data.path, sha: data.data.sha };

      shaRef.current = data.data.sha;

      // Optimistically update the cached entry so navigating away and back shows saved content
      if (entryKey) {
        queryClient.setQueryData<EntryData>(entryKey, (prev) =>
          prev ? { ...prev, contentObject, sha: data.data.sha } : prev,
        );
      }

      if (schemaType === "collection") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
        });
      }

      if (path) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        await deleteFileDraft(key);
        setHasDraft(false);
      }

      if (onSave) onSave(data.data);

      const pending = pendingFlushRef.current;
      pendingFlushRef.current = null;
      if (pending) {
        inFlightRef.current = false;
        return save(pending, savePath);
      }

      inFlightRef.current = false;
      setIsSaving(false);
      return result;
    } catch (err) {
      inFlightRef.current = false;
      setIsSaving(false);
      const e = err instanceof Error ? err : new Error("Failed to save file.");
      setError(e);
      throw e;
    }
  }, [config, name, path, schema, schemaType, onSave, queryClient, entryKey]);

  const discard = useCallback(async () => {
    if (!path) return;
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    await deleteFileDraft(key);
    setHasDraft(false);
  }, [config, path]);

  return {
    entry: entry ?? null,
    hasDraft,
    isSaving,
    isLoading: isLoading && !!path,
    error: error ?? (queryError instanceof Error ? queryError : null),
    save,
    saveDraft,
    discard,
    mutateEntry,
  };
}
```

- [ ] **Step 2: Verify TypeScript for this file**

```bash
pnpm tsc --noEmit 2>&1 | grep "use-entry-store"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-entry-store.ts
git commit -m "feat: migrate use-entry-store to TanStack Query"
```

---

## Task 3: Migrate `components/collection/collection.tsx`

**Files:**
- Modify: `components/collection/collection.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `queryKeys.collection(owner, repo, branch, name, collectionPath)` from `lib/query-keys.ts`
  - `queryKeys.collectionAll(owner, repo, branch, name)` from `lib/query-keys.ts`
- Replaces (remove these): `useSWR`, `useSWRConfig` from `"swr"` (line 69)
- Adds: `useQuery`, `useQueryClient` from `"@tanstack/react-query"`, `queryKeys` from `"@/lib/query-keys"`

**Key changes (by line reference):**
- Line 69: swap imports
- Line 182: `const { cache, mutate } = useSWRConfig()` → `const queryClient = useQueryClient()`
- Lines 300–311: replace `useSWR(rootCollectionKey, ...)` + implicit `setData` effect with `useQuery` + explicit `useEffect`
- Lines 327–334 in `fetchCollectionData`: replace `cache.get(apiUrl)` check and `await mutate(apiUrl, rows, ...)` with `queryClient.getQueryData` and `queryClient.setQueryData`
- Lines 349–352: remove `cache` and `mutate` from the dependency array; add `queryClient`

- [ ] **Step 1: Swap the SWR import for TanStack Query**

At line 69, replace:
```typescript
import useSWR, { useSWRConfig } from "swr";
```
with:
```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace `useSWRConfig()` destructure with `useQueryClient()`**

At line 182, replace:
```typescript
const { cache, mutate } = useSWRConfig();
```
with:
```typescript
const queryClient = useQueryClient();
```

- [ ] **Step 3: Replace the `useSWR` call and its `setData` effect**

Find the block starting around line 296 (`const rootCollectionKey = ...`) through line 311 (`setData(swrCollectionData)`). Replace the entire block:

```typescript
// Before (remove all of this):
const rootCollectionKey = useMemo(
  () => buildCollectionApiUrl(collectionPath),
  [buildCollectionApiUrl, collectionPath],
)
const { data: swrCollectionData, error: swrCollectionError } = useSWR<
  ...
>(rootCollectionKey, fetchCollectionByUrl, {
  ...
})
// ...effect that calls setData(swrCollectionData)
```

```typescript
// After:
const rootCollectionKey = useMemo(
  () => queryKeys.collection(config.owner, config.repo, config.branch, name, collectionPath),
  [config.owner, config.repo, config.branch, name, collectionPath],
);

const { data: queryCollectionData, error: queryCollectionError } = useQuery({
  queryKey: rootCollectionKey,
  queryFn: () => fetchCollectionByUrl(buildCollectionApiUrl(collectionPath)),
  staleTime: 30_000,
});

useEffect(() => {
  if (queryCollectionData) setData(queryCollectionData);
}, [queryCollectionData]);
```

Also rename any use of `swrCollectionError` to `queryCollectionError` throughout the component.

- [ ] **Step 4: Update `fetchCollectionData` — replace `cache.get` and `mutate` calls**

Inside `fetchCollectionData` (around lines 324–352), replace:

```typescript
// Remove:
const cachedValue = cache.get(apiUrl) as { data?: Record<string, any>[] } | undefined;
if (cachedValue?.data) return cachedValue.data;

const rows = await fetchCollectionByUrl(apiUrl);
await mutate(apiUrl, rows, { revalidate: false });
return rows;
```

```typescript
// Add:
const subKey = queryKeys.collection(config.owner, config.repo, config.branch, name, fetchPath);
const cached = queryClient.getQueryData<Record<string, any>[]>(subKey);
if (cached) return cached;

const rows = await fetchCollectionByUrl(apiUrl);
queryClient.setQueryData(subKey, rows);
return rows;
```

Update the `useCallback` dependency array — remove `cache` and `mutate`, add `queryClient`:

```typescript
[
  buildCollectionApiUrl,
  queryClient,
  fetchCollectionByUrl,
  path,
  schema.path,
  config.owner,
  config.repo,
  config.branch,
  name,
]
```

- [ ] **Step 5: Verify TypeScript for this file**

```bash
pnpm tsc --noEmit 2>&1 | grep "collection.tsx"
```

Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add components/collection/collection.tsx
git commit -m "feat: migrate collection component to TanStack Query"
```

---

## Task 4: Migrate `components/entry/entry.tsx`

**Files:**
- Modify: `components/entry/entry.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `queryKeys.entryHistory(owner, repo, branch, path, name)` from `lib/query-keys.ts`
  - `queryKeys.collectionAll(owner, repo, branch, name)` from `lib/query-keys.ts`
- Replaces (remove): `useSWR`, `useSWRConfig` from `"swr"` (line 74)
- Adds: `useQuery`, `useQueryClient` from `"@tanstack/react-query"`, `queryKeys` from `"@/lib/query-keys"`

**Key changes (by line reference):**
- Line 74: swap imports
- Line 155: `const { mutate } = useSWRConfig()` → `const queryClient = useQueryClient()`
- Lines 329–356: replace `historyKey` memo + `fetchEntryHistory` callback + `useSWR(historyKey, ...)` with `useQuery`
- Lines 427–428, 487–488, 568–569, 580–581: replace each `mutate(predicate)` call with `queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(...) })`

- [ ] **Step 1: Swap the SWR import**

At line 74, replace:
```typescript
import useSWR, { useSWRConfig } from "swr";
```
with:
```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace `useSWRConfig()` destructure**

At line 155, replace:
```typescript
const { mutate } = useSWRConfig();
```
with:
```typescript
const queryClient = useQueryClient();
```

- [ ] **Step 3: Replace the history `useSWR` block**

Find the block around lines 329–356 (`historyApiUrl` memo → `historyKey` memo → `fetchEntryHistory` callback → `useSWR` call). Replace the whole block:

```typescript
// Remove all of:
const historyApiUrl = useMemo(() => ( ... ), [...]);
const historyKey = useMemo(
  () => (historyApiUrl && historyEverActivated.current) ? [historyApiUrl, sha ?? ""] as const : null,
  [historyApiUrl, sha, activeTab],
);
const fetchEntryHistory = useCallback(async ([apiUrl]: ...) => {
  const response = await fetch(apiUrl);
  ...
}, []);
const { data: historyData } = useSWR<EntryHistoryItem[]>(
  historyKey,
  fetchEntryHistory,
  { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000 },
);
```

```typescript
// Add:
const historyApiUrl = useMemo(() => (
  path
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path)}/history?name=${encodeURIComponent(name)}`
    : null
), [config.owner, config.repo, config.branch, path, name]);

// Use activeTab in the enabled flag so the query re-enables on tab switch.
// sha is included in the query key so history refetches after a save changes the sha.
const historyEnabled = activeTab === "history" && !!path && !!historyApiUrl;

const { data: historyData } = useQuery<EntryHistoryItem[]>({
  queryKey: historyEnabled
    ? [...queryKeys.entryHistory(config.owner, config.repo, config.branch, path!, name), sha ?? '']
    : ['entryHistory-disabled'],
  queryFn: async () => {
    const response = await fetch(historyApiUrl!);
    const data = await requireApiSuccess<any>(response, "Failed to fetch entry's history");
    return data.data as EntryHistoryItem[];
  },
  enabled: historyEnabled,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 30_000,
});
```

Note: `historyEverActivated.current` was previously used to keep history loaded after first visit. With TanStack Query, data persists in the cache for the full `gcTime` (24 h), so switching back to the content tab and then returning to history reuses the cached data without re-fetching (within `staleTime`). You can safely remove the `historyEverActivated` ref and its update logic if it exists only to control the SWR key.

- [ ] **Step 4: Replace the four `mutate(predicate)` calls**

There are four places (lines 427–428, 487–488, 568–569, 580–581) that do:
```typescript
const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
```

Replace each pair with:
```typescript
void queryClient.invalidateQueries({
  queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
});
```

Also remove `mutate` from the dependency arrays of `handleSave`, `handleDelete`, and `handleRename` callbacks; add `queryClient`.

- [ ] **Step 5: Verify TypeScript for this file**

```bash
pnpm tsc --noEmit 2>&1 | grep "entry.tsx"
```

Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add components/entry/entry.tsx
git commit -m "feat: migrate entry history query and collection invalidation to TanStack Query"
```

---

## Task 5: Remove SWR, full verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Confirm zero remaining SWR imports**

```bash
grep -rn "from ['\"]swr['\"]" /Users/blaisetiong/Developer/projects/cms/pagescms --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

Expected: no output

- [ ] **Step 2: Remove the SWR package**

```bash
pnpm remove swr
```

Expected: `swr` removed from `package.json` dependencies and `pnpm-lock.yaml`

- [ ] **Step 3: Full TypeScript check**

```bash
pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run
```

Expected: all tests pass including `lib/__tests__/query-keys.test.ts`

- [ ] **Step 5: Start dev server and verify manually**

```bash
pnpm dev
```

In the browser, check each of the following:

1. **Collection loads** — navigate to any collection; items render with no console errors
2. **Entry loads** — open any entry; form fields populate
3. **Save entry** — edit a field and save; no error toast; collection list reflects change after navigating back
4. **Delete entry** — delete an item; it disappears from the list
5. **Rename entry** — rename an item; updated name appears in list
6. **History tab** — open an entry, switch to History; commit history loads
7. **IDB persisted cache** — open DevTools → Application → IndexedDB; confirm `pagescms-query-cache` store exists with data
8. **Hard refresh** — refresh the page; data loads from persisted cache instantly (no loading flash for recently visited pages)
9. **Draft flow** — edit without saving, reload; draft banner still appears (file-drafts store untouched)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove swr, complete TanStack Query migration"
```
