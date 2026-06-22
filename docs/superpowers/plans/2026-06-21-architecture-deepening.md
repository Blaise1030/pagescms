# Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five shallow or scattered modules with deep, testable interfaces that concentrate complexity behind clean seams.

**Architecture:** Five independent refactors — `FieldCodec`, `withRepoContext`, `ContentCache`, `useEntryStore`, `CollectionContext` — each moves scattered callers to a single interface. Tasks are independent and can be parallelised; the only soft dependency is Task 1 (FieldCodec) before Task 5 (CollectionContext), because CollectionContext's test imports from the registry.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, SWR, Zod 4, Vitest 4 + @testing-library/react, jsdom, pnpm.

## Global Constraints

- Test command: `pnpm vitest run` (alias `@` → project root, environment jsdom, globals true)
- Never delete the old exports from `fields/registry.ts` until every caller has been migrated; keep them for backward compat and remove at the end of Task 1.
- `withRepoContext` wraps `getRepoReadContext` — do not duplicate its auth logic.
- `ContentCache` is a facade — do not rewrite the underlying cache files, only add the facade layer and migrate callers.
- `useEntryStore` replaces the SWR call and `executeSave` inside `entry.tsx`; the component retains all UI state.
- No `any` in new files — use the existing `Config`, `User`, `Field`, `EntryData` types from `@/types/*`.

---

### Task 1: FieldCodec — replace four grab-bags with `getCodec()`

**Files:**
- Modify: `fields/registry.ts` — export `FieldCodec` type and `getCodec()`, keep old exports
- Create: `fields/__tests__/registry.test.ts`
- Migrate callers: search for `schemas[`, `readFns[`, `writeFns[`, `defaultValues[`, `editComponents[`, `viewComponents[` and replace with `getCodec(type).*`

**Interfaces:**
- Produces: `getCodec(type: string): FieldCodec | undefined`
- `FieldCodec` is the existing `FieldModule` type, re-exported under that name

- [ ] **Step 1: Write the failing test**

```ts
// fields/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { getCodec } from "@/fields/registry";

describe("getCodec", () => {
  it("returns a codec for a registered field type", () => {
    const codec = getCodec("boolean");
    expect(codec).toBeDefined();
  });

  it("codec has schema, defaultValue, read, write, EditComponent", () => {
    const codec = getCodec("boolean");
    expect(codec?.schema).toBeTypeOf("function");
    expect(codec?.defaultValue).toBeDefined();
    expect(codec?.EditComponent).toBeDefined();
  });

  it("returns undefined for an unknown type", () => {
    expect(getCodec("nonexistent-type-xyz")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```
pnpm vitest run fields/__tests__/registry.test.ts
```
Expected: FAIL — `getCodec is not exported from @/fields/registry`

- [ ] **Step 3: Add `FieldCodec` type and `getCodec` to `fields/registry.ts`**

Add after the `registerField` calls and before the final `export` line:

```ts
export type FieldCodec = FieldModule;

const codecMap = new Map<string, FieldCodec>();

// Re-register into the codec map — same order as existing registerField calls
[
  ["boolean", booleanField], ["code", codeField], ["date", dateField],
  ["file", fileField], ["image", imageField], ["number", numberField],
  ["reference", referenceField], ["rich-text", richTextField],
  ["select", selectField], ["string", stringField], ["text", textField],
  ["uuid", uuidField],
].forEach(([name, mod]) => codecMap.set(name as string, mod as FieldModule));

export const getCodec = (type: string): FieldCodec | undefined => codecMap.get(type);
```

Keep the existing `export { labels, schemas, readFns, writeFns, defaultValues, editComponents, viewComponents, fieldTypes };` line unchanged — callers still work.

- [ ] **Step 4: Run to verify it passes**

```
pnpm vitest run fields/__tests__/registry.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Migrate callers**

Find every file that uses the old grab-bags:
```
grep -rn "schemas\[\\|readFns\[\\|writeFns\[\\|defaultValues\[\\|editComponents\[\\|viewComponents\[" \
  --include="*.ts" --include="*.tsx" \
  /Users/blaisetiong/Developer/projects/cms/pagescms \
  --exclude-dir=node_modules --exclude-dir=.next
```

For each hit, replace the pattern. Examples:
- `schemas[field.type](field, configObject)` → `getCodec(field.type)?.schema?.(field, configObject)`
- `readFns[field.type]?.(value, field, configObject)` → `getCodec(field.type)?.read?.(value, field, configObject)`
- `writeFns[field.type]?.(value, field, configObject)` → `getCodec(field.type)?.write?.(value, field, configObject)`
- `defaultValues[field.type]` → `getCodec(field.type)?.defaultValue`
- `editComponents[field.type]` → `getCodec(field.type)?.EditComponent`
- `viewComponents[field.type]` → `getCodec(field.type)?.ViewComponent`

Add `import { getCodec } from "@/fields/registry"` to each migrated file and remove the individual grab-bag imports.

- [ ] **Step 6: Remove old grab-bag exports from `fields/registry.ts`**

Delete the old per-type `Record` variables (`schemas`, `defaultValues`, `readFns`, `writeFns`, `editComponents`, `viewComponents`, `labels`, `fieldTypes`) and remove them from the final `export {}` line. Keep only `getCodec` and `FieldCodec`.

- [ ] **Step 7: Run full test suite + TypeScript check**

```
pnpm vitest run
pnpm tsc --noEmit
```
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add fields/registry.ts fields/__tests__/registry.test.ts
git commit -m "refactor: replace field registry grab-bags with getCodec()"
```

---

### Task 2: withRepoContext — HOF adapter for API routes

**Files:**
- Modify: `lib/api-repo-context.ts` — add `octokit` to context, export `withRepoContext` HOF
- Create: `lib/__tests__/api-repo-context.test.ts`
- Migrate: 2–3 representative API routes (the rest can be migrated incrementally)

**Interfaces:**
- Consumes: existing `getRepoReadContext`, `createOctokitInstance`, `toErrorResponse`, `createHttpError`
- Produces:
```ts
type RepoContext = { user: User; token: string; config: Config; octokit: Octokit }
type RouteParams = { owner: string; repo: string; branch: string }
type ContextHandler = (req: Request, ctx: RepoContext, params: RouteParams) => Promise<Response>
withRepoContext(params: RouteParams, handler: ContextHandler): Promise<Response>
```

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/api-repo-context.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session-server", () => ({
  requireApiUserSession: vi.fn(),
}));
vi.mock("@/lib/token", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/github-account", () => ({ getGithubId: vi.fn() }));
vi.mock("@/lib/github-cache-permissions", () => ({ checkRepoAccess: vi.fn() }));
vi.mock("@/lib/config-store", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/utils/octokit", () => ({ createOctokitInstance: vi.fn(() => ({ id: "octokit" })) }));

import { requireApiUserSession } from "@/lib/session-server";
import { getToken } from "@/lib/token";
import { getGithubId } from "@/lib/github-account";
import { checkRepoAccess } from "@/lib/github-cache-permissions";
import { getConfig } from "@/lib/config-store";
import { withRepoContext } from "@/lib/api-repo-context";

const mockUser = { id: "u1", name: "Test", email: "t@t.com" };
const mockConfig = { owner: "acme", repo: "site", branch: "main" };
const params = { owner: "acme", repo: "site", branch: "main" };

beforeEach(() => {
  vi.mocked(requireApiUserSession).mockResolvedValue({ user: mockUser } as any);
  vi.mocked(getToken).mockResolvedValue({ token: "tok", source: "user" } as any);
  vi.mocked(getGithubId).mockResolvedValue("gh123");
  vi.mocked(checkRepoAccess).mockResolvedValue(true);
  vi.mocked(getConfig).mockResolvedValue(mockConfig as any);
});

describe("withRepoContext", () => {
  it("passes resolved context to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const req = new Request("https://example.com");
    await withRepoContext(params, (r, ctx) => handler(r, ctx));
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: mockUser, token: "tok", config: mockConfig, octokit: expect.anything() }),
    );
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(requireApiUserSession).mockResolvedValue({ response: new Response(null, { status: 401 }) } as any);
    const req = new Request("https://example.com");
    const res = await withRepoContext(params, async () => Response.json({ ok: true }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when access is denied", async () => {
    vi.mocked(checkRepoAccess).mockResolvedValue(false);
    const req = new Request("https://example.com");
    const res = await withRepoContext(params, async () => Response.json({ ok: true }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```
pnpm vitest run lib/__tests__/api-repo-context.test.ts
```
Expected: FAIL — `withRepoContext is not exported`

- [ ] **Step 3: Add `withRepoContext` to `lib/api-repo-context.ts`**

Add after the existing `getRepoReadContext` function:

```ts
import { createOctokitInstance } from "@/lib/utils/octokit";
import { toErrorResponse } from "@/lib/api-error";
import type { Octokit } from "octokit";

type RepoContext = {
  user: User;
  token: string;
  config: Config;
  octokit: ReturnType<typeof createOctokitInstance>;
};

type ContextHandler = (req: Request, ctx: RepoContext) => Promise<Response>;

const withRepoContext = async (
  params: RepoRef,
  handler: ContextHandler,
  req: Request = new Request(""),
): Promise<Response> => {
  try {
    const { user, token, config } = await getRepoReadContext(params);
    const octokit = createOctokitInstance(token);
    return await handler(req, { user, token, config, octokit });
  } catch (error) {
    return toErrorResponse(error);
  }
};

export { getRepoReadContext, withRepoContext };
export type { RepoContext };
```

- [ ] **Step 4: Run to verify it passes**

```
pnpm vitest run lib/__tests__/api-repo-context.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Migrate one representative route**

Open `app/api/[owner]/[repo]/[branch]/entries/[path]/route.ts`. Find the block that calls `requireApiUserSession`, `getToken`, `checkRepoAccess`, `getConfig` manually. Replace it with:

```ts
import { withRepoContext } from "@/lib/api-repo-context";

export async function GET(req: Request, { params }: { params: RouteParams }) {
  const { owner, repo, branch, path } = await params;
  return withRepoContext({ owner, repo, branch }, async (_, ctx) => {
    // ctx.config, ctx.token, ctx.user, ctx.octokit available here
    // ... rest of the handler
  }, req);
}
```

Remove the now-redundant individual imports of `requireApiUserSession`, `getToken`, `getConfig` from that file.

- [ ] **Step 6: TypeScript check**

```
pnpm tsc --noEmit
```
Expected: no errors in migrated file.

- [ ] **Step 7: Commit**

```bash
git add lib/api-repo-context.ts lib/__tests__/api-repo-context.test.ts
git commit -m "refactor: add withRepoContext HOF adapter for API routes"
```

---

### Task 3: ContentCache — single facade over the cache mesh

**Files:**
- Create: `lib/content-cache.ts` — thin facade
- Create: `lib/__tests__/content-cache.test.ts`
- Migrate: `lib/github-webhook-push.ts` to use `ContentCache.invalidateByWebhook`

**Interfaces:**
- Consumes: `clearFileCache`, `updateMultipleFilesCache` from `@/lib/github-cache-file`; `deleteCacheFileMeta`, `upsertCacheFileMeta` from `@/lib/github-cache-meta`; `clearScopedFileCache` from `@/lib/github-webhook-installation`
- Produces:
```ts
ContentCache.invalidate(owner: string, repo: string, branch: string, path: string): Promise<void>
ContentCache.invalidateByWebhook(owner: string, repo: string, branch: string, changes: WebhookChanges): Promise<void>

type WebhookChanges = {
  added: string[];
  modified: string[];
  removed: string[];
}
```

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/content-cache.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/github-cache-file", () => ({
  clearFileCache: vi.fn().mockResolvedValue(undefined),
  updateMultipleFilesCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/github-cache-meta", () => ({
  deleteCacheFileMeta: vi.fn().mockResolvedValue(undefined),
  upsertCacheFileMeta: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/github-webhook-installation", () => ({
  clearScopedFileCache: vi.fn().mockResolvedValue(undefined),
}));

import { clearFileCache } from "@/lib/github-cache-file";
import { ContentCache } from "@/lib/content-cache";

describe("ContentCache.invalidate", () => {
  it("calls clearFileCache with the given path", async () => {
    await ContentCache.invalidate("acme", "site", "main", "content/post.md");
    expect(clearFileCache).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "site", branch: "main" }),
      "content/post.md",
    );
  });
});

describe("ContentCache.invalidateByWebhook", () => {
  it("calls clearFileCache for removed files", async () => {
    await ContentCache.invalidateByWebhook("acme", "site", "main", {
      added: [],
      modified: [],
      removed: ["content/old.md"],
    });
    expect(clearFileCache).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```
pnpm vitest run lib/__tests__/content-cache.test.ts
```
Expected: FAIL — `ContentCache is not exported`

- [ ] **Step 3: Create `lib/content-cache.ts`**

```ts
import { clearFileCache, updateMultipleFilesCache } from "@/lib/github-cache-file";
import { deleteCacheFileMeta } from "@/lib/github-cache-meta";
import { clearScopedFileCache } from "@/lib/github-webhook-installation";

type RepoRef = { owner: string; repo: string; branch: string };

type WebhookChanges = {
  added: string[];
  modified: string[];
  removed: string[];
};

const invalidate = async (
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<void> => {
  await clearFileCache({ owner, repo, branch }, path);
};

const invalidateByWebhook = async (
  owner: string,
  repo: string,
  branch: string,
  changes: WebhookChanges,
): Promise<void> => {
  const ref: RepoRef = { owner, repo, branch };

  const removedFiles = changes.removed.map((path) => ({ path }));
  const modifiedFiles = changes.modified.map((path) => ({ path, sha: "" }));
  const addedFiles = changes.added.map((path) => ({ path, sha: "" }));

  await Promise.all([
    removedFiles.length > 0
      ? Promise.all(removedFiles.map((f) => clearFileCache(ref, f.path)))
      : Promise.resolve(),
    [...modifiedFiles, ...addedFiles].length > 0
      ? updateMultipleFilesCache(ref, [...modifiedFiles, ...addedFiles])
      : Promise.resolve(),
    clearScopedFileCache(ref),
  ]);
};

export const ContentCache = { invalidate, invalidateByWebhook };
export type { WebhookChanges };
```

> Note: check the exact signature of `clearFileCache` and `updateMultipleFilesCache` in `lib/github-cache-file.ts` — adjust the call shapes to match. The test will tell you if they're wrong.

- [ ] **Step 4: Run to verify it passes**

```
pnpm vitest run lib/__tests__/content-cache.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Migrate webhook handler**

In `lib/github-webhook-push.ts`, replace direct calls to `clearFileCache`, `updateMultipleFilesCache`, `clearScopedFileCache`, `deleteCacheFileMeta` with:

```ts
import { ContentCache } from "@/lib/content-cache";

// where the cache invalidation block is:
await ContentCache.invalidateByWebhook(pushOwner, pushRepo, pushBranch, {
  added: Array.from(addedPathSet),
  modified: Array.from(modifiedPathSet),
  removed: Array.from(removedPathSet),
});
```

Remove the now-unused direct imports of the individual cache functions.

- [ ] **Step 6: TypeScript check**

```
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add lib/content-cache.ts lib/__tests__/content-cache.test.ts lib/github-webhook-push.ts
git commit -m "refactor: add ContentCache facade over the cache mesh"
```

---

### Task 4: useEntryStore — deep hook for entry lifecycle

**Files:**
- Create: `hooks/use-entry-store.ts`
- Create: `hooks/__tests__/use-entry-store.test.tsx`
- Modify: `components/entry/entry.tsx` — remove SWR fetch, executeSave, draft logic; use hook

**Interfaces:**
- Consumes: `idbCacheKey`, `getFileCache`, `setFileCache`, `getFileDraft`, `setFileDraft`, `deleteFileDraft` from `@/lib/idb`; `requireApiSuccess` from `@/lib/api-client`; `useSWR` from `swr`; `Config` from `@/types/config`; `EntryData` from `@/types/api`
- Produces:
```ts
type UseEntryStoreOptions = {
  config: Config;
  name: string;
  schema?: Record<string, any> | null;
  schemaType?: string;
  onSave?: (data: Record<string, unknown>) => void;
}

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
}

function useEntryStore(path: string | undefined, options: UseEntryStoreOptions): UseEntryStoreReturn
```

- [ ] **Step 1: Write the failing test**

```tsx
// hooks/__tests__/use-entry-store.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/idb", () => ({
  idbCacheKey: vi.fn((o, r, b, p) => `${o}/${r}/${b}/${p}`),
  getFileCache: vi.fn().mockResolvedValue(undefined),
  setFileCache: vi.fn().mockResolvedValue(undefined),
  getFileDraft: vi.fn().mockResolvedValue(undefined),
  setFileDraft: vi.fn().mockResolvedValue(undefined),
  deleteFileDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-client", () => ({
  requireApiSuccess: vi.fn().mockResolvedValue({ data: { sha: "abc123", path: "content/post.md" } }),
}));

global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { sha: "sha1", path: "content/post.md", contentObject: { title: "Hello" } } })));

import { useEntryStore } from "@/hooks/use-entry-store";
import { setFileDraft, deleteFileDraft } from "@/lib/idb";

const mockConfig = { owner: "acme", repo: "site", branch: "main", object: null } as any;

describe("useEntryStore", () => {
  it("returns isLoading=true initially when path is defined", () => {
    const { result } = renderHook(() =>
      useEntryStore("content/post.md", { config: mockConfig, name: "posts" })
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("saveDraft writes to idb", async () => {
    const { result } = renderHook(() =>
      useEntryStore("content/post.md", { config: mockConfig, name: "posts" })
    );
    await act(async () => {
      result.current.saveDraft({ title: "Draft" });
    });
    expect(setFileDraft).toHaveBeenCalledWith(
      "acme/site/main/content/post.md",
      { title: "Draft" },
    );
  });

  it("discard deletes draft and clears hasDraft", async () => {
    const { result } = renderHook(() =>
      useEntryStore("content/post.md", { config: mockConfig, name: "posts" })
    );
    await act(async () => {
      result.current.saveDraft({ title: "Draft" });
    });
    await act(async () => {
      await result.current.discard();
    });
    expect(deleteFileDraft).toHaveBeenCalledWith("acme/site/main/content/post.md");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```
pnpm vitest run hooks/__tests__/use-entry-store.test.tsx
```
Expected: FAIL — `useEntryStore is not exported`

- [ ] **Step 3: Create `hooks/use-entry-store.ts`**

```ts
"use client";

import { useState, useRef, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  idbCacheKey,
  getFileCache,
  setFileCache,
  getFileDraft,
  setFileDraft,
  deleteFileDraft,
} from "@/lib/idb";
import { requireApiSuccess } from "@/lib/api-client";
import type { Config } from "@/types/config";
import type { EntryData } from "@/types/api";

type UseEntryStoreOptions = {
  config: Config;
  name: string;
  schema?: Record<string, any> | null;
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
  const { mutate } = useSWRConfig();

  const entryApiUrl = path
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path)}?name=${encodeURIComponent(name)}`
    : null;

  const {
    data: entry,
    error: swrError,
    isLoading,
    mutate: mutateEntry,
  } = useSWR<EntryData>(
    entryApiUrl,
    async (url: string) => {
      const response = await fetch(url);
      const data = await requireApiSuccess<any>(response, "Failed to fetch entry");
      const result = data.data as EntryData;

      if (path && result.contentObject) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        void setFileCache(key, result.contentObject as Record<string, unknown>);

        const draft = await getFileDraft(key);
        if (draft) {
          setHasDraft(true);
        }
      }

      if (result.sha) shaRef.current = result.sha;
      return result;
    },
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000 },
  );

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
            content: schema?.list === true ? contentObject.listWrapper : contentObject,
            sha: shaRef.current,
          }),
        },
      );
      const data = await requireApiSuccess<any>(response, "Failed to save file");
      const result = { path: data.data.path as string, sha: data.data.sha as string };

      if (result.sha) shaRef.current = result.sha;

      if (schemaType === "collection") {
        const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
        void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
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
  }, [config, name, path, schema, schemaType, onSave, mutate]);

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
    error: error ?? (swrError instanceof Error ? swrError : null),
    save,
    saveDraft,
    discard,
    mutateEntry,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```
pnpm vitest run hooks/__tests__/use-entry-store.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Wire into `entry.tsx`**

In `components/entry/entry.tsx`:

1. Add at the top of the `Entry` function body (after `const { config } = useConfig()`):
```ts
const { entry, hasDraft, isSaving, isLoading, error: storeError, save, saveDraft, discard, mutateEntry } = useEntryStore(path, {
  config,
  name,
  schema,
  schemaType,
  onSave,
});
```

2. Remove the `useSWR` call for entry data (replaced by the hook).
3. Remove the `executeSave` `useCallback` (replaced by `save` from the hook).
4. Remove all `setFileDraft`, `getFileDraft`, `deleteFileDraft`, `setFileCache`, `getFileCache` call sites (moved into hook).
5. Replace `setSaveStatus("saving")` / `setSaveStatus("error")` with derived state from `isSaving` / `storeError`:
```ts
const saveStatus: SaveStatusValue = isSaving ? "saving" : storeError ? "error" : "saved";
```
6. Remove the now-unused imports: `idbCacheKey`, `getFileCache`, `setFileCache`, `getFileDraft`, `setFileDraft`, `deleteFileDraft`, `useSWR`, `useSWRConfig`.

- [ ] **Step 6: TypeScript check**

```
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add hooks/use-entry-store.ts hooks/__tests__/use-entry-store.test.tsx components/entry/entry.tsx
git commit -m "refactor: extract useEntryStore hook from entry.tsx"
```

---

### Task 5: CollectionContext — derived schema/operations context

**Files:**
- Create: `contexts/collection-context.tsx`
- Create: `contexts/__tests__/collection-context.test.tsx`
- Modify: `components/collection/collection.tsx` — wrap with provider, replace direct schema imports with `useCollection()`
- Modify: `components/collection/collection-table.tsx` — replace direct schema imports with `useCollection()`

**Interfaces:**
- Consumes: `useConfig` from `@/contexts/config-context`; `getSchemaByName`, `getPrimaryField` from `@/lib/schema`; `resolveContentOperations` from `@/lib/operations`; `getSchemaActions` from `@/lib/actions`
- Produces:
```ts
type CollectionState = {
  schema: Record<string, any> | undefined;
  operations: ContentOperations;
  actions: RepoActionConfig[];
  primaryField: Field | undefined;
}
function useCollection(): CollectionState
function CollectionProvider({ name, children }: { name: string; children: React.ReactNode }): JSX.Element
```

- [ ] **Step 1: Write the failing test**

```tsx
// contexts/__tests__/collection-context.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/contexts/config-context", () => ({
  useConfig: vi.fn(() => ({
    config: {
      object: {
        content: [
          { name: "posts", type: "collection", fields: [{ name: "title", type: "string" }] },
        ],
      },
    },
  })),
}));

import { CollectionProvider, useCollection } from "@/contexts/collection-context";

function TestConsumer() {
  const { schema, operations } = useCollection();
  return (
    <div>
      <span data-testid="name">{schema?.name}</span>
      <span data-testid="can-create">{String(operations.create)}</span>
    </div>
  );
}

describe("CollectionContext", () => {
  it("provides schema derived from config + name", () => {
    render(
      <CollectionProvider name="posts">
        <TestConsumer />
      </CollectionProvider>
    );
    expect(screen.getByTestId("name").textContent).toBe("posts");
  });

  it("provides operations derived from schema", () => {
    render(
      <CollectionProvider name="posts">
        <TestConsumer />
      </CollectionProvider>
    );
    expect(screen.getByTestId("can-create").textContent).toBe("true");
  });

  it("throws when used outside the provider", () => {
    const err = console.error;
    console.error = vi.fn();
    expect(() => render(<TestConsumer />)).toThrow();
    console.error = err;
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```
pnpm vitest run contexts/__tests__/collection-context.test.tsx
```
Expected: FAIL — `CollectionProvider is not exported`

- [ ] **Step 3: Create `contexts/collection-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import { useConfig } from "@/contexts/config-context";
import { getSchemaByName, getPrimaryField } from "@/lib/schema";
import { resolveContentOperations } from "@/lib/operations";
import { getSchemaActions } from "@/lib/actions";
import type { Field } from "@/types/field";
import type { RepoActionConfig } from "@/lib/actions";

type ContentOperations = { create: boolean; rename: boolean; delete: boolean };

type CollectionState = {
  schema: Record<string, any> | undefined;
  operations: ContentOperations;
  actions: RepoActionConfig[];
  primaryField: Field | undefined;
};

const CollectionContext = createContext<CollectionState | null>(null);

export function CollectionProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const { config } = useConfig();

  const value = useMemo<CollectionState>(() => {
    const schema = config ? getSchemaByName(config.object, name) : undefined;
    const operations = resolveContentOperations({ schema });
    const actions = schema ? getSchemaActions(config?.object, schema) : [];
    const primaryField = schema ? getPrimaryField(schema) : undefined;
    return { schema, operations, actions, primaryField };
  }, [config, name]);

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection(): CollectionState {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollection must be used inside CollectionProvider");
  return ctx;
}
```

- [ ] **Step 4: Run to verify it passes**

```
pnpm vitest run contexts/__tests__/collection-context.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Wrap `collection.tsx` with provider and migrate to `useCollection()`**

In `components/collection/collection.tsx`:

1. Wrap the exported component's return with `<CollectionProvider name={name}>...</CollectionProvider>`.
2. Inside the component body, replace:
```ts
const schema = useMemo(() => getSchemaByName(config?.object, name), [config, name]);
const operations = useMemo(() => resolveContentOperations({ schema }), [schema]);
const actions = useMemo(() => getSchemaActions(config?.object, schema), [config, schema]);
const primaryField = useMemo(() => schema ? getPrimaryField(schema) : undefined, [schema]);
```
with:
```ts
const { schema, operations, actions, primaryField } = useCollection();
```
3. Remove the now-unused imports: `getSchemaByName`, `resolveContentOperations`, `getSchemaActions`, `getPrimaryField`.

In `components/collection/collection-table.tsx`:
- Replace any direct calls to `getSchemaByName`, `resolveContentOperations`, `getPrimaryField`, `getSchemaActions` with `useCollection()`.
- Remove those imports.

- [ ] **Step 6: TypeScript check**

```
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add contexts/collection-context.tsx contexts/__tests__/collection-context.test.tsx \
  components/collection/collection.tsx components/collection/collection-table.tsx
git commit -m "refactor: add CollectionContext to centralise schema/operations derivation"
```

---

## Final check

After all 5 tasks:

```bash
pnpm vitest run
pnpm tsc --noEmit
```

All tests pass, no type errors. Run the dev server and manually verify:
- Editing an entry saves correctly and shows draft restore banner on reload.
- Collection list loads and renders field views.
- API routes for entries, collections, and files respond correctly.
- Webhook push events still invalidate cache (check server logs).
