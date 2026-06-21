# Reusable Deploy Workflow Design

**Date:** 2026-06-21  
**Status:** Approved

## Problem

`preview.yml` had no `environment:` set, so environment-scoped GitHub secrets were not available during PR deployments. `CLOUDFLARE_API_TOKEN` was empty, causing wrangler to fail. Both `preview.yml` and `release-please.yml` duplicated the full build + deploy step sequence.

## Solution

Extract a reusable `workflow_call` workflow. Each caller sets `environment: preview` or `environment: production`, which unlocks the correct environment-scoped secrets. `secrets: inherit` passes them to the reusable workflow.

## File Changes

| File | Action |
|---|---|
| `.github/workflows/deploy.yml` | New — reusable workflow |
| `.github/workflows/preview.yml` | Updated — calls reusable, splits into two jobs |
| `.github/workflows/release-please.yml` | Updated — deploy job calls reusable |

## Reusable Workflow (`deploy.yml`)

**Trigger:** `workflow_call`

**Inputs:**

| Name | Type | Default | Purpose |
|---|---|---|---|
| `worker-name` | string | `''` | When set, appends `--name` and `--var BASE_URL:...` to deploy command |
| `run-migrations` | boolean | `false` | Gates the D1 migrations step |

**Secrets declared in `workflow_call`:**

All keys are stored as GitHub Secrets. Everything is uploaded to the Worker via `wrangler secret put` — no `--var` flags, no values in deploy command logs.

| Name | Required | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | Wrangler auth only — not uploaded as Worker secret |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Wrangler account target only — not uploaded as Worker secret |
| `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | no | Used only to construct `BASE_URL` for preview — not uploaded as Worker secret |
| `BASE_URL` | yes | Static GitHub Secret for production. For preview: constructed dynamically in a shell step (`https://<worker-name>.<subdomain>.workers.dev`) and written to `$GITHUB_ENV` so wrangler-action picks it up from the environment |
| `BETTER_AUTH_SECRET` | yes | Uploaded as Worker secret |
| `CRYPTO_KEY` | yes | Uploaded as Worker secret |
| `GITHUB_APP_PRIVATE_KEY` | yes | Uploaded as Worker secret |
| `GITHUB_APP_WEBHOOK_SECRET` | no | Uploaded as Worker secret |
| `GITHUB_APP_CLIENT_SECRET` | yes | Uploaded as Worker secret |
| `ADMIN_EMAILS` | no | Uploaded as Worker secret |
| `GITHUB_APP_ID` | yes | Uploaded as Worker secret |
| `GITHUB_APP_NAME` | yes | Uploaded as Worker secret |
| `GITHUB_APP_CLIENT_ID` | yes | Uploaded as Worker secret |
| `EMAIL_FROM` | no | Uploaded as Worker secret |
| `CACHE_CHECK_MIN` | no | Uploaded as Worker secret (optional tuning) |
| `CONFIG_CHECK_MIN` | no | Uploaded as Worker secret (optional tuning) |
| `FILE_TTL_MIN` | no | Uploaded as Worker secret (optional tuning) |
| `PERMISSIONS_TTL_MIN` | no | Uploaded as Worker secret (optional tuning) |
| `BRANCH_HEAD_TTL_MS` | no | Uploaded as Worker secret (optional tuning) |
| `REPO_META_TTL_MS` | no | Uploaded as Worker secret (optional tuning) |
| `WEBHOOK_PUSH_INCREMENTAL_MAX_FILES` | no | Uploaded as Worker secret (optional tuning) |
| `WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES` | no | Uploaded as Worker secret (optional tuning) |

> `DATABASE_URL` is local dev only — not needed in CI.

**Outputs:**

| Name | Source | Purpose |
|---|---|---|
| `deployment-url` | `steps.deploy.outputs.deployment-url` | Forwarded to callers for PR comment |

**Job steps:**
1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` — node 22.23.0
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm build`
7. `wrangler d1 migrations apply pagescms --remote` — only when `run-migrations: true`
8. Shell step: if `worker-name` is set, construct `BASE_URL` and write to `$GITHUB_ENV` so it overrides the static secret value for this deployment
9. `cloudflare/wrangler-action@v3` — `deploy --name <worker-name>` (when set) with:
   - `secrets:` input listing all Worker secret names (one per line)
   - `env:` block mapping every static secret from `${{ secrets.KEY }}`; `BASE_URL` is already in env from step 8 when in preview

## `preview.yml` (updated)

**Two jobs replacing one:**

### `deploy` job
```
environment: preview
uses: ./.github/workflows/deploy.yml
secrets: inherit
with:
  worker-name: pagescms-pr-${{ github.event.pull_request.number }}
```

### `comment` job
- `needs: deploy`
- Runs existing `actions/github-script` logic
- Reads deployment URL from `needs.deploy.outputs.deployment-url`

## `release-please.yml` (updated)

### `deploy` job
```
environment: production
uses: ./.github/workflows/deploy.yml
secrets: inherit
with:
  run-migrations: true
permissions:
  contents: read
  deployments: write
```

## GitHub Environment Setup (manual, one-time)

Settings → Environments → create two environments. Both need the full set of secrets; values differ per environment.

All values are stored as GitHub Secrets. The table below lists every secret that must be configured per environment.

| Secret name | `preview` | `production` | Notes |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | preview token | production token | Wrangler auth only |
| `CLOUDFLARE_ACCOUNT_ID` | preview account ID | production account ID | Wrangler target only |
| `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | your subdomain | *(omit)* | Used to construct preview `BASE_URL` |
| `BASE_URL` | *(omit — constructed dynamically)* | e.g. `https://pagescms.example.com` | Preview value is generated at runtime |
| `BETTER_AUTH_SECRET` | preview value | production value | Worker secret |
| `CRYPTO_KEY` | preview value | production value | Worker secret |
| `GITHUB_APP_PRIVATE_KEY` | preview app key | production app key | Worker secret |
| `GITHUB_APP_WEBHOOK_SECRET` | preview value | production value | Worker secret |
| `GITHUB_APP_CLIENT_SECRET` | preview value | production value | Worker secret |
| `ADMIN_EMAILS` | preview admins | production admins | Worker secret |
| `GITHUB_APP_ID` | preview app ID | production app ID | Worker secret |
| `GITHUB_APP_NAME` | preview app name | production app name | Worker secret |
| `GITHUB_APP_CLIENT_ID` | preview client ID | production client ID | Worker secret |
| `EMAIL_FROM` | preview sender | production sender | Worker secret |
| `CACHE_CHECK_MIN` | optional | optional | Worker secret |
| `CONFIG_CHECK_MIN` | optional | optional | Worker secret |
| `FILE_TTL_MIN` | optional | optional | Worker secret |
| `PERMISSIONS_TTL_MIN` | optional | optional | Worker secret |
| `BRANCH_HEAD_TTL_MS` | optional | optional | Worker secret |
| `REPO_META_TTL_MS` | optional | optional | Worker secret |
| `WEBHOOK_PUSH_INCREMENTAL_MAX_FILES` | optional | optional | Worker secret |
| `WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES` | optional | optional | Worker secret |

Optional tuning secrets can be omitted if application defaults are acceptable.

This is required for secret scoping to work. No code change can substitute for it.
