# Vertical Slice Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `components/`, `fields/`, `contexts/`, and `hooks/` so each vertical slice owns its code co-located inside the Next.js App Router route group that uses it, using `_` prefixed private folders.

**Architecture:** Move slice-specific components/fields/contexts/hooks into `_components/`, `_fields/`, `_contexts/`, `_hooks/` sub-folders inside the owning route group. Truly shared primitives (`components/ui/`, app-level providers) stay at the root `components/` level. `lib/` is intentionally NOT moved — it is shared by both API routes and page components and will be addressed in a separate pass.

**Tech Stack:** Next.js App Router, TypeScript (`@/*` alias maps to project root), pnpm

## Global Constraints

- `@/*` maps to `./*` (project root) — imports must use this alias
- Next.js treats `_` prefixed folders inside `app/` as private (not routes) — safe to import from
- TypeScript path alias with bracket segments (e.g. `[owner]`) works fine for imports
- Run `pnpm tsc --noEmit` after each task to verify no broken imports before committing
- `lib/` is out of scope — do not move any files from `lib/`
- Files still in `components/` at end: `ui/`, `app-logo.tsx`, `theme-provider.tsx`, `app-loading-shell.tsx`, `about.tsx`, `email/`

---

## File Map: Before → After

### Auth slice — `app/(auth)/`
| From | To |
|------|----|
| `components/sign-in.tsx` | `app/(auth)/_components/sign-in.tsx` |
| `components/submit-button.tsx` | `app/(auth)/_components/submit-button.tsx` |

### Settings slice — `app/(main)/settings/`
| From | To |
|------|----|
| `components/settings/identities.tsx` | `app/(main)/settings/_components/identities.tsx` |
| `components/settings/installations.tsx` | `app/(main)/settings/_components/installations.tsx` |
| `components/settings/preferences.tsx` | `app/(main)/settings/_components/preferences.tsx` |
| `components/settings/profile.tsx` | `app/(main)/settings/_components/profile.tsx` |
| `components/settings/settings-layout.tsx` | `app/(main)/settings/_components/settings-layout.tsx` |
| `components/settings/settings-sidebar.tsx` | `app/(main)/settings/_components/settings-sidebar.tsx` |

### Admin slice — `app/(main)/admin/`
| From | To |
|------|----|
| `components/admin-button.tsx` | `app/(main)/admin/_components/admin-button.tsx` |
| `components/admin-confirm-action-button.tsx` | `app/(main)/admin/_components/admin-confirm-action-button.tsx` |
| `components/admin-time-ago.tsx` | `app/(main)/admin/_components/admin-time-ago.tsx` |
| `components/admin-user-row-actions.tsx` | `app/(main)/admin/_components/admin-user-row-actions.tsx` |
| `components/admin-user-search.tsx` | `app/(main)/admin/_components/admin-user-search.tsx` |

### Content editor slice — `app/(main)/[owner]/[repo]/[branch]/`
| From | To |
|------|----|
| `components/collection/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_components/collection/` |
| `components/entry/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_components/entry/` |
| `components/file/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_components/file/` |
| `components/media/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_components/media/` |
| `components/repo/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_components/repo/` |
| `components/actions/actions-page.tsx` | `app/(main)/[owner]/[repo]/[branch]/_components/actions/actions-page.tsx` |
| `components/cache/cache-page.tsx` | `app/(main)/[owner]/[repo]/[branch]/_components/cache/cache-page.tsx` |
| `components/collaborators.tsx` | `app/(main)/[owner]/[repo]/[branch]/_components/collaborators.tsx` |
| `fields/` (entire dir) | `app/(main)/[owner]/[repo]/[branch]/_fields/` |
| `contexts/action-toast-context.tsx` | `app/(main)/[owner]/[repo]/[branch]/_contexts/action-toast-context.tsx` |
| `contexts/collection-context.tsx` | `app/(main)/[owner]/[repo]/[branch]/_contexts/collection-context.tsx` |
| `contexts/config-context.tsx` | `app/(main)/[owner]/[repo]/[branch]/_contexts/config-context.tsx` |
| `contexts/repo-context.tsx` | `app/(main)/[owner]/[repo]/[branch]/_contexts/repo-context.tsx` |
| `hooks/use-entry-store.ts` | `app/(main)/[owner]/[repo]/[branch]/_hooks/use-entry-store.ts` |
| `hooks/__tests__/use-entry-store.test.tsx` | `app/(main)/[owner]/[repo]/[branch]/_hooks/__tests__/use-entry-store.test.tsx` |

### Stays at root (shared)
- `components/ui/` — design system primitives
- `components/app-logo.tsx` — used in multiple layouts
- `components/theme-provider.tsx` — root layout provider
- `components/app-loading-shell.tsx` — root layout loading state
- `components/about.tsx` — used in settings
- `components/email/` — used by worker/mailer
- `contexts/user-context.tsx` — used in root layout
- `hooks/use-mobile.ts` — used across slices

---

## Task 1: Move auth slice components

**Files:**
- Move: `components/sign-in.tsx` → `app/(auth)/_components/sign-in.tsx`
- Move: `components/submit-button.tsx` → `app/(auth)/_components/submit-button.tsx`
- Affects: any file importing `@/components/sign-in` or `@/components/submit-button`

- [ ] **Step 1: Create the target directory**

```bash
mkdir -p "app/(auth)/_components"
```

- [ ] **Step 2: Move the files**

```bash
git mv "components/sign-in.tsx" "app/(auth)/_components/sign-in.tsx"
git mv "components/submit-button.tsx" "app/(auth)/_components/submit-button.tsx"
```

- [ ] **Step 3: Find all files that import from the old paths**

```bash
grep -rl "@/components/sign-in\|@/components/submit-button" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 4: Update all imports**

```bash
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/components/sign-in|@/app/(auth)/_components/sign-in|g;
   s|@/components/submit-button|@/app/(auth)/_components/submit-button|g"
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no output (zero errors). If errors appear, fix the flagged import paths manually.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move auth components into (auth)/_components"
```

---

## Task 2: Move settings slice components

**Files:**
- Move: `components/settings/` → `app/(main)/settings/_components/`
- Affects: any file importing `@/components/settings/...`

- [ ] **Step 1: Create the target directory**

```bash
mkdir -p "app/(main)/settings/_components"
```

- [ ] **Step 2: Move the entire directory**

```bash
git mv components/settings/identities.tsx "app/(main)/settings/_components/identities.tsx"
git mv components/settings/installations.tsx "app/(main)/settings/_components/installations.tsx"
git mv components/settings/preferences.tsx "app/(main)/settings/_components/preferences.tsx"
git mv components/settings/profile.tsx "app/(main)/settings/_components/profile.tsx"
git mv components/settings/settings-layout.tsx "app/(main)/settings/_components/settings-layout.tsx"
git mv components/settings/settings-sidebar.tsx "app/(main)/settings/_components/settings-sidebar.tsx"
```

- [ ] **Step 3: Find all importers**

```bash
grep -rl "@/components/settings" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 4: Update all imports**

```bash
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/components/settings/|@/app/(main)/settings/_components/|g"
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no output. Fix any flagged paths manually.

- [ ] **Step 6: Remove now-empty directory and commit**

```bash
rmdir components/settings
git add -A
git commit -m "refactor: move settings components into (main)/settings/_components"
```

---

## Task 3: Move admin slice components

**Files:**
- Move: `components/admin-*.tsx` → `app/(main)/admin/_components/`
- Affects: any file importing `@/components/admin-...`

- [ ] **Step 1: Create the target directory**

```bash
mkdir -p "app/(main)/admin/_components"
```

- [ ] **Step 2: Move the files**

```bash
git mv "components/admin-button.tsx" "app/(main)/admin/_components/admin-button.tsx"
git mv "components/admin-confirm-action-button.tsx" "app/(main)/admin/_components/admin-confirm-action-button.tsx"
git mv "components/admin-time-ago.tsx" "app/(main)/admin/_components/admin-time-ago.tsx"
git mv "components/admin-user-row-actions.tsx" "app/(main)/admin/_components/admin-user-row-actions.tsx"
git mv "components/admin-user-search.tsx" "app/(main)/admin/_components/admin-user-search.tsx"
```

- [ ] **Step 3: Find all importers**

```bash
grep -rl "@/components/admin-" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 4: Update all imports**

```bash
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/components/admin-button|@/app/(main)/admin/_components/admin-button|g;
   s|@/components/admin-confirm-action-button|@/app/(main)/admin/_components/admin-confirm-action-button|g;
   s|@/components/admin-time-ago|@/app/(main)/admin/_components/admin-time-ago|g;
   s|@/components/admin-user-row-actions|@/app/(main)/admin/_components/admin-user-row-actions|g;
   s|@/components/admin-user-search|@/app/(main)/admin/_components/admin-user-search|g"
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no output. Fix any flagged paths manually.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move admin components into (main)/admin/_components"
```

---

## Task 4: Move content editor UI components

**Files:**
- Move: `components/collection/`, `components/entry/`, `components/file/`, `components/media/`, `components/repo/`, `components/actions/`, `components/cache/`, `components/collaborators.tsx`
- Destination: `app/(main)/[owner]/[repo]/[branch]/_components/`
- Affects: any file importing from those paths

- [ ] **Step 1: Create target directories**

```bash
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/collection"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/entry"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/file"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/media"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/repo"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/actions"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_components/cache"
```

- [ ] **Step 2: Move the directories and lone file**

```bash
for f in components/collection/*; do git mv "$f" "app/(main)/[owner]/[repo]/[branch]/_components/collection/"; done
for f in components/entry/*; do git mv "$f" "app/(main)/[owner]/[repo]/[branch]/_components/entry/"; done
for f in components/file/*; do git mv "$f" "app/(main)/[owner]/[repo]/[branch]/_components/file/"; done
for f in components/media/*; do git mv "$f" "app/(main)/[owner]/[repo]/[branch]/_components/media/"; done
for f in components/repo/*; do git mv "$f" "app/(main)/[owner]/[repo]/[branch]/_components/repo/"; done
git mv "components/actions/actions-page.tsx" "app/(main)/[owner]/[repo]/[branch]/_components/actions/actions-page.tsx"
git mv "components/cache/cache-page.tsx" "app/(main)/[owner]/[repo]/[branch]/_components/cache/cache-page.tsx"
git mv "components/collaborators.tsx" "app/(main)/[owner]/[repo]/[branch]/_components/collaborators.tsx"
```

- [ ] **Step 3: Find all importers**

```bash
grep -rl \
  "@/components/collection\|@/components/entry\|@/components/file\|@/components/media\|@/components/repo\|@/components/actions\|@/components/cache\|@/components/collaborators" \
  . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 4: Update all imports**

```bash
EDITOR_BASE="@/app/(main)/[owner]/[repo]/[branch]/_components"
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/components/collection|${EDITOR_BASE}/collection|g;
   s|@/components/entry|${EDITOR_BASE}/entry|g;
   s|@/components/file/|${EDITOR_BASE}/file/|g;
   s|@/components/media|${EDITOR_BASE}/media|g;
   s|@/components/repo/|${EDITOR_BASE}/repo/|g;
   s|@/components/actions/|${EDITOR_BASE}/actions/|g;
   s|@/components/cache/|${EDITOR_BASE}/cache/|g;
   s|@/components/collaborators|${EDITOR_BASE}/collaborators|g"
```

> Note: `@/components/file/` and `@/components/repo/` use trailing slash in the sed pattern to avoid matching other prefixes.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -30
```

Expected: no output. Fix any flagged paths manually before proceeding.

- [ ] **Step 6: Remove now-empty directories and commit**

```bash
rmdir components/collection components/entry components/file components/media components/repo components/actions components/cache
git add -A
git commit -m "refactor: move content editor components into [owner]/[repo]/[branch]/_components"
```

---

## Task 5: Move fields into content editor slice

**Files:**
- Move: `fields/` → `app/(main)/[owner]/[repo]/[branch]/_fields/`
- Affects: any file importing from `@/fields/...`

- [ ] **Step 1: Move the entire fields directory**

```bash
git mv fields "app/(main)/[owner]/[repo]/[branch]/_fields"
```

- [ ] **Step 2: Find all importers**

```bash
grep -rl "@/fields" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 3: Update all imports**

```bash
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/fields/|@/app/(main)/[owner]/[repo]/[branch]/_fields/|g"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no output. Fix any flagged paths manually.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move fields into content editor _fields slice"
```

---

## Task 6: Move content editor contexts and hooks

**Files:**
- Move: `contexts/action-toast-context.tsx`, `contexts/collection-context.tsx`, `contexts/config-context.tsx`, `contexts/repo-context.tsx` → `app/(main)/[owner]/[repo]/[branch]/_contexts/`
- Move: `hooks/use-entry-store.ts`, `hooks/__tests__/use-entry-store.test.tsx` → `app/(main)/[owner]/[repo]/[branch]/_hooks/`
- Stays: `contexts/user-context.tsx` (shared, used in root layout), `hooks/use-mobile.ts` (shared)

- [ ] **Step 1: Create target directories**

```bash
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_contexts"
mkdir -p "app/(main)/[owner]/[repo]/[branch]/_hooks/__tests__"
```

- [ ] **Step 2: Move contexts**

```bash
git mv "contexts/action-toast-context.tsx" "app/(main)/[owner]/[repo]/[branch]/_contexts/action-toast-context.tsx"
git mv "contexts/collection-context.tsx" "app/(main)/[owner]/[repo]/[branch]/_contexts/collection-context.tsx"
git mv "contexts/config-context.tsx" "app/(main)/[owner]/[repo]/[branch]/_contexts/config-context.tsx"
git mv "contexts/repo-context.tsx" "app/(main)/[owner]/[repo]/[branch]/_contexts/repo-context.tsx"
```

- [ ] **Step 3: Move hooks**

```bash
git mv "hooks/use-entry-store.ts" "app/(main)/[owner]/[repo]/[branch]/_hooks/use-entry-store.ts"
git mv "hooks/__tests__/use-entry-store.test.tsx" "app/(main)/[owner]/[repo]/[branch]/_hooks/__tests__/use-entry-store.test.tsx"
```

- [ ] **Step 4: Find all importers**

```bash
grep -rl \
  "@/contexts/action-toast-context\|@/contexts/collection-context\|@/contexts/config-context\|@/contexts/repo-context\|@/hooks/use-entry-store" \
  . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

- [ ] **Step 5: Update imports**

```bash
EDITOR_BASE="@/app/(main)/[owner]/[repo]/[branch]"
find . \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs sed -i '' \
  "s|@/contexts/action-toast-context|${EDITOR_BASE}/_contexts/action-toast-context|g;
   s|@/contexts/collection-context|${EDITOR_BASE}/_contexts/collection-context|g;
   s|@/contexts/config-context|${EDITOR_BASE}/_contexts/config-context|g;
   s|@/contexts/repo-context|${EDITOR_BASE}/_contexts/repo-context|g;
   s|@/hooks/use-entry-store|${EDITOR_BASE}/_hooks/use-entry-store|g"
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no output. Fix any flagged paths manually.

- [ ] **Step 7: Clean up now-empty directories and commit**

```bash
# Only remove if empty (user-context.tsx stays in contexts/, use-mobile.ts stays in hooks/)
rmdir contexts 2>/dev/null || echo "contexts/ not empty — user-context.tsx remains (expected)"
git add -A
git commit -m "refactor: move content editor contexts and hooks into their slice"
```

---

## Task 7: Final verification and cleanup

- [ ] **Step 1: Full TypeScript check**

```bash
pnpm tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Run existing tests**

```bash
pnpm test 2>&1 | tail -20
```

Expected: same pass/fail ratio as before this refactor (no new failures from moved files).

- [ ] **Step 3: Check for any stale imports still pointing at old paths**

```bash
grep -r "@/components/collection\|@/components/entry\|@/components/file/\|@/components/media\|@/components/repo/\|@/components/actions/\|@/components/cache/\|@/components/settings/\|@/components/admin-\|@/fields/\|@/components/sign-in\|@/components/submit-button" \
  . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

Expected: no output. If any remain, update them manually.

- [ ] **Step 4: Verify dev server starts cleanly**

```bash
pnpm dev 2>&1 | head -30
```

Expected: "Ready" message with no module-not-found errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: complete vertical slice reorganization — all tasks done"
```
