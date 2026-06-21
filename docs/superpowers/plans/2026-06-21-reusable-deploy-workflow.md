# Reusable Deploy Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable GitHub Actions deploy workflow so preview and production deployments get environment-scoped secrets via GitHub Environments.

**Architecture:** A new `deploy.yml` reusable `workflow_call` workflow handles checkout, install, lint, build, optional D1 migrations, dynamic BASE_URL construction, and wrangler deploy with all app secrets uploaded via `wrangler secret put`. `preview.yml` and `release-please.yml` each call it with `environment: preview` or `environment: production` + `secrets: inherit`, which scopes the correct secret values per environment.

**Tech Stack:** GitHub Actions `workflow_call`, `cloudflare/wrangler-action@v3`, pnpm, Node 22.23.0

## Global Constraints

- Node version: `22.23.0` (pinned exactly — do not change)
- pnpm setup: `pnpm/action-setup@v4` (no version pin needed, follows `packageManager` field in package.json)
- Wrangler action: `cloudflare/wrangler-action@v3`
- All Worker secrets uploaded via `wrangler secret put` — no `--var` flags for app config
- `BASE_URL` for preview is constructed at runtime: `https://<worker-name>.<CLOUDFLARE_WORKERS_DEV_SUBDOMAIN>.workers.dev`
- `BASE_URL` for production is a static GitHub Secret
- `DATABASE_URL` is local dev only — must not appear in any workflow

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `.github/workflows/deploy.yml` | **Create** | Reusable workflow: build + optional migrations + wrangler deploy with all secrets |
| `.github/workflows/preview.yml` | **Modify** | Call reusable deploy with `environment: preview`; separate job posts PR comment |
| `.github/workflows/release-please.yml` | **Modify** | Call reusable deploy with `environment: production` after release-please creates a release |

---

## Task 1: Create `.github/workflows/deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: reusable workflow callable via `uses: ./.github/workflows/deploy.yml`
  - Input `worker-name` (string, default `''`) — when non-empty, sets worker name and constructs preview BASE_URL
  - Input `run-migrations` (boolean, default `false`) — gates D1 migration step
  - Output `deployment-url` (string) — the Cloudflare deployment URL

- [ ] **Step 1: Create the file**

```yaml
name: Deploy

on:
  workflow_call:
    inputs:
      worker-name:
        type: string
        default: ''
      run-migrations:
        type: boolean
        default: false
    outputs:
      deployment-url:
        description: Cloudflare deployment URL
        value: ${{ jobs.deploy.outputs.deployment-url }}
    secrets:
      CLOUDFLARE_API_TOKEN:
        required: true
      CLOUDFLARE_ACCOUNT_ID:
        required: true
      CLOUDFLARE_WORKERS_DEV_SUBDOMAIN:
        required: false
      BASE_URL:
        required: false
      BETTER_AUTH_SECRET:
        required: true
      CRYPTO_KEY:
        required: true
      GITHUB_APP_PRIVATE_KEY:
        required: true
      GITHUB_APP_WEBHOOK_SECRET:
        required: false
      GITHUB_APP_CLIENT_SECRET:
        required: true
      ADMIN_EMAILS:
        required: false
      GITHUB_APP_ID:
        required: true
      GITHUB_APP_NAME:
        required: true
      GITHUB_APP_CLIENT_ID:
        required: true
      EMAIL_FROM:
        required: false
      CACHE_CHECK_MIN:
        required: false
      CONFIG_CHECK_MIN:
        required: false
      FILE_TTL_MIN:
        required: false
      PERMISSIONS_TTL_MIN:
        required: false
      BRANCH_HEAD_TTL_MS:
        required: false
      REPO_META_TTL_MS:
        required: false
      WEBHOOK_PUSH_INCREMENTAL_MAX_FILES:
        required: false
      WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES:
        required: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      deployment-url: ${{ steps.deploy.outputs.deployment-url }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22.23.0
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: Apply D1 migrations
        if: ${{ inputs.run-migrations }}
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 migrations apply pagescms --remote

      - name: Set BASE_URL for preview
        if: ${{ inputs.worker-name != '' }}
        run: echo "BASE_URL=https://${{ inputs.worker-name }}.${{ secrets.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN }}.workers.dev" >> $GITHUB_ENV

      - name: Deploy to Cloudflare Workers
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy${{ inputs.worker-name != '' && format(' --name {0}', inputs.worker-name) || '' }}
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          secrets: |
            BASE_URL
            BETTER_AUTH_SECRET
            CRYPTO_KEY
            GITHUB_APP_PRIVATE_KEY
            GITHUB_APP_WEBHOOK_SECRET
            GITHUB_APP_CLIENT_SECRET
            ADMIN_EMAILS
            GITHUB_APP_ID
            GITHUB_APP_NAME
            GITHUB_APP_CLIENT_ID
            EMAIL_FROM
            CACHE_CHECK_MIN
            CONFIG_CHECK_MIN
            FILE_TTL_MIN
            PERMISSIONS_TTL_MIN
            BRANCH_HEAD_TTL_MS
            REPO_META_TTL_MS
            WEBHOOK_PUSH_INCREMENTAL_MAX_FILES
            WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES
        env:
          BASE_URL: ${{ env.BASE_URL || secrets.BASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
          CRYPTO_KEY: ${{ secrets.CRYPTO_KEY }}
          GITHUB_APP_PRIVATE_KEY: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
          GITHUB_APP_WEBHOOK_SECRET: ${{ secrets.GITHUB_APP_WEBHOOK_SECRET }}
          GITHUB_APP_CLIENT_SECRET: ${{ secrets.GITHUB_APP_CLIENT_SECRET }}
          ADMIN_EMAILS: ${{ secrets.ADMIN_EMAILS }}
          GITHUB_APP_ID: ${{ secrets.GITHUB_APP_ID }}
          GITHUB_APP_NAME: ${{ secrets.GITHUB_APP_NAME }}
          GITHUB_APP_CLIENT_ID: ${{ secrets.GITHUB_APP_CLIENT_ID }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          CACHE_CHECK_MIN: ${{ secrets.CACHE_CHECK_MIN }}
          CONFIG_CHECK_MIN: ${{ secrets.CONFIG_CHECK_MIN }}
          FILE_TTL_MIN: ${{ secrets.FILE_TTL_MIN }}
          PERMISSIONS_TTL_MIN: ${{ secrets.PERMISSIONS_TTL_MIN }}
          BRANCH_HEAD_TTL_MS: ${{ secrets.BRANCH_HEAD_TTL_MS }}
          REPO_META_TTL_MS: ${{ secrets.REPO_META_TTL_MS }}
          WEBHOOK_PUSH_INCREMENTAL_MAX_FILES: ${{ secrets.WEBHOOK_PUSH_INCREMENTAL_MAX_FILES }}
          WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES: ${{ secrets.WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add reusable deploy workflow"
```

---

## Task 2: Update `preview.yml`

**Files:**
- Modify: `.github/workflows/preview.yml`

**Interfaces:**
- Consumes: `.github/workflows/deploy.yml` output `deployment-url`

- [ ] **Step 1: Replace the file contents**

```yaml
name: Preview

on:
  pull_request:
    branches:
      - main
    types: [opened, synchronize, reopened]

concurrency:
  group: preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write
  deployments: write

jobs:
  deploy:
    environment: preview
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
    with:
      worker-name: pagescms-pr-${{ github.event.pull_request.number }}

  comment:
    needs: deploy
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        env:
          DEPLOYMENT_URL: ${{ needs.deploy.outputs.deployment-url }}
          PREVIEW_WORKER_NAME: pagescms-pr-${{ github.event.pull_request.number }}
        with:
          script: |
            const deploymentUrl = process.env.DEPLOYMENT_URL;
            const workerName = process.env.PREVIEW_WORKER_NAME;
            const sha = context.payload.pull_request.head.sha.slice(0, 7);

            const body = [
              '## Preview deployment',
              '',
              `**URL:** ${deploymentUrl}`,
              `**Worker:** \`${workerName}\``,
              `**Commit:** \`${sha}\``,
              '',
              '_Updated on each push to this PR._',
            ].join('\n');

            const marker = '<!-- pagescms-preview-comment -->';
            const fullBody = `${marker}\n${body}`;

            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const existing = comments.find((comment) =>
              comment.body?.includes(marker),
            );

            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body: fullBody,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: fullBody,
              });
            }
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/preview.yml
git commit -m "ci: update preview workflow to use reusable deploy"
```

---

## Task 3: Update `release-please.yml`

**Files:**
- Modify: `.github/workflows/release-please.yml`

**Interfaces:**
- Consumes: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace the deploy job in the file**

Replace the existing `deploy` job (lines 30–68) with:

```yaml
  deploy:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    environment: production
    permissions:
      contents: read
      deployments: write
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
    with:
      run-migrations: true
```

The full file after the change:

```yaml
name: Release Please

on:
  push:
    branches:
      - main

concurrency:
  group: release-please
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  deploy:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    environment: production
    permissions:
      contents: read
      deployments: write
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
    with:
      run-migrations: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-please.yml
git commit -m "ci: update release-please workflow to use reusable deploy"
```

---

## Task 4: Manual GitHub Environment Setup (one-time)

This is a manual step — no code change can do it.

- [ ] **Step 1: Create `preview` environment**

Go to: GitHub repo → Settings → Environments → New environment → name it `preview`

Add these secrets (values are your preview/staging Cloudflare credentials):

```
CLOUDFLARE_API_TOKEN          = <preview CF api token>
CLOUDFLARE_ACCOUNT_ID         = <preview CF account id>
CLOUDFLARE_WORKERS_DEV_SUBDOMAIN = <your workers.dev subdomain, e.g. "myname">
BETTER_AUTH_SECRET            = <random string>
CRYPTO_KEY                    = <random base64 string>
GITHUB_APP_PRIVATE_KEY        = <-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY----->
GITHUB_APP_WEBHOOK_SECRET     = <random string>
GITHUB_APP_CLIENT_SECRET      = <preview GitHub App client secret>
ADMIN_EMAILS                  = <comma-separated admin emails>
GITHUB_APP_ID                 = <preview GitHub App ID>
GITHUB_APP_NAME               = <preview GitHub App machine name>
GITHUB_APP_CLIENT_ID          = <preview GitHub App client ID>
EMAIL_FROM                    = <e.g. "Pages CMS <no-reply@yourdomain.com>">
```

Optional tuning (omit to use application defaults):
```
CACHE_CHECK_MIN
CONFIG_CHECK_MIN
FILE_TTL_MIN
PERMISSIONS_TTL_MIN
BRANCH_HEAD_TTL_MS
REPO_META_TTL_MS
WEBHOOK_PUSH_INCREMENTAL_MAX_FILES
WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES
```

Note: `BASE_URL` is **not** set in the preview environment — it is constructed dynamically at runtime as `https://pagescms-pr-<N>.<CLOUDFLARE_WORKERS_DEV_SUBDOMAIN>.workers.dev`.

- [ ] **Step 2: Create `production` environment**

Go to: GitHub repo → Settings → Environments → New environment → name it `production`

Add these secrets (values are your production Cloudflare credentials):

```
CLOUDFLARE_API_TOKEN          = <production CF api token>
CLOUDFLARE_ACCOUNT_ID         = <production CF account id>
BASE_URL                      = <e.g. "https://pagescms.yourdomain.com">
BETTER_AUTH_SECRET            = <production random string>
CRYPTO_KEY                    = <production random base64 string>
GITHUB_APP_PRIVATE_KEY        = <production -----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY----->
GITHUB_APP_WEBHOOK_SECRET     = <production random string>
GITHUB_APP_CLIENT_SECRET      = <production GitHub App client secret>
ADMIN_EMAILS                  = <comma-separated admin emails>
GITHUB_APP_ID                 = <production GitHub App ID>
GITHUB_APP_NAME               = <production GitHub App machine name>
GITHUB_APP_CLIENT_ID          = <production GitHub App client ID>
EMAIL_FROM                    = <e.g. "Pages CMS <no-reply@yourdomain.com>">
```

Same optional tuning secrets apply.

Note: `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` is **not** needed in production.
