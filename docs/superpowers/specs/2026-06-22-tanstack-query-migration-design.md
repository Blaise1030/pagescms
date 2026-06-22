# TanStack Query Migration Design

**Date:** 2026-06-22  
**Scope:** Replace SWR with TanStack Query for all client-side data fetching; persist query cache to IndexedDB via the official IDB persister.

---

## 1. Architecture Overview

### What changes
- `PersistQueryClientProvider` wraps the app in `components/providers.tsx`
- `@tanstack/query-idb-persister` serializes the entire TanStack Query cache to a single IDB store, replacing the current manual `file-cache` IDB store
- Every `useSWR` call becomes `useQuery`; every mutating `fetch` gets wrapped in `useMutation` with `onMutate`/`onError`/`onSettled` for optimistic updates
- A new `lib/query-keys.ts` defines a structured query key factory, replacing string-prefix matching (`key.startsWith(collectionKeyPrefix)`) with structured `invalidateQueries({ queryKey: [...] })`
- `lib/idb.ts` drops the `file-cache` store (persister owns that now); `file-drafts` stays untouched

### What stays the same
- All API route handlers (`/api/[owner]/[repo]/[branch]/...`) — no server changes
- The draft system (`file-drafts` in IDB, `saveDraft`/`discard` in `use-entry-store`)
- `lib/api-client.ts` → `requireApiSuccess` helper
- All UI components below the data hooks

### Packages to add
- `@tanstack/react-query`
- `@tanstack/query-persist-client-core`
- `@tanstack/query-idb-persister`

### Files touched
| File | Change |
|---|---|
| `package.json` | Add 3 packages |
| `components/providers.tsx` | Add `PersistQueryClientProvider` + persister |
| `lib/query-keys.ts` | New — query key factory |
| `lib/idb.ts` | Remove `CACHE_STORE` + `getFileCache`/`setFileCache` |
| `hooks/use-entry-store.ts` | Replace `useSWR` → `useQuery` + `useMutation` |
| `components/collection/collection.tsx` | Replace `useSWR` → `useQuery` + mutations |
| `components/entry/entry.tsx` | Replace SWR history → `useQuery` |

---

## 2. Query Keys & Invalidation

### `lib/query-keys.ts`

```typescript
export const queryKeys = {
  entry: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entry', owner, repo, branch, path, name] as const,

  entryHistory: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entryHistory', owner, repo, branch, path, name] as const,

  collection: (owner: string, repo: string, branch: string, name: string, collectionPath: string) =>
    ['collection', owner, repo, branch, name, collectionPath] as const,

  // Invalidates ALL paths under a collection (used after create/delete/rename)
  collectionAll: (owner: string, repo: string, branch: string, name: string) =>
    ['collection', owner, repo, branch, name] as const,
}
```

### Invalidation rules

| Event | Invalidated key |
|---|---|
| Save existing entry | `queryKeys.entry(owner, repo, branch, path, name)` |
| Create new collection entry | `queryKeys.collectionAll(owner, repo, branch, name)` |
| Delete entry | `queryKeys.collectionAll(owner, repo, branch, name)` |
| Rename entry | `queryKeys.collectionAll(owner, repo, branch, name)` |
| Expand subfolder | Covered by optimistic `setQueryData` — no invalidation needed |

---

## 3. IDB Persister & QueryClient Setup

### `components/providers.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h — survive browser restarts for offline viewing
      staleTime: 1000 * 30,          // 30s — fresh window before background refetch
      retry: 1,
    },
  },
})

const persister = createIDBPersister('pagescms-query-cache')
```

- Wrap with `PersistQueryClientProvider` passing `client={queryClient}` and `persistOptions={{ persister }}`
- Use `buster` prop (e.g. app version string) to bust stale IDB data on deploys

### `lib/idb.ts`

The `file-cache` store and its helpers (`getFileCache`, `setFileCache`, `idbCacheKey`) are removed. The `file-drafts` store and its helpers (`getFileDraft`, `setFileDraft`, `deleteFileDraft`) are unchanged. `idbCacheKey` is still needed for draft keys — keep it.

---

## 4. Optimistic Updates

Pattern for all mutations: `onMutate` snapshots + applies optimistic update, `onError` rolls back, `onSettled` always invalidates.

### Save entry (`use-entry-store.ts`)
```
onMutate  → snapshot entry query → setQueryData with new contentObject + sha
onError   → restore snapshot
onSettled → invalidateQueries(entry key)
```

### Create new collection entry (`entry.tsx`)
```
onMutate  → no optimistic update (new path unknown until server responds)
onSettled → invalidateQueries(collectionAll key)
```

### Delete entry (`collection.tsx`)
```
onMutate  → setQueryData: filter item out of collection list
onError   → restore snapshot
onSettled → invalidateQueries(collectionAll key)
```

### Rename entry (`collection.tsx`)
```
onMutate  → setQueryData: update path + name on matching item (recursive for subRows)
onError   → restore snapshot
onSettled → invalidateQueries(collectionAll key)
```

### Expand subfolder (`collection.tsx`)
```
onSuccess → setQueryData: merge subRows into parent item
(no invalidation — data came directly from server)
```

### Save queue note
The current in-flight/pending-flush ref logic in `use-entry-store` (prevents concurrent saves) stays as-is inside the `mutationFn` — TanStack Query's mutation lifecycle does not replace this.

---

## 5. Migration Sequence

1. Install packages
2. Add `lib/query-keys.ts`
3. Update `lib/idb.ts` (remove cache store)
4. Update `components/providers.tsx` (add `PersistQueryClientProvider`)
5. Migrate `hooks/use-entry-store.ts`
6. Migrate `components/collection/collection.tsx`
7. Migrate `components/entry/entry.tsx` (history query)
8. Remove `swr` package from `package.json`
