# Design: Migrate PostgreSQL → Cloudflare D1

**Date:** 2026-06-20  
**Status:** Approved

## Background

The CMS is a Next.js app deployed to Cloudflare Workers via `vinext`. The database layer uses the `postgres` npm package + Drizzle ORM with the PostgreSQL dialect. The goal is to replace it with Cloudflare D1 (SQLite-based), accessed natively via the `cloudflare:workers` binding. This is a fresh database — no data migration required.

## Architecture

D1 is accessed as a Cloudflare Worker binding (`env.DB`), declared in `wrangler.jsonc`. Drizzle wraps it with the `drizzle-orm/d1` driver. No external DB URL or connection pooling is needed.

```
App code → drizzle(env.DB) → D1 binding → Cloudflare D1 (SQLite)
```

`better-auth` continues to use the same `drizzleAdapter` pointing at `db` — no changes needed there.

## Components

### `db/schema.ts`
Switch imports from `drizzle-orm/pg-core` to `drizzle-orm/sqlite-core`. Type substitutions:

| PostgreSQL | SQLite/D1 |
|---|---|
| `pgTable` | `sqliteTable` |
| `serial("x").primaryKey()` | `integer("x").primaryKey({ autoIncrement: true })` |
| `boolean("x")` | `integer("x", { mode: 'boolean' })` |
| `timestamp("x").defaultNow()` | `integer("x", { mode: 'timestamp' }).$defaultFn(() => new Date())` |
| `jsonb("x")` | `text("x", { mode: 'json' })` |
| `bigint("x", { mode: "number" })` | `integer("x")` |

The `sql\`lower(...)\`` expressions in `collaboratorInviteTable` case-insensitive unique indexes are SQLite-native — no change needed.

### `db/index.ts`
Replace the postgres connection pool with a D1 binding one-liner:

```ts
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export const db = drizzle(env.DB, { schema });
```

Remove the global singleton pooling pattern — D1 manages connections at the Worker level.

### `drizzle.config.ts`
Switch to `dialect: "sqlite"` with `driver: "d1-http"`. Migration against D1 uses three env vars: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`.

### `wrangler.jsonc` (new file)
Declares the D1 database binding `DB` which maps to `env.DB` in the worker runtime.

### `db/migrations/`
Delete all 13 existing PostgreSQL `.sql` migration files. Regenerate fresh SQLite migrations with `npx drizzle-kit generate`.

### `package.json`
- Remove `"postgres"` dependency
- Remove `"postbuild": "npm run db:migrate"` — auto-migrating production D1 on build is unsafe; migrations are applied explicitly

### `db/envConfig.ts` (delete)
Only existed to load `DATABASE_URL` for the postgres driver. No longer needed.

## Data Flow

1. Request hits Cloudflare Worker
2. `env.DB` is resolved by the Workers runtime from `wrangler.jsonc` binding
3. `drizzle(env.DB)` wraps the D1 client
4. Queries execute via D1's SQLite engine

## Error Handling

No new error handling needed. D1 errors surface as exceptions from drizzle just like PostgreSQL did. The `better-auth` adapter is unchanged.

## Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. Create D1 database: `wrangler d1 create pagescms`, copy ID into `wrangler.jsonc`
3. Apply migrations locally: `wrangler d1 migrations apply pagescms --local`
4. `npm run dev:vinext` — app starts, D1 binding resolves, auth flows work
5. For production: set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`, then `npm run db:migrate`
