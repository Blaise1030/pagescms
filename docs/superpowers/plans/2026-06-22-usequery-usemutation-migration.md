# useQuery / useMutation Full Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining direct `fetch` calls in client components with `useQuery` (GETs) or `useMutation` (writes), ensuring every mutation invalidates the relevant TanStack Query cache.

**Architecture:** Each GET becomes a `useQuery` keyed via `lib/query-keys.ts`. Each mutation becomes a `useMutation` whose `onSuccess` calls `queryClient.invalidateQueries` with the appropriate key. Local `useState` loading/error boilerplate is removed where TanStack Query's own state suffices.

**Tech Stack:** TanStack Query v5 (`@tanstack/react-query`), Next.js 14, TypeScript.

## Global Constraints

- Import `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- All query keys come from `lib/query-keys.ts` — never hardcode arrays inline
- `useMutation.onSuccess` must call `queryClient.invalidateQueries` for every affected key
- Do not change API route files (`app/api/**`) — only client-side components and hooks
- Keep `toast.promise` / `toast.success` / `toast.error` patterns unchanged

---

## File Map

| File | Change |
|------|--------|
| `lib/query-keys.ts` | Add `collaborators`, `collaboratorInvite`, `cacheStatus` keys |
| `components/collaborators.tsx` | useQuery (list) + useMutation (invite, remove, resend) |
| `components/cache/cache-page.tsx` | useQuery (status) + useMutation (actions) |
| `components/file/file-options.tsx` | useMutation (delete file) |
| `components/file/file-rename.tsx` | useMutation (rename file) |
| `components/empty-create.tsx` | useMutation (create file) |
| `components/collection/collection.tsx` | useMutation (rename node) |
| `components/entry/entry.tsx` | useMutation (create new entry, inline rename) |
| `components/invite-sign-in.tsx` | useQuery (load invite) + useMutation (claim invite) |
| `components/settings/identities.tsx` | useMutation (unlink account) |
| `components/settings/profile.tsx` | useMutation (update user) |
| `fields/core/reference/edit-component.tsx` | useQuery (search + resolve selected) |
| `fields/core/rich-text/edit-component.tsx` | useMutation (upload image) |

---

### Task 1: Extend query-keys.ts

**Files:**
- Modify: `lib/query-keys.ts`

**Interfaces:**
- Produces:
  - `queryKeys.collaborators(owner, repo)` → `['collaborators', owner, repo]`
  - `queryKeys.collaboratorInvite(token)` → `['collaboratorInvite', token]`
  - `queryKeys.cacheStatus(owner, repo, branch)` → `['cacheStatus', owner, repo, branch]`

- [ ] **Step 1: Add new keys**

Replace the entire file content:

```ts
export const queryKeys = {
  entry: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entry', owner, repo, branch, path, name] as const,

  entryHistory: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entryHistory', owner, repo, branch, path, name] as const,

  collection: (owner: string, repo: string, branch: string, name: string, collectionPath: string) =>
    ['collection', owner, repo, branch, name, collectionPath] as const,

  collectionAll: (owner: string, repo: string, branch: string, name: string) =>
    ['collection', owner, repo, branch, name] as const,

  media: (owner: string, repo: string, branch: string, mediaName: string, path: string) =>
    ['media', owner, repo, branch, mediaName, path] as const,

  mediaAll: (owner: string, repo: string, branch: string, mediaName: string) =>
    ['media', owner, repo, branch, mediaName] as const,

  reference: (owner: string, repo: string, branch: string, collectionName: string, queryString: string) =>
    ['reference', owner, repo, branch, collectionName, queryString] as const,

  collaborators: (owner: string, repo: string) =>
    ['collaborators', owner, repo] as const,

  collaboratorInvite: (token: string) =>
    ['collaboratorInvite', token] as const,

  cacheStatus: (owner: string, repo: string, branch: string) =>
    ['cacheStatus', owner, repo, branch] as const,
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/query-keys.ts
git commit -m "feat: add collaborators, collaboratorInvite, cacheStatus query keys"
```

---

### Task 2: collaborators.tsx — useQuery + useMutation

**Files:**
- Modify: `components/collaborators.tsx`

**Interfaces:**
- Consumes: `queryKeys.collaborators(owner, repo)` from Task 1

- [ ] **Step 1: Add imports**

At the top of `components/collaborators.tsx`, replace the existing imports section to add:
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```
Remove imports of `useState` for `collaborators`, `isLoading`, `error` (keep others like `isInviting`, `removing`, `resending`, `pendingRemoveId`, `emails`, `inviteDialogOpen`, `inviteError`).

- [ ] **Step 2: Replace the fetchCollaborators useEffect with useQuery**

Remove the entire `useEffect` that calls `fetchCollaborators` and the three `useState` lines for `collaborators`, `isLoading`, `error`. Replace with:

```ts
const queryClient = useQueryClient();

const { data: collaborators = [], isLoading, error: collaboratorsError } = useQuery({
  queryKey: queryKeys.collaborators(owner, repo),
  queryFn: async () => {
    const response = await fetch(`/api/collaborators/${owner}/${repo}`);
    const data = await requireApiSuccess<{
      status: string;
      data: Collaborator[];
      message?: string;
    }>(response, "Failed to fetch collaborators");
    return data.data;
  },
});

const error = collaboratorsError instanceof Error ? collaboratorsError.message : collaboratorsError ? "Failed to fetch collaborators" : null;
```

- [ ] **Step 3: Replace handleInviteCollaborators with useMutation**

Remove the `useCallback` for `handleInviteCollaborators` and the `addNewCollaborator` helper. Replace with:

```ts
const inviteMutation = useMutation({
  mutationFn: async (inviteEmails: string[]) => {
    const response = await fetch(`/api/collaborators/${owner}/${repo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: inviteEmails }),
    });
    return requireApiSuccess<AddCollaboratorState>(response, "Failed to invite collaborators");
  },
  onSuccess: (data) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collaborators(owner, repo) });
    toast.success(data.message || "Collaborators invited.", { duration: 10000 });
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      toast.error(data.errors.join("\n"), { duration: 10000 });
    }
    setEmails("");
    setInviteDialogOpen(false);
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to invite collaborators";
    setInviteError(message);
    toast.error(message);
  },
});

const handleInviteCollaborators = (inviteEmails: string[]) => inviteMutation.mutate(inviteEmails);
const isInviting = inviteMutation.isPending;
```

Remove the `const [isInviting, setIsInviting] = useState(false)` line.

- [ ] **Step 4: Replace handleConfirmRemove with useMutation**

Remove the `useCallback` for `handleConfirmRemove`. Replace with:

```ts
const removeMutation = useMutation({
  mutationFn: async (collaboratorId: number) => {
    const response = await fetch(`/api/collaborators/${owner}/${repo}/${collaboratorId}`, {
      method: "DELETE",
    });
    return requireApiSuccess<{ message?: string }>(response, "Failed to remove collaborator");
  },
  onSuccess: (data) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collaborators(owner, repo) });
    toast.success(data.message || "Collaborator removed.");
    setPendingRemoveId(null);
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to remove collaborator";
    toast.error(message);
    setPendingRemoveId(null);
  },
});

const handleConfirmRemove = (collaboratorId: number) => {
  setRemoving((prev) => [...prev, collaboratorId]);
  removeMutation.mutate(collaboratorId, {
    onSettled: () => setRemoving((prev) => prev.filter((id) => id !== collaboratorId)),
  });
};
```

- [ ] **Step 5: Replace handleResendInvite with useMutation**

Remove the `useCallback` for `handleResendInvite`. Replace with:

```ts
const resendMutation = useMutation({
  mutationFn: async (collaboratorId: number) => {
    const response = await fetch(`/api/collaborators/${owner}/${repo}/${collaboratorId}/resend`, {
      method: "POST",
    });
    return requireApiSuccess<{ message?: string }>(response, "Failed to resend invitation");
  },
  onSuccess: (data) => {
    toast.success(data.message || "Invitation resent.");
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to resend invitation";
    toast.error(message);
  },
});

const handleResendInvite = (collaboratorId: number) => {
  setResending((prev) => [...prev, collaboratorId]);
  resendMutation.mutate(collaboratorId, {
    onSettled: () => setResending((prev) => prev.filter((id) => id !== collaboratorId)),
  });
};
```

- [ ] **Step 6: Commit**

```bash
git add components/collaborators.tsx
git commit -m "feat: migrate collaborators to useQuery + useMutation"
```

---

### Task 3: cache-page.tsx — useQuery + useMutation

**Files:**
- Modify: `components/cache/cache-page.tsx`

**Interfaces:**
- Consumes: `queryKeys.cacheStatus(owner, repo, branch)` from Task 1

- [ ] **Step 1: Add imports**

Add to imports in `components/cache/cache-page.tsx`:
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace fetchStatus + useEffect with useQuery**

Remove `const [data, setData]`, `const [loading, setLoading]`, the `fetchStatus` callback, and its `useEffect`. Replace with:

```ts
const queryClient = useQueryClient();

const { data, isLoading: loading, refetch: refetchStatus } = useQuery({
  queryKey: queryKeys.cacheStatus(owner, repo, branch),
  queryFn: async () => {
    const response = await fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch)}/cache`);
    const payload = await requireApiSuccess<{
      status: string;
      data: CacheStatusPayload;
    }>(response, "Failed to fetch cache status");
    return payload.data;
  },
});
```

- [ ] **Step 3: Replace runAction with useMutation**

Remove the `runAction` callback and the `const [actionLoading, setActionLoading]` state. Replace with:

```ts
const [actionLoading, setActionLoading] = useState<string | null>(null);

const cacheActionMutation = useMutation({
  mutationFn: async ({ action }: { action: string }) => {
    const response = await fetch(
      `/api/${owner}/${repo}/${encodeURIComponent(branch)}/cache`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    return requireApiSuccess(response, "Failed cache action");
  },
  onSuccess: (_data, { action }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cacheStatus(owner, repo, branch) });
  },
  onSettled: () => {
    setActionLoading(null);
  },
});

const runAction = (action: string, successMessage: string) => {
  setActionLoading(action);
  const loadingId = toast.loading("Updating cache...");
  cacheActionMutation.mutate(
    { action },
    {
      onSuccess: () => toast.success(successMessage, { id: loadingId }),
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed cache action";
        toast.error(message, { id: loadingId });
      },
    },
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add components/cache/cache-page.tsx
git commit -m "feat: migrate cache-page to useQuery + useMutation"
```

---

### Task 4: file-options.tsx — useMutation (delete)

**Files:**
- Modify: `components/file/file-options.tsx`

**Interfaces:**
- Consumes: `queryKeys.collectionAll`, `queryKeys.mediaAll` from existing keys

- [ ] **Step 1: Add imports**

Add to imports in `components/file/file-options.tsx`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace the delete fetch with useMutation**

Inside the `FileOptions` component, find the section where the delete confirmation is handled (the `onConfirm` inside `AlertDialogAction`). Extract it into a `useMutation`:

```ts
const queryClient = useQueryClient();

const deleteMutation = useMutation({
  mutationFn: async () => {
    const params = new URLSearchParams({ type, ...(name ? { name } : {}) });
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(normalizedPath)}?${params.toString()}`,
      { method: "DELETE" },
    );
    return requireApiSuccess<{ message?: string }>(response, "Failed to delete file");
  },
  onSuccess: () => {
    if (type === "media" && name) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mediaAll(config.owner, config.repo, config.branch, name) });
    } else if ((type === "collection" || type === "file") && name) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name) });
    }
    if (onDelete) onDelete(normalizedPath);
  },
});
```

Replace the existing `await fetch(...)` + `requireApiSuccess` block inside the delete handler with:
```ts
await deleteMutation.mutateAsync();
```

- [ ] **Step 3: Commit**

```bash
git add components/file/file-options.tsx
git commit -m "feat: migrate file-options delete to useMutation"
```

---

### Task 5: file-rename.tsx — useMutation

**Files:**
- Modify: `components/file/file-rename.tsx`

**Interfaces:**
- Consumes: `queryKeys.collectionAll`, `queryKeys.mediaAll`

- [ ] **Step 1: Add imports**

Add to `components/file/file-rename.tsx`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace the rename fetch with useMutation**

Inside the `FileRename` component, replace the `await fetch(...)` block with a mutation:

```ts
const queryClient = useQueryClient();

const renameMutation = useMutation({
  mutationFn: async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(fromPath)}/rename`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, newPath: toPath }),
      },
    );
    return requireApiSuccess<any>(response, "Failed to rename file");
  },
  onSuccess: (_data, { toPath }) => {
    if (type === "media" && name) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mediaAll(config.owner, config.repo, config.branch, name) });
    } else if (name) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name) });
    }
    if (onRename) onRename(normalizedPath, toPath);
    setIsRenameOpen(false);
  },
});
```

In the submit handler replace the direct `fetch` call with:
```ts
await renameMutation.mutateAsync({ fromPath: normalizedPath, toPath: newNormalizedPath });
```

- [ ] **Step 3: Commit**

```bash
git add components/file/file-rename.tsx
git commit -m "feat: migrate file-rename to useMutation"
```

---

### Task 6: empty-create.tsx — useMutation

**Files:**
- Modify: `components/empty-create.tsx`

**Interfaces:**
- Consumes: `queryKeys.collectionAll`

- [ ] **Step 1: Add imports**

Add to `components/empty-create.tsx`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace the create fetch with useMutation**

Inside the `EmptyCreate` component, replace the `await fetch(...)` block with:

```ts
const queryClient = useQueryClient();

const createMutation = useMutation({
  mutationFn: async ({ filePath, body }: { filePath: string; body: object }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(normalizePath(filePath))}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return requireApiSuccess<any>(response, "Failed to create file");
  },
  onSuccess: () => {
    if (name) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name) });
    }
  },
});
```

In the submit handler, replace the direct `fetch` call with `await createMutation.mutateAsync({ filePath: path, body: { ... } })`.

- [ ] **Step 3: Commit**

```bash
git add components/empty-create.tsx
git commit -m "feat: migrate empty-create to useMutation"
```

---

### Task 7: collection.tsx — useMutation (rename node)

**Files:**
- Modify: `components/collection/collection.tsx`

**Interfaces:**
- Consumes: `queryKeys.collectionAll`

- [ ] **Step 1: Add useMutation import (already has useQuery/useQueryClient)**

Ensure `useMutation` is in the import from `@tanstack/react-query`.

- [ ] **Step 2: Add renameMutation**

Inside the `Collection` component (near `handleConfirmRenameNode`), add:

```ts
const renameNodeMutation = useMutation({
  mutationFn: async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(fromPath)}/rename`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", name, newPath: toPath }),
      },
    );
    return requireApiSuccess<any>(response, "Failed to rename file");
  },
  onSuccess: (_data, { fromPath, toPath }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name) });
  },
});
```

- [ ] **Step 3: Update handleConfirmRenameNode to use the mutation**

Inside `handleConfirmRenameNode`, replace the inner `await fetch(...)` call with `await renameNodeMutation.mutateAsync({ fromPath: normalizedPath, toPath: normalizedNewPath })`. Keep the `toast.promise` wrapper as-is.

- [ ] **Step 4: Commit**

```bash
git add components/collection/collection.tsx
git commit -m "feat: migrate collection rename-node to useMutation"
```

---

### Task 8: entry.tsx — useMutation (create new entry + inline rename)

**Files:**
- Modify: `components/entry/entry.tsx`

**Interfaces:**
- Consumes: `queryKeys.collectionAll`, `queryKeys.entry`

- [ ] **Step 1: Ensure useMutation is imported**

`components/entry/entry.tsx` already imports `useQuery, useQueryClient`. Add `useMutation` to the import.

- [ ] **Step 2: Add createEntryMutation**

Near the top of the `Entry` component body, add:

```ts
const createEntryMutation = useMutation({
  mutationFn: async ({ savePath, body }: { savePath: string; body: object }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return requireApiSuccess<any>(response, "Failed to save file");
  },
  onSuccess: (data) => {
    if (data.data.sha) setSha(data.data.sha);
    if (schemaType === "collection") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
      });
    }
  },
});
```

- [ ] **Step 3: Replace the create-path fetch in executeSave**

Inside the `!path` branch of `executeSave` (around line 403), replace:
```ts
const response = await fetch(...);
const data = await requireApiSuccess<any>(response, "Failed to save file");
if (data.data.sha) setSha(data.data.sha);
if (schemaType === "collection") {
  router.push(...);
  void queryClient.invalidateQueries({ ... });
}
resolve(data);
```
With:
```ts
const data = await createEntryMutation.mutateAsync({
  savePath,
  body: {
    type: "content",
    name,
    content: schema?.list === true ? contentObject.listWrapper : contentObject,
    sha: undefined,
  },
});
if (schemaType === "collection") {
  router.push(
    `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(data.data.path)}`
  );
}
resolve(data);
```

- [ ] **Step 4: Add renameEntryMutation**

```ts
const renameEntryMutation = useMutation({
  mutationFn: async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(fromPath)}/rename`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", name, newPath: toPath }),
      },
    );
    return requireApiSuccess<any>(response, "Failed to rename file");
  },
  onSuccess: (_data, { toPath }) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
    });
  },
});
```

- [ ] **Step 5: Replace the inline rename fetch in executeSave**

Find the `const renameResponse = await fetch(.../rename...)` block (around line 468) and replace it with:
```ts
await renameEntryMutation.mutateAsync({ fromPath: savePath, toPath: newPath });
```
Keep all the surrounding logic (`setPath(newPath)`, `setIsFilenameUnlocked(false)`, `router.replace(...)`) as-is after the mutation call.

- [ ] **Step 6: Commit**

```bash
git add components/entry/entry.tsx
git commit -m "feat: migrate entry create/rename to useMutation"
```

---

### Task 9: invite-sign-in.tsx — useQuery + useMutation

**Files:**
- Modify: `components/invite-sign-in.tsx`

**Interfaces:**
- Consumes: `queryKeys.collaboratorInvite(token)` from Task 1

- [ ] **Step 1: Add imports**

Add to `components/invite-sign-in.tsx`:
```ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Replace invite-load useEffect with useQuery**

Remove the `useEffect` that calls `loadInvite()` and the `useState<InviteState>`. Replace with:

```ts
const { data: state = { status: "loading" } } = useQuery<InviteState>({
  queryKey: queryKeys.collaboratorInvite(token),
  queryFn: async () => {
    const response = await fetch(`/api/collaborator-invites/${encodeURIComponent(token)}`);
    return response.json() as Promise<InviteState>;
  },
  retry: false,
  staleTime: Infinity,
});
```

Keep the `useEffect` that watches `state.status === "ready"` and the one that sends OTP — those are side-effects, not data fetching.

- [ ] **Step 3: Replace claimInvite fetch with useMutation**

Inside `verifyOtp`, replace the `const claimResponse = await fetch(...)` block with a mutation. Add before the component return:

```ts
const claimMutation = useMutation({
  mutationFn: async () => {
    const response = await fetch(`/api/collaborator-invites/${encodeURIComponent(token)}`, {
      method: "POST",
    });
    return response.json() as Promise<InviteState>;
  },
});
```

Inside `verifyOtp`, replace the fetch block with:
```ts
const claim = await claimMutation.mutateAsync();
if (claim.status === "ready") {
  window.location.assign(claim.destinationPath);
  return;
}
if (claim.status === "unavailable") {
  window.location.assign(state.destinationPath as string);
  return;
}
toast.error("Unable to claim this invitation.");
setPending(null);
```

- [ ] **Step 4: Commit**

```bash
git add components/invite-sign-in.tsx
git commit -m "feat: migrate invite-sign-in to useQuery + useMutation"
```

---

### Task 10: settings/identities.tsx + settings/profile.tsx — useMutation

**Files:**
- Modify: `components/settings/identities.tsx`
- Modify: `components/settings/profile.tsx`

- [ ] **Step 1: identities.tsx — add useMutation**

Add import:
```ts
import { useMutation } from "@tanstack/react-query";
```

Find the `handleUnlinkAccount` (or equivalent) function that calls `fetch("/api/auth/unlink-account", ...)`. Convert to:

```ts
const unlinkMutation = useMutation({
  mutationFn: async (accountId: string) => {
    const response = await fetch("/api/auth/unlink-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    return requireApiSuccess(response, "Failed to unlink account");
  },
  onSuccess: () => {
    toast.success("Account unlinked.");
    // retain any existing success-side-effects (e.g. router.refresh())
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to unlink account";
    toast.error(message);
  },
});
```

Replace the call site with `unlinkMutation.mutate(accountId)` and use `unlinkMutation.isPending` to drive the loading state.

- [ ] **Step 2: profile.tsx — add useMutation**

Add import:
```ts
import { useMutation } from "@tanstack/react-query";
```

Find the form submit handler that calls `fetch("/api/auth/update-user", ...)`. Convert to:

```ts
const updateProfileMutation = useMutation({
  mutationFn: async (formData: { name: string; [key: string]: unknown }) => {
    const response = await fetch("/api/auth/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    return requireApiSuccess(response, "Failed to update profile");
  },
  onSuccess: () => {
    toast.success("Profile updated.");
    // retain any existing success-side-effects
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    toast.error(message);
  },
});
```

Replace the call site with `updateProfileMutation.mutate(formData)` and use `updateProfileMutation.isPending` for loading state.

- [ ] **Step 3: Commit**

```bash
git add components/settings/identities.tsx components/settings/profile.tsx
git commit -m "feat: migrate settings mutations to useMutation"
```

---

### Task 11: reference/edit-component.tsx — useQuery (replace debounced useEffect fetches)

**Files:**
- Modify: `fields/core/reference/edit-component.tsx`

**Interfaces:**
- Consumes: `queryKeys.reference(owner, repo, branch, collectionName, queryString)`

- [ ] **Step 1: Add imports**

Add to `fields/core/reference/edit-component.tsx`:
```ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Add debouncedSearch state**

Replace the debounce logic inside the search `useEffect` with a dedicated debounce state:

```ts
const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

useEffect(() => {
  const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 200);
  return () => window.clearTimeout(t);
}, [searchTerm]);
```

- [ ] **Step 3: Replace search useEffect with useQuery**

Remove the `useEffect` that fetches search results and the `useState` for `options`/`isLoading`. Replace with:

```ts
const searchQueryString = useMemo(() => {
  if (!url || !debouncedSearch) return null;
  return new URLSearchParams({
    query: debouncedSearch,
    searchFields,
    valueTemplate,
    labelTemplate,
  }).toString();
}, [url, debouncedSearch, searchFields, valueTemplate, labelTemplate]);

const { data: searchData, isFetching: isLoading } = useQuery({
  queryKey: queryKeys.reference(
    config?.owner ?? "",
    config?.repo ?? "",
    config?.branch ?? "",
    collectionName ?? "",
    searchQueryString ?? "",
  ),
  queryFn: async () => {
    const response = await fetch(`${url}?${searchQueryString}`);
    if (!response.ok) throw new Error("Fetch failed");
    const json = await response.json();
    const contents = Array.isArray(json?.data?.options) ? json.data.options : [];
    return contents.map((item: any) => ({
      value: String(item.value ?? ""),
      label: String(item.label ?? item.value ?? ""),
      resolved: true,
    }));
  },
  enabled: !!url && !!searchQueryString,
  placeholderData: (prev) => prev,
});

const options = searchData ?? [];
```

- [ ] **Step 4: Replace selected-options useEffect with useQuery**

Remove the `useEffect` that fetches selected options and the `useState` for `selectedOptions`. Replace with:

```ts
const selectedQueryString = useMemo(() => {
  if (!url || selectedValuesForRequest.length === 0) return null;
  const p = new URLSearchParams({ valueTemplate, labelTemplate });
  selectedValuesForRequest.forEach((v) => p.append("value", v));
  return p.toString();
}, [url, selectedValuesForRequest, valueTemplate, labelTemplate]);

const { data: selectedOptions = [] } = useQuery({
  queryKey: queryKeys.reference(
    config?.owner ?? "",
    config?.repo ?? "",
    config?.branch ?? "",
    collectionName ?? "",
    `selected:${selectedQueryString ?? ""}`,
  ),
  queryFn: async () => {
    const response = await fetch(`${url}?${selectedQueryString}`);
    if (!response.ok) throw new Error("Fetch failed");
    const json = await response.json();
    const contents = Array.isArray(json?.data?.options) ? json.data.options : [];
    return contents.map((item: any) => ({
      value: String(item.value ?? ""),
      label: String(item.label ?? item.value ?? ""),
      resolved: true,
    }));
  },
  enabled: !!url && !!selectedQueryString,
  staleTime: 30_000,
});
```

- [ ] **Step 5: Commit**

```bash
git add fields/core/reference/edit-component.tsx
git commit -m "feat: migrate reference edit-component fetches to useQuery"
```

---

### Task 12: rich-text/edit-component.tsx — useMutation (image upload)

**Files:**
- Modify: `fields/core/rich-text/edit-component.tsx`

**Interfaces:**
- Consumes: `queryKeys.mediaAll`

- [ ] **Step 1: Add imports**

Add to `fields/core/rich-text/edit-component.tsx`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
```

- [ ] **Step 2: Add uploadImageMutation**

Inside the rich-text editor component, add:

```ts
const queryClient = useQueryClient();

const uploadImageMutation = useMutation({
  mutationFn: async ({ targetPath, body }: { targetPath: string; body: object }) => {
    const response = await fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(targetPath)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as ApiResponse<FileSaveData>;
    if (payload.status !== "success") throw new Error(payload.message);
    return payload;
  },
  onSuccess: () => {
    if (mediaConfig?.name) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mediaAll(config.owner, config.repo, config.branch, mediaConfig.name),
      });
    }
  },
});
```

- [ ] **Step 3: Replace the upload fetch call**

Find the `const response = await fetch(...)` block inside the image upload handler and replace the fetch + validation block with:

```ts
const payload = await uploadImageMutation.mutateAsync({
  targetPath,
  body: { type: "media", name: mediaConfig.name, content },
});
```

- [ ] **Step 4: Commit**

```bash
git add fields/core/rich-text/edit-component.tsx
git commit -m "feat: migrate rich-text image upload to useMutation"
```

---

### Task 13: Push branch and open PR

- [ ] **Step 1: Push branch**

```bash
git push origin feature/tanstack-query-migration
```

- [ ] **Step 2: Update PR description** to note all APIs now go through useQuery / useMutation.
