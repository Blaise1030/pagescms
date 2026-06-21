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

| Name | Required | How used |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | Wrangler auth |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Wrangler account target |
| `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | no | Constructs `BASE_URL` for preview deployments |
| `BETTER_AUTH_SECRET` | yes | Uploaded as Worker secret via `wrangler secret put` |
| `CRYPTO_KEY` | yes | Uploaded as Worker secret via `wrangler secret put` |
| `GITHUB_APP_PRIVATE_KEY` | yes | Uploaded as Worker secret via `wrangler secret put` |
| `GITHUB_APP_WEBHOOK_SECRET` | no | Uploaded as Worker secret via `wrangler secret put` |
| `GITHUB_APP_CLIENT_SECRET` | yes | Uploaded as Worker secret via `wrangler secret put` |
| `ADMIN_EMAILS` | no | Passed as `--var ADMIN_EMAILS:...` in deploy command |
| `GITHUB_APP_ID` | yes | Passed as `--var GITHUB_APP_ID:...` in deploy command |
| `GITHUB_APP_NAME` | yes | Passed as `--var GITHUB_APP_NAME:...` in deploy command |
| `GITHUB_APP_CLIENT_ID` | yes | Passed as `--var GITHUB_APP_CLIENT_ID:...` in deploy command |
| `EMAIL_FROM` | no | Passed as `--var EMAIL_FROM:...` in deploy command |
| `CACHE_CHECK_MIN` | no | Passed as `--var` (optional tuning, has default) |
| `CONFIG_CHECK_MIN` | no | Passed as `--var` (optional tuning, has default) |
| `FILE_TTL_MIN` | no | Passed as `--var` (optional tuning, has default) |
| `PERMISSIONS_TTL_MIN` | no | Passed as `--var` (optional tuning, has default) |
| `BRANCH_HEAD_TTL_MS` | no | Passed as `--var` (optional tuning, has default) |
| `REPO_META_TTL_MS` | no | Passed as `--var` (optional tuning, has default) |
| `WEBHOOK_PUSH_INCREMENTAL_MAX_FILES` | no | Passed as `--var` (optional tuning, has default) |
| `WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES` | no | Passed as `--var` (optional tuning, has default) |

> `BASE_URL` is constructed dynamically (not stored as a secret). `DATABASE_URL` is local dev only — not needed in CI.

**Sensitive vs config split:**

- **Sensitive** (uploaded via `wrangler secret put` using the wrangler-action `secrets:` input): `BETTER_AUTH_SECRET`, `CRYPTO_KEY`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_SECRET`
- **Config vars** (passed as `--var KEY:VALUE` in deploy command): all others above

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
8. Shell step to build deploy command — appends `--name`, `--var BASE_URL:...`, and all config `--var` flags
9. `cloudflare/wrangler-action@v3` — runs the constructed command, with `secrets:` input listing the 5 sensitive keys and `env:` block mapping each secret from `${{ secrets.* }}`

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

### Secrets (sensitive — uploaded to Worker via `wrangler secret put`)

| Secret name | `preview` | `production` |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | preview token | production token |
| `CLOUDFLARE_ACCOUNT_ID` | preview account | production account |
| `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | your subdomain | *(not needed)* |
| `BETTER_AUTH_SECRET` | preview value | production value |
| `CRYPTO_KEY` | preview value | production value |
| `GITHUB_APP_PRIVATE_KEY` | preview app key | production app key |
| `GITHUB_APP_WEBHOOK_SECRET` | preview webhook secret | production webhook secret |
| `GITHUB_APP_CLIENT_SECRET` | preview client secret | production client secret |

### Variables (config — passed as `--var` at deploy time)

| Variable name | `preview` | `production` |
|---|---|---|
| `ADMIN_EMAILS` | preview admin emails | production admin emails |
| `GITHUB_APP_ID` | preview app ID | production app ID |
| `GITHUB_APP_NAME` | preview app name | production app name |
| `GITHUB_APP_CLIENT_ID` | preview client ID | production client ID |
| `EMAIL_FROM` | preview sender | production sender |
| `CACHE_CHECK_MIN` | optional | optional |
| `CONFIG_CHECK_MIN` | optional | optional |
| `FILE_TTL_MIN` | optional | optional |
| `PERMISSIONS_TTL_MIN` | optional | optional |
| `BRANCH_HEAD_TTL_MS` | optional | optional |
| `REPO_META_TTL_MS` | optional | optional |
| `WEBHOOK_PUSH_INCREMENTAL_MAX_FILES` | optional | optional |
| `WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES` | optional | optional |

This is required for secret scoping to work. No code change can substitute for it.
