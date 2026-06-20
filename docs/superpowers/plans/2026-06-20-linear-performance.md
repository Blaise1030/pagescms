# Linear Performance Principles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Linear's performance principles to PagesCMS — background saves with status indicator, IndexedDB file caching + draft persistence, lazy-loaded heavy editors, and animation discipline.

**Architecture:** Updates to existing files are non-blocking (fire-and-forget GitHub commit, editor stays unlocked). A `pendingFlushRef` queues content written while a save is in-flight and flushes it the moment the new SHA returns. IndexedDB (`idb`) provides instant file content on re-open and survives accidental tab closes. Heavy editors (CodeMirror, rich-text) load only when the schema includes them. Creation (new file) stays blocking because it needs the server-returned path and SHA to navigate.

**Tech Stack:** Next.js App Router (vinext/Cloudflare Workers), React 19, SWR, `idb` (new), Tailwind CSS v4, shadcn/ui, react-hook-form

## Global Constraints

- Never use `transition-all` — replace with `transition-colors` (or more specific variant)
- Only animate `transform` and `opacity` in interactive components; never `height`, `width`, `margin`, or `padding`
- `idb` is the only new runtime dependency permitted
- Creation flow (`!path`) must remain blocking — do not change its behaviour
- No auto-save — saves are always explicit (click or ⌘S)
- No IndexedDB TTL — draft cleanup is out of scope
- No optimistic collection list updates — out of scope
- `pnpm` is the package manager

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/idb.ts` | IndexedDB singleton, typed get/put/delete for cache + draft stores |
| Create | `components/entry/save-status.tsx` | "Saving…" / "Saved" / "Save failed" inline indicator |
| Create | `components/entry/draft-restore-banner.tsx` | Banner shown when an unsaved draft is found on file open |
| Modify | `components/entry/entry.tsx` | Background save logic, pending flush ref, status indicator, draft integration |
| Modify | `components/entry/entry-form.tsx` | Accept `onDraftChange` prop, call it debounced on form value changes |
| Modify | `fields/core/code/index.tsx` | Wrap `EditComponent` with `next/dynamic` |
| Modify | `fields/core/rich-text/index.tsx` | Wrap `EditComponent` with `next/dynamic` |
| Modify | `app/layout.tsx` | Remove unused `Inter` font import |
| Modify | `components/ui/button.tsx` | `transition-all` → `transition-colors` |
| Modify | `components/ui/switch.tsx` | `transition-all` → `transition-colors` |
| Modify | `components/ui/sidebar.tsx` | `transition-all` → `transition-colors ease-linear` |
| Modify | `components/entry/entry-history.tsx` | `transition-all` → `transition-colors` (2 occurrences) |
| Modify | `components/repo/repo-branches.tsx` | `transition-all` → `transition-colors` |
| Modify | `components/repo/repo-templates.tsx` | `transition-all` → `transition-colors` |

---

## Task 1: Quick Wins — Remove Dead Font + Fix Animations

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/ui/button.tsx:8`
- Modify: `components/ui/switch.tsx:20`
- Modify: `components/ui/sidebar.tsx:427`
- Modify: `components/entry/entry-history.tsx:67,77`
- Modify: `components/repo/repo-branches.tsx:95`
- Modify: `components/repo/repo-templates.tsx:191`

**Interfaces:**
- Produces: nothing consumed by later tasks — standalone cleanup

- [ ] **Step 1: Remove the dead Inter import from `app/layout.tsx`**

The `Inter` font is imported but its variable is never applied to any element. Remove it entirely.

Open `app/layout.tsx`. The current top of the file looks like:

```tsx
import { Inter, JetBrains_Mono, Geist } from "next/font/google";
// ...
const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
```

Change to (remove `Inter` from import, keep the two used fonts):

```tsx
import { JetBrains_Mono, Geist } from "next/font/google";
// ...
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
```

- [ ] **Step 2: Fix `transition-all` in `components/ui/button.tsx`**

Line 8 — the base button class string contains `transition-all`. Replace it with `transition-colors`:

Find:
```
transition-all outline-none focus-visible:border-ring
```
Replace with:
```
transition-colors outline-none focus-visible:border-ring
```

- [ ] **Step 3: Fix `transition-all` in `components/ui/switch.tsx`**

Line 20 — find `transition-all` in the class string and replace with `transition-colors`.

- [ ] **Step 4: Fix `transition-all` in `components/ui/sidebar.tsx`**

Line 427 — find `transition-all ease-linear` and replace with `transition-transform ease-linear` (sidebar handle moves, not color-changes).

- [ ] **Step 5: Fix `transition-all` in `components/entry/entry-history.tsx`**

Lines 67 and 77 — both contain `transition-all hover:bg-accent`. Replace both with `transition-colors hover:bg-accent`.

- [ ] **Step 6: Fix `transition-all` in `components/repo/repo-branches.tsx`**

Line 95 — replace `transition-all` with `transition-colors`.

- [ ] **Step 7: Fix `transition-all` in `components/repo/repo-templates.tsx`**

Line 191 — replace `transition-all` with `transition-colors`.

- [ ] **Step 8: Verify**

Run the dev server and open the app. Hover over buttons, switch toggles, open the sidebar resize handle, visit a collection and hover history items. Confirm no layout jank — transitions should be smooth colour fades only.

```bash
pnpm dev
```

- [ ] **Step 9: Commit**

```bash
git add app/layout.tsx components/ui/button.tsx components/ui/switch.tsx components/ui/sidebar.tsx components/entry/entry-history.tsx components/repo/repo-branches.tsx components/repo/repo-templates.tsx
git commit -m "perf: remove dead Inter font and replace transition-all with transition-colors"
```

---

## Task 2: Lazy-Load CodeMirror Editor

**Files:**
- Modify: `fields/core/code/index.tsx`

**Interfaces:**
- Produces: `editComponents['code']` — a `React.ComponentType<any>` that loads asynchronously. The registry in `fields/registry.ts` consumes this — no change needed there.

- [ ] **Step 1: Read the current `fields/core/code/index.tsx`**

Open `fields/core/code/index.tsx` to see what it currently exports (likely re-exports from `edit-component.tsx` and `view-component.tsx`).

- [ ] **Step 2: Wrap `EditComponent` with `next/dynamic`**

Replace the static `EditComponent` export with a dynamic one. The file should look like this after the change:

```tsx
import dynamic from "next/dynamic";

// Re-export everything else from the field module (schema, defaultValue, read, write, label, ViewComponent)
export { default as schema } from "./schema"; // keep whatever static exports already exist
// (copy across all non-EditComponent exports verbatim — only EditComponent changes)

export const EditComponent = dynamic(
  () => import("./edit-component").then((m) => ({ default: m.EditComponent ?? m.default })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
    ),
  }
);
```

> **Note:** Read the current file first (Step 1) and copy all existing static exports (`label`, `schema`, `defaultValue`, `read`, `write`, `ViewComponent`) verbatim — only replace `EditComponent` with the dynamic version above. Do not guess what other exports exist.

- [ ] **Step 3: Verify**

Open the app, navigate to a collection that has a `code` field type. Confirm:
1. The page loads without the editor blocking the initial render
2. A skeleton/pulse placeholder appears briefly
3. The CodeMirror editor appears and is functional after the async load

If the collection has no `code` field, temporarily add one to `.pages.yml` to test.

- [ ] **Step 4: Commit**

```bash
git add fields/core/code/index.tsx
git commit -m "perf: lazy-load CodeMirror edit component with next/dynamic"
```

---

## Task 3: Lazy-Load Rich-Text Editor

**Files:**
- Modify: `fields/core/rich-text/index.tsx`

**Interfaces:**
- Produces: `editComponents['rich-text']` — a `React.ComponentType<any>` that loads asynchronously.

- [ ] **Step 1: Read the current `fields/core/rich-text/index.tsx`**

Open `fields/core/rich-text/index.tsx` to see what it currently exports.

- [ ] **Step 2: Wrap `EditComponent` with `next/dynamic`**

Apply the same pattern as Task 2. Only `EditComponent` becomes dynamic; all other exports stay static:

```tsx
import dynamic from "next/dynamic";

// (copy all non-EditComponent static exports verbatim from the current file)

export const EditComponent = dynamic(
  () => import("./edit-component").then((m) => ({ default: m.EditComponent ?? m.default })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
    ),
  }
);
```

- [ ] **Step 3: Verify**

Navigate to a collection with a `rich-text` field. Confirm the skeleton placeholder appears and the editor loads correctly afterwards.

- [ ] **Step 4: Commit**

```bash
git add fields/core/rich-text/index.tsx
git commit -m "perf: lazy-load rich-text edit component with next/dynamic"
```

---

## Task 4: IndexedDB Setup

**Files:**
- Create: `lib/idb.ts`

**Interfaces:**
- Produces:
  - `idbCacheKey(owner, repo, branch, path): string` — deterministic key for both stores
  - `getFileCache(key: string): Promise<Record<string, unknown> | undefined>`
  - `setFileCache(key: string, value: Record<string, unknown>): Promise<void>`
  - `getFileDraft(key: string): Promise<Record<string, unknown> | undefined>`
  - `setFileDraft(key: string, value: Record<string, unknown>): Promise<void>`
  - `deleteFileDraft(key: string): Promise<void>`
- Consumed by: Task 6 (`entry.tsx`)

- [ ] **Step 1: Install `idb`**

```bash
pnpm add idb
```

Expected: `idb` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `lib/idb.ts`**

```ts
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pagescms";
const DB_VERSION = 1;
const CACHE_STORE = "file-cache";
const DRAFT_STORE = "file-drafts";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE);
        }
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export function idbCacheKey(
  owner: string,
  repo: string,
  branch: string,
  path: string
): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${branch}/${path}`;
}

export async function getFileCache(
  key: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = await getDb();
    return db.get(CACHE_STORE, key);
  } catch {
    return undefined;
  }
}

export async function setFileCache(
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDb();
    await db.put(CACHE_STORE, value, key);
  } catch {
    // Non-fatal — IndexedDB may be unavailable in private browsing
  }
}

export async function getFileDraft(
  key: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = await getDb();
    return db.get(DRAFT_STORE, key);
  } catch {
    return undefined;
  }
}

export async function setFileDraft(
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDb();
    await db.put(DRAFT_STORE, value, key);
  } catch {
    // Non-fatal
  }
}

export async function deleteFileDraft(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(DRAFT_STORE, key);
  } catch {
    // Non-fatal
  }
}
```

- [ ] **Step 3: Verify the module compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors from `lib/idb.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/idb.ts package.json pnpm-lock.yaml
git commit -m "feat: add IndexedDB helpers for file cache and draft persistence"
```

---

## Task 5: Save Status Indicator + Draft Restore Banner

**Files:**
- Create: `components/entry/save-status.tsx`
- Create: `components/entry/draft-restore-banner.tsx`

**Interfaces:**
- Produces:
  - `<SaveStatus status="saving" | "saved" | "error" />` — inline text indicator, auto-clears "saved" after 2s internally
  - `<DraftRestoreBanner onRestore={() => void} onDiscard={() => void} />` — banner with two actions
- Consumed by: Task 6 (`entry.tsx`)

- [ ] **Step 1: Create `components/entry/save-status.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SaveStatusValue = "idle" | "saving" | "saved" | "error";

export function SaveStatus({ status }: { status: SaveStatusValue }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status !== "saved") return;
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [status]);

  if (!visible) return null;

  return (
    <span
      className={cn(
        "shrink-0 text-sm",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-muted-foreground",
        status === "error" && "text-destructive"
      )}
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}
```

- [ ] **Step 2: Create `components/entry/draft-restore-banner.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/50 px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        You have unsaved changes from a previous session.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onRestore}>
          Restore draft
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm tsc --noEmit
```

Expected: no errors from the two new files.

- [ ] **Step 4: Commit**

```bash
git add components/entry/save-status.tsx components/entry/draft-restore-banner.tsx
git commit -m "feat: add SaveStatus indicator and DraftRestoreBanner components"
```

---

## Task 6: Background Saves in `entry.tsx`

**Files:**
- Modify: `components/entry/entry.tsx`

**Interfaces:**
- Consumes:
  - `SaveStatus`, `SaveStatusValue` from `./save-status`
  - `DraftRestoreBanner` from `./draft-restore-banner`
  - `idbCacheKey`, `getFileCache`, `setFileCache`, `getFileDraft`, `setFileDraft`, `deleteFileDraft` from `@/lib/idb`
- Produces: updated `Entry` component with background save behaviour

The current `onSubmit` in `entry.tsx` (line ~310) does:
1. `setIsSaving(true)`
2. Wraps the fetch in a `Promise` passed to `toast.promise`
3. Awaits completion, then `setIsSaving(false)` in `finally`

This task refactors `onSubmit` so that **updates** (`path` exists) fire the fetch without blocking and drain a pending-flush queue, while **creation** (`!path`) keeps the existing blocking behaviour.

- [ ] **Step 1: Add new state and refs at the top of `Entry`**

In `entry.tsx`, after the existing state declarations (around line 107–108 where `isLoading` and `isSaving` are declared), add:

```tsx
// Background save state
const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
const shaRef = useRef<string | undefined>(undefined);
const inFlightRef = useRef(false);
const pendingFlushRef = useRef<Record<string, unknown> | null>(null);

// Draft / cache state
const [draftContent, setDraftContent] = useState<Record<string, unknown> | null>(null);
const [showDraftBanner, setShowDraftBanner] = useState(false);
```

Keep `const [isSaving, setIsSaving] = useState(false)` — it will only be used for the creation flow after this refactor.

- [ ] **Step 2: Keep `shaRef` in sync with `sha` state**

Add this effect after the existing `sha` state declaration:

```tsx
useEffect(() => {
  shaRef.current = sha;
}, [sha]);
```

- [ ] **Step 3: Add imports**

At the top of `entry.tsx`, add:

```tsx
import { SaveStatus, type SaveStatusValue } from "./save-status";
import { DraftRestoreBanner } from "./draft-restore-banner";
import {
  idbCacheKey,
  getFileCache,
  setFileCache,
  getFileDraft,
  setFileDraft,
  deleteFileDraft,
} from "@/lib/idb";
```

- [ ] **Step 4: Load draft / cache on mount**

Add this effect after the SWR setup (after the `swrEntryData` useEffect block, around line 265):

```tsx
// Check IndexedDB for draft or cached content on mount
useEffect(() => {
  if (!path || !config) return;
  const key = idbCacheKey(config.owner, config.repo, config.branch, path);

  (async () => {
    const draft = await getFileDraft(key);
    if (draft) {
      setDraftContent(draft);
      setShowDraftBanner(true);
      return;
    }
    // Pre-seed entry from cache so the form renders before SWR resolves
    const cached = await getFileCache(key);
    if (cached && !entry) {
      setEntry(cached as any);
    }
  })();
  // Run only on mount — path/config won't change within a mounted Entry
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 5: Write file content to cache after SWR resolves**

Inside the existing `useEffect` that runs when `swrEntryData` changes (the one that calls `setEntry(swrEntryData)`), add a cache write after `setEntry`:

```tsx
// After: setEntry(swrEntryData);
// After: setSha(swrEntryData.sha);
// Add:
if (path && config && swrEntryData.contentObject) {
  const key = idbCacheKey(config.owner, config.repo, config.branch, path);
  void setFileCache(key, swrEntryData.contentObject as Record<string, unknown>);
}
```

- [ ] **Step 6: Extract `executeSave` — the background fetch function**

Add this function inside the `Entry` component, before `onSubmit`. It handles the actual POST and the pending-flush drain:

```tsx
const executeSave = useCallback(
  async (contentObject: Record<string, unknown>, savePath: string) => {
    inFlightRef.current = true;
    setSaveStatus("saving");

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
        }
      );
      const data = await requireApiSuccess<any>(response, "Failed to save file");

      // Update SHA
      if (data.data.sha !== shaRef.current) {
        shaRef.current = data.data.sha;
        setSha(data.data.sha);
      }

      // Clear draft from IndexedDB on successful save
      if (path) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        void deleteFileDraft(key);
        void setFileCache(key, contentObject);
      }

      setHasRegisteredChanges(false);
      setSaveStatus("saved");

      // Invalidate collection cache
      if (schemaType === "collection") {
        const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
        void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
      }

      if (onSave) onSave(data.data);

      // Drain pending flush
      const pending = pendingFlushRef.current;
      pendingFlushRef.current = null;
      if (pending) {
        await executeSave(pending, savePath);
      } else {
        inFlightRef.current = false;
      }
    } catch (error: unknown) {
      inFlightRef.current = false;
      setSaveStatus("error");
      const message =
        error instanceof Error ? error.message : "Failed to save file.";
      toast.error(message, {
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () => void executeSave(contentObject, savePath),
        },
      });
    }
  },
  [config, name, path, schema, schemaType, onSave, mutate, setHasRegisteredChanges]
);
```

- [ ] **Step 7: Rewrite `onSubmit` to branch on creation vs update**

Replace the entire existing `onSubmit` function with this:

```tsx
const onSubmit = async (contentObject: Record<string, unknown>) => {
  // ── CREATION (no path yet) — keep blocking ──────────────────────────────
  if (!path) {
    setIsSaving(true);
    const savePromise = new Promise<ApiSuccess<EntryData>>(async (resolve, reject) => {
      try {
        if (!schema) throw new Error("Cannot create entry without schema.");
        if (!canCreate) throw new Error("Creating entries in this content item isn't allowed.");
        const basePath = parent ?? schema.path;
        if (basePath == null) throw new Error("Cannot create entry without a target path.");
        const trimmedFilename = filenameValue.trim();
        const normalizedFilename = normalizePath(trimmedFilename).split("/").pop() || "";
        if (showFilenameField && !normalizedFilename) throw new Error("Filename is required.");
        const generatedFilename = showFilenameField
          ? normalizedFilename
          : generateFilename(schema.filename, schema, contentObject);
        const savePath = joinPathSegments([basePath, generatedFilename]);

        const response = await fetch(
          `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "content",
              name,
              content: schema?.list === true ? contentObject.listWrapper : contentObject,
              sha: undefined,
            }),
          }
        );
        const data = await requireApiSuccess<any>(response, "Failed to save file");
        if (data.data.sha) setSha(data.data.sha);
        if (schemaType === "collection") {
          router.push(
            `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(data.data.path)}`
          );
          const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
          void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(savePromise, {
      loading: "Creating file…",
      success: (response: ApiSuccess<EntryData>) => {
        if (onSave) onSave(response.data);
        return response.message;
      },
      error: (error: unknown) =>
        error instanceof Error ? error.message : "Failed to create file.",
    });

    try {
      await savePromise;
      setHasRegisteredChanges(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
    return;
  }

  // ── UPDATE (path exists) — background, non-blocking ─────────────────────
  let savePath = path;
  const trimmedFilename = filenameValue.trim();
  const normalizedFilename = normalizePath(trimmedFilename).split("/").pop() || "";

  // Handle rename before firing background save
  if (
    showFilenameField &&
    filenameFieldMode === "enabled" &&
    isFilenameUnlocked &&
    filenameChanged &&
    schemaType === "collection"
  ) {
    if (!canRename) throw new Error("Renaming this entry isn't allowed.");
    const newPath = joinPathSegments([getParentPath(savePath), normalizedFilename]);
    const renameResponse = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}/rename`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", name, newPath }),
      }
    );
    await requireApiSuccess<any>(renameResponse, "Failed to rename file");
    savePath = newPath;
    setPath(newPath);
    router.replace(
      `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(newPath)}`
    );
    const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
    void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
  }

  if (inFlightRef.current) {
    // Queue latest content — will flush when current save SHA returns
    pendingFlushRef.current = contentObject;
    return;
  }

  void executeSave(contentObject, savePath);
};
```

- [ ] **Step 8: Update `isBusy` — remove `isSaving` from update path**

The existing line is:
```tsx
const isBusy = isLoading || isSaving;
```

Change to:
```tsx
// isSaving only blocks during creation; updates are non-blocking
const isBusy = isLoading || isSaving;
```

No code change needed here — `isSaving` is now only set to `true` during creation (`!path`), so it naturally doesn't block the editor during updates. Just leave it as-is.

- [ ] **Step 9: Add `SaveStatus` and `DraftRestoreBanner` to the header and form area**

Find the `headerNode` useMemo (around line 660). In the right-side action group, add `<SaveStatus>` just before the Save button:

```tsx
{/* Add before the Save <Button>: */}
{path && <SaveStatus status={saveStatus} />}
```

So the right-side block becomes:
```tsx
<div className="flex shrink-0 items-center gap-x-2">
  {headerActionsNode}
  {/* ... history button ... */}
  {path && <SaveStatus status={saveStatus} />}
  <Button
    type="submit"
    form="entry-form"
    disabled={
      isBusy ||
      (showFilenameField && filenameValue.trim().length === 0) ||
      (
        Boolean(path) &&
        !(isFormDirty || hasRegisteredChanges || (showFilenameField && filenameFieldMode === "enabled" && isFilenameUnlocked && filenameChanged))
      )
    }
    aria-label="Save"
  >
    <Save className="size-4 sm:hidden" />
    <span className="hidden sm:inline">Save</span>
  </Button>
  {/* ... options button ... */}
</div>
```

Then find where `EntryForm` is rendered (around line 843). Add the `DraftRestoreBanner` immediately above it:

```tsx
{showDraftBanner && draftContent && (
  <DraftRestoreBanner
    onRestore={() => {
      setEntry((prev) => prev ? { ...prev, contentObject: draftContent } : prev);
      setShowDraftBanner(false);
    }}
    onDiscard={async () => {
      if (path && config) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        await deleteFileDraft(key);
      }
      setDraftContent(null);
      setShowDraftBanner(false);
    }}
  />
)}
<EntryForm ... />
```

- [ ] **Step 10: Add `saveStatus` to the `headerNode` useMemo dependency array**

Find the `useMemo` dependency array for `headerNode` and add `saveStatus`:

```tsx
), [breadcrumbNode, canDelete, canRename, filenameChanged, filenameFieldMode, filenameValue,
    handleDelete, handleRename, hasRegisteredChanges, headerActionsNode, headerMeta,
    historyData, isBusy, isFilenameUnlocked, isFormDirty, isLoading, name, path,
    saveStatus, schemaType, sha, showFilenameField, showHeaderActions]);
```

- [ ] **Step 11: Verify**

Run the dev server and test:
1. Open an existing file — form should render (possibly from cache after second visit)
2. Edit content and click Save — editor stays unlocked, "Saving…" appears in header, then "Saved"
3. Edit and click Save again rapidly while "Saving…" is visible — second click queues, auto-flushes after first SHA returns
4. Disconnect network (DevTools → Offline), save — "Save failed" appears with a Retry toast
5. Close a tab mid-edit, reopen — DraftRestoreBanner appears; clicking "Restore draft" populates the editor
6. Create a new file — blocking spinner as before, redirect to edit page on success

```bash
pnpm dev
```

- [ ] **Step 12: Commit**

```bash
git add components/entry/entry.tsx
git commit -m "feat: non-blocking background saves with status indicator and draft persistence"
```

---

## Task 7: Draft Write on Keystroke in `EntryForm`

**Files:**
- Modify: `components/entry/entry-form.tsx`

**Interfaces:**
- Consumes: `setFileDraft`, `idbCacheKey` from `@/lib/idb` (via prop callback — `entry-form` does not import idb directly)
- Produces: `onDraftChange?: (content: Record<string, unknown>) => void` prop — called debounced (~1s) on every form value change

**Why separate from Task 6:** `EntryForm` owns the react-hook-form instance. Only it can `useWatch` all values. Drafts must be written here, not in `entry.tsx`.

- [ ] **Step 1: Add `onDraftChange` to `EntryForm`'s props**

In `entry-form.tsx`, find the props interface/type for `EntryForm`. Add `onDraftChange`:

```tsx
// In the props type/interface:
onDraftChange?: (content: Record<string, unknown>) => void;
```

- [ ] **Step 2: Watch form values and call `onDraftChange` debounced**

Inside `EntryForm`, after `const form = useForm(...)` is defined, add:

```tsx
const allValues = useWatch({ control: form.control });
const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (!onDraftChange) return;
  if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  draftTimerRef.current = setTimeout(() => {
    const sanitized = sanitizeObject(allValues, schema);
    onDraftChange(sanitized as Record<string, unknown>);
  }, 1000);
  return () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  };
}, [allValues, onDraftChange, schema]);
```

> `sanitizeObject` is already imported in `entry-form.tsx` from `@/lib/schema`. `schema` is already a prop. `useWatch` is already imported.

- [ ] **Step 3: Wire `onDraftChange` in `entry.tsx`**

In `entry.tsx`, where `EntryForm` is rendered (around line 843), add the `onDraftChange` prop:

```tsx
<EntryForm
  // ... existing props ...
  onDraftChange={path ? async (content) => {
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    await setFileDraft(key, content);
  } : undefined}
/>
```

Pass `undefined` for new files (creation) since there's no stable path key yet.

- [ ] **Step 4: Verify draft persistence**

1. Open an existing file, type a few characters
2. Wait 1 second (debounce)
3. Open DevTools → Application → IndexedDB → pagescms → file-drafts
4. Confirm an entry exists with the key `owner/repo/branch/path`
5. Close and reopen the tab — DraftRestoreBanner should appear
6. Click "Restore draft" — your edits should be present in the editor
7. Save the file — check IndexedDB again — draft entry should be gone

- [ ] **Step 5: Commit**

```bash
git add components/entry/entry-form.tsx components/entry/entry.tsx
git commit -m "feat: write draft to IndexedDB on debounced keystroke via EntryForm"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| Background saves (updates) | Task 6 |
| Pending flush ref, SHA-keyed drain | Task 6 |
| Status indicator: Saving / Saved / error | Task 5 + 6 |
| Error toast with Retry, no rollback | Task 6 `executeSave` catch block |
| Creation stays blocking | Task 6 `onSubmit` creation branch |
| IndexedDB with `idb` | Task 4 |
| `cache:` and `draft:` separate stores | Task 4 |
| Draft written on debounced keystroke | Task 7 |
| Draft cleared on successful save | Task 6 `executeSave` success block |
| Draft restore banner | Task 5 + 6 |
| Instant render from cache on re-open | Task 6 mount effect |
| No TTL / cleanup | Confirmed absent — correct |
| Lazy-load CodeMirror | Task 2 |
| Lazy-load rich-text editor | Task 3 |
| Remove dead Inter font | Task 1 |
| `transition-all` → `transition-colors` (6 files) | Task 1 |
| No auto-save | Confirmed absent — correct |
| No optimistic list updates | Confirmed absent — correct |

### Placeholder scan

None found — all steps contain concrete code.

### Type consistency

- `SaveStatusValue` defined in Task 5, consumed in Task 6 — matches (`"idle" | "saving" | "saved" | "error"`)
- `idbCacheKey` signature defined in Task 4, used identically in Tasks 6 and 7
- `onDraftChange: (content: Record<string, unknown>) => void` defined in Task 7 Step 1, wired in Task 7 Step 3
- `executeSave(contentObject: Record<string, unknown>, savePath: string)` defined in Task 6 Step 6, called in Step 7
