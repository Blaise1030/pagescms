# PostgreSQL → Cloudflare D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PostgreSQL database layer with Cloudflare D1 (SQLite), accessed natively via the `cloudflare:workers` binding.

**Architecture:** Drizzle ORM switches from `drizzle-orm/postgres-js` to `drizzle-orm/d1`. The D1 database is declared as a binding (`DB`) in `wrangler.jsonc` and accessed via `import { env } from "cloudflare:workers"`. All PostgreSQL-specific schema types are converted to their SQLite equivalents.

**Tech Stack:** Drizzle ORM (`drizzle-orm/d1`), Cloudflare D1, Wrangler, `vinext` (Cloudflare Workers deployment)

## Global Constraints

- This is a fresh database — no data migration needed
- Deployment target is Cloudflare Workers via `vinext`
- D1 binding name must be `DB` (matches `env.DB` in `db/index.ts`)
- Drizzle version already installed: `^0.45.1` — supports D1 natively
- Do NOT use `@next/env` or `DATABASE_URL` — D1 uses a Worker binding, not a URL
- Do NOT add `postbuild` auto-migration — migrations must be applied explicitly

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `db/schema.ts` | Switch from pg-core to sqlite-core types |
| Modify | `db/index.ts` | Replace postgres driver with D1 binding |
| Modify | `drizzle.config.ts` | Switch dialect to sqlite, use d1-http driver |
| Modify | `package.json` | Remove `postgres` dep, remove `postbuild` script |
| Create | `wrangler.jsonc` | Declare D1 binding for Cloudflare Workers |
| Delete | `db/envConfig.ts` | No longer needed (no DATABASE_URL) |
| Delete | `db/migrations/*.sql` + `*.json` | Old PostgreSQL migrations, will regenerate |
| Regenerate | `db/migrations/` | Fresh SQLite migrations via drizzle-kit generate |

---

## Task 1: Scaffold — wrangler.jsonc, package.json, delete envConfig

**Files:**
- Create: `wrangler.jsonc`
- Modify: `package.json`
- Delete: `db/envConfig.ts`

**Interfaces:**
- Produces: `env.DB` binding available to Workers runtime; `postgres` package removed

- [ ] **Step 1: Create `wrangler.jsonc`**

Create `/Users/blaisetiong/Developer/projects/cms/pagescms/wrangler.jsonc` with this content:

```jsonc
{
  "name": "pagescms",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "pagescms",
      "database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID"
    }
  ]
}
```

> After creating the D1 database with `wrangler d1 create pagescms`, replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the returned database ID.

- [ ] **Step 2: Remove `postgres` dep and `postbuild` script from `package.json`**

In `package.json`, remove the line `"postgres": "^3.4.7"` from `dependencies`.

Also remove the `"postbuild"` script entry:
```json
"postbuild": "npm run db:migrate",
```

The `db:generate` and `db:migrate` scripts stay unchanged.

- [ ] **Step 3: Delete `db/envConfig.ts`**

```bash
rm /Users/blaisetiong/Developer/projects/cms/pagescms/db/envConfig.ts
```

- [ ] **Step 4: Run `npm install` to remove the `postgres` package**

```bash
npm install
```

Expected: `package-lock.json` updated, `node_modules/postgres` no longer present.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc package.json package-lock.json
git rm db/envConfig.ts
git commit -m "chore: scaffold D1 — add wrangler.jsonc, remove postgres dep and envConfig"
```

---

## Task 2: Rewrite `db/schema.ts` for SQLite/D1

**Files:**
- Modify: `db/schema.ts`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: all table exports unchanged (`userTable`, `sessionTable`, `accountTable`, `verificationTable`, `githubInstallationTokenTable`, `collaboratorTable`, `collaboratorInviteTable`, `configTable`, `cacheFileTable`, `cacheFileMetaTable`, `cachePermissionTable`, `actionRunTable`)

**Type conversion reference:**
| pg-core | sqlite-core equivalent |
|---------|----------------------|
| `pgTable` | `sqliteTable` |
| `serial("x").primaryKey()` | `integer("x").primaryKey({ autoIncrement: true })` |
| `boolean("x").notNull().default(false)` | `integer("x", { mode: 'boolean' }).notNull().default(false)` |
| `timestamp("x").notNull().defaultNow()` | `integer("x", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())` |
| `timestamp("x").notNull()` (no default) | `integer("x", { mode: 'timestamp' }).notNull()` |
| `timestamp("x")` (nullable) | `integer("x", { mode: 'timestamp' })` |
| `jsonb("x").notNull()` | `text("x", { mode: 'json' }).notNull()` |
| `jsonb("x")` (nullable) | `text("x", { mode: 'json' })` |
| `bigint("x", { mode: "number" })` | `integer("x")` |

- [ ] **Step 1: Replace `db/schema.ts` entirely**

Replace the full contents of `db/schema.ts` with:

```ts
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const userTable = sqliteTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  githubUsername: text("github_username"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: 'boolean' }).notNull().default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

const sessionTable = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
}, table => ({
  idx_session_userId: index("idx_session_userId").on(table.userId),
}));

const accountTable = sqliteTable("account", {
  id: text("id").notNull().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: 'timestamp' }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => ({
  idx_account_userId: index("idx_account_userId").on(table.userId),
  idx_account_providerId: index("idx_account_providerId").on(table.providerId),
}));

const verificationTable = sqliteTable("verification", {
  id: text("id").notNull().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => ({
  idx_verification_identifier: index("idx_verification_identifier").on(table.identifier),
}));

const githubInstallationTokenTable = sqliteTable("github_installation_token", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  installationId: integer("installation_id").notNull(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
}, table => ({
  uq_github_installation_token_installationId: uniqueIndex("uq_github_installation_token_installationId").on(table.installationId),
}));

const collaboratorTable = sqliteTable("collaborator", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  installationId: integer("installation_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  repoId: integer("repo_id"),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch"),
  email: text("email").notNull(),
  userId: text("user_id").references(() => userTable.id),
  invitedBy: text("invited_by").references(() => userTable.id),
}, table => ({
  idx_collaborator_owner_repo_email: index("idx_collaborator_owner_repo_email").on(table.owner, table.repo, table.email),
  idx_collaborator_userId: index("idx_collaborator_userId").on(table.userId),
  uq_collaborator_owner_repo_email_ci: uniqueIndex("uq_collaborator_owner_repo_email_ci").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    sql`lower(${table.email})`,
  ),
}));

const collaboratorInviteTable = sqliteTable("collaborator_invite", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull(),
  email: text("email").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => ({
  uq_collaborator_invite_token: uniqueIndex("uq_collaborator_invite_token").on(table.token),
  idx_collaborator_invite_owner_repo_email: index("idx_collaborator_invite_owner_repo_email").on(table.owner, table.repo, table.email),
  uq_collaborator_invite_owner_repo_email_ci: uniqueIndex("uq_collaborator_invite_owner_repo_email_ci").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    sql`lower(${table.email})`,
  ),
}));

const configTable = sqliteTable("config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  sha: text("sha").notNull(),
  version: text("version").notNull(),
  object: text("object").notNull(),
  lastCheckedAt: integer("last_checked_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => ({
  idx_config_owner_repo_branch: uniqueIndex("idx_config_owner_repo_branch").on(table.owner, table.repo, table.branch),
}));

const cacheFileTable = sqliteTable("cache_file", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  context: text("context").notNull().default('collection'),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  parentPath: text("parent_path").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  sha: text("sha"),
  size: integer("size"),
  downloadUrl: text("download_url"),
  commitSha: text("commit_sha"),
  commitTimestamp: integer("commit_timestamp", { mode: 'timestamp' }),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
}, table => ({
  idx_cache_file_owner_repo_branch_parentPath: index("idx_cache_file_owner_repo_branch_parentPath").on(table.owner, table.repo, table.branch, table.parentPath),
  idx_cache_file_owner_repo_branch_path: uniqueIndex("idx_cache_file_owner_repo_branch_path").on(table.owner, table.repo, table.branch, table.path),
}));

const cacheFileMetaTable = sqliteTable("cache_file_meta", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  path: text("path").notNull().default(""),
  context: text("context").notNull().default("branch"),
  commitSha: text("commit_sha"),
  commitTimestamp: integer("commit_timestamp", { mode: 'timestamp' }),
  status: text("status").notNull().default("ok"),
  error: text("error"),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastCheckedAt: integer("last_checked_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => ({
  idx_cache_file_meta_owner_repo_branch_path_context: uniqueIndex("idx_cache_file_meta_owner_repo_branch_path_context").on(table.owner, table.repo, table.branch, table.path, table.context),
}));

const cachePermissionTable = sqliteTable("cache_permission", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: integer("github_id").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  lastUpdated: integer("last_updated", { mode: 'timestamp' }).notNull(),
}, table => ({
  idx_cache_permission_githubId_owner_repo: uniqueIndex("idx_cache_permission_githubId_owner_repo").on(table.githubId, table.owner, table.repo),
}));

const actionRunTable = sqliteTable("action_run", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  ref: text("ref").notNull(),
  workflowRef: text("workflow_ref").notNull(),
  sha: text("sha").notNull(),
  actionName: text("action_name").notNull(),
  contextType: text("context_type").notNull(),
  contextName: text("context_name"),
  contextPath: text("context_path"),
  workflow: text("workflow").notNull(),
  workflowRunId: integer("workflow_run_id"),
  status: text("status").notNull(),
  conclusion: text("conclusion"),
  htmlUrl: text("html_url"),
  triggeredBy: text("triggered_by", { mode: 'json' }).notNull(),
  failure: text("failure", { mode: 'json' }),
  payload: text("payload", { mode: 'json' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
}, table => ({
  idx_action_run_owner_repo_createdAt: index("idx_action_run_owner_repo_createdAt").on(table.owner, table.repo, table.createdAt),
  idx_action_run_owner_repo_actionName: index("idx_action_run_owner_repo_actionName").on(table.owner, table.repo, table.actionName),
  idx_action_run_owner_repo_status: index("idx_action_run_owner_repo_status").on(table.owner, table.repo, table.status),
  idx_action_run_context: index("idx_action_run_context").on(table.owner, table.repo, table.contextType, table.contextName, table.contextPath),
  idx_action_run_workflowRunId: uniqueIndex("idx_action_run_workflowRunId").on(table.workflowRunId),
}));

export {
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
  githubInstallationTokenTable,
  collaboratorTable,
  collaboratorInviteTable,
  configTable,
  cacheFileTable,
  cacheFileMetaTable,
  cachePermissionTable,
  actionRunTable,
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `db/schema.ts`. If there are errors about `drizzle-orm/sqlite-core` not found, skip — they'll resolve after Task 3 wires in the D1 driver types.

- [ ] **Step 3: Commit**

```bash
git add db/schema.ts
git commit -m "feat: convert schema from pg-core to sqlite-core for D1"
```

---

## Task 3: Rewrite `db/index.ts` and `drizzle.config.ts`

**Files:**
- Modify: `db/index.ts`
- Modify: `drizzle.config.ts`

**Interfaces:**
- Consumes: `env.DB` from Cloudflare Workers runtime (declared in `wrangler.jsonc` from Task 1)
- Produces: `db` export — `DrizzleD1Database` instance, same API as before for all callers (`lib/auth.ts`, queries, etc.)

- [ ] **Step 1: Replace `db/index.ts` entirely**

Replace the full contents of `db/index.ts` with:

```ts
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export const db = drizzle(env.DB, { schema });
```

- [ ] **Step 2: Replace `drizzle.config.ts` entirely**

Replace the full contents of `drizzle.config.ts` with:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `Cannot find module 'cloudflare:workers'`, run `wrangler types` to generate the type declarations, then re-run.

- [ ] **Step 4: Commit**

```bash
git add db/index.ts drizzle.config.ts
git commit -m "feat: switch DB client from postgres to Cloudflare D1 binding"
```

---

## Task 4: Delete old migrations and regenerate for SQLite

**Files:**
- Delete: `db/migrations/*.sql`, `db/migrations/*.json`
- Regenerate: `db/migrations/` (fresh SQLite SQL files)

**Interfaces:**
- Consumes: `db/schema.ts` (SQLite types from Task 2), `drizzle.config.ts` (sqlite dialect from Task 3)
- Produces: one or more `.sql` migration files in SQLite syntax, ready to apply to D1

- [ ] **Step 1: Delete all existing migration files**

```bash
rm db/migrations/*.sql db/migrations/*.json 2>/dev/null; echo "done"
```

Expected output: `done`

- [ ] **Step 2: Generate fresh SQLite migrations**

```bash
npx drizzle-kit generate
```

Expected: drizzle-kit creates one or more `.sql` files in `db/migrations/` using SQLite syntax (e.g., `INTEGER`, `TEXT`, no `SERIAL`, no `JSONB`).

- [ ] **Step 3: Inspect the generated migration**

```bash
cat db/migrations/*.sql
```

Verify:
- No `SERIAL` (should be `INTEGER` with `AUTOINCREMENT`)
- No `JSONB` (should be `TEXT`)
- No `BOOLEAN` (should be `INTEGER`)
- No `TIMESTAMP WITH TIME ZONE` (should be `INTEGER`)

- [ ] **Step 4: Create a D1 database (if not done yet)**

```bash
wrangler d1 create pagescms
```

Copy the `database_id` from the output and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.jsonc`.

- [ ] **Step 5: Apply migrations locally to verify they run**

```bash
wrangler d1 migrations apply pagescms --local
```

Expected: migrations apply cleanly with no SQL errors.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/ wrangler.jsonc
git commit -m "feat: regenerate migrations for SQLite/D1"
```

---

## Verification

After all tasks complete:

1. **Type check:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: zero errors.

2. **Start dev server:**
   ```bash
   npm run dev:vinext
   ```
   Expected: app starts, no database connection errors in console.

3. **Test auth flow:** Visit the app, trigger sign-in (email OTP or GitHub). Confirm session is created and stored in D1.

4. **Production migration:** Set environment variables, then:
   ```bash
   npm run db:migrate
   ```
   (Requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` in env.)
