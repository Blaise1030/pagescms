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

**Secrets:**

| Name | Required | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | Wrangler auth |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Wrangler account |
| `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | no | Needed when `worker-name` is set to construct `BASE_URL` |

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
8. Shell step to build deploy command — appends `--name` and `--var BASE_URL:...` when `worker-name` is non-empty
9. `cloudflare/wrangler-action@v3` — runs the constructed command

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

Settings → Environments → create two environments:

| Environment | Secrets |
|---|---|
| `preview` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` |
| `production` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

This is required for secret scoping to work. No code change can substitute for it.
