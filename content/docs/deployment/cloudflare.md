---
title: "Cloudflare Workers"
description: "Deploy this PagesCMS fork on Cloudflare Workers with D1, Wrangler, and a GitHub App."
---

## What you need

- Node.js 22.18+
- A Cloudflare account with Workers and D1 enabled
- A GitHub App for repository access
- Environment secrets for auth and encryption

## 1. Clone and install

```bash
git clone https://github.com/Blaise1030/pagescms.git
cd pagescms
npm install
```

## 2. Configure secrets

Create `.env.local` with at least:

```bash
BETTER_AUTH_SECRET=your-random-secret
CRYPTO_KEY=your-random-secret
```

Generate secrets with:

```bash
openssl rand -base64 32
```

Full list of required variables:

```bash
BETTER_AUTH_SECRET=
CRYPTO_KEY=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=https://cms.example.com
ADMIN_EMAILS=admin@example.com
```

## 3. Create the GitHub App

```bash
npm run setup:github-app -- --base-url https://cms.example.com --env .env.local
```

After creating the app, enable **Account permissions → Email addresses → Read-only** in GitHub App settings. The setup helper cannot set account permissions in the manifest.

## 4. Apply D1 migrations

```bash
npm run db:migrate:local   # local dev
npm run db:migrate         # remote/production D1
```

## 5. Run locally or deploy

```bash
npm run dev        # local development
npm run deploy     # deploy to Cloudflare Workers
```

## Wrangler configuration

Edit `wrangler.toml` to set your D1 database binding and any KV namespaces before deploying.

## Troubleshooting

- If the GitHub App webhook fails, verify that `GITHUB_WEBHOOK_SECRET` matches what is set in the GitHub App settings.
- If sign-in fails, confirm `NEXT_PUBLIC_APP_URL` matches the origin of your deployment exactly (no trailing slash).
- D1 migration errors usually mean the remote database name in `wrangler.toml` does not match what was created in the Cloudflare dashboard.
