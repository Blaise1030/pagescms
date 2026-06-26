# PagesCMS

> Community fork of [Pages CMS](https://pagescms.org) by [Ronan Berder](https://github.com/hunvreus) ([@hunvreus](https://github.com/hunvreus)).
>
> This repository is **not** the official Pages CMS project. See [ATTRIBUTION.md](ATTRIBUTION.md) for upstream credit and fork details.

PagesCMS is a GitHub-native CMS for static sites and content-driven apps (Jekyll, Hugo, Next.js, Astro, and similar stacks). This fork targets **Cloudflare Workers + D1** instead of the upstream PostgreSQL deployment path.

For the official hosted product, documentation, and support channels, visit [pagescms.org](https://pagescms.org).

## Relationship to upstream

| | Upstream Pages CMS | This fork |
| --- | --- | --- |
| Author | Ronan Berder | Blaise Tiong |
| Repository | [pagescms/pagescms](https://github.com/pagescms/pagescms) | [Blaise1030/pagescms](https://github.com/Blaise1030/pagescms) |
| Database | PostgreSQL | Cloudflare D1 |
| Deployment | Varies (see upstream docs) | Cloudflare Workers |

Upstream docs remain useful for CMS concepts and configuration: [pagescms.org/docs](https://pagescms.org/docs).

## Local development

### What you need

- Node.js **22.18+** (required by `@cloudflare/vite-plugin` / `registerHooks`; use `.nvmrc`)
- A Cloudflare account (for D1, Workers, and email)
- A GitHub App
- A local `.env.local` (or Wrangler secrets)

### Quick start

1. Clone this repository:

```bash
git clone https://github.com/Blaise1030/pagescms.git
cd pagescms
```

2. Install dependencies:

```bash
nvm use   # or: fnm use / asdf install
npm install
```

3. Create `.env.local` with at least:

```bash
BETTER_AUTH_SECRET=your-random-secret
CRYPTO_KEY=your-random-secret
```

Optional but useful:

```bash
BASE_URL=https://cms.example.com
AUTH_PRODUCTION_URL=https://cms.example.com
OAUTH_PROXY_SECRET=your-shared-oauth-proxy-secret
ADMIN_EMAILS=admin@example.com
```

`OAUTH_PROXY_SECRET` must be the same value on production, preview, and local. It lets PR preview deployments complete GitHub sign-in through the production OAuth callback URL.

Generate secrets with:

```bash
openssl rand -base64 32
```

4. Create your GitHub App with the helper:

```bash
npm run setup:github-app -- --base-url http://localhost:3000 --env .env.local
```

For local dev, GitHub rejects `localhost` webhook URLs. The helper omits the webhook and subscribed events from the manifest in that case — you can add both later in GitHub App settings once the app is publicly reachable, or pass a tunnel URL:

```bash
cloudflared tunnel --url http://localhost:3000
npm run setup:github-app \
  --base-url http://localhost:3000 \
  --webhook-url https://your-tunnel.trycloudflare.com/api/webhook/github \
  --env .env.local
```

For production setup, pass your public URL directly:

```bash
npm run setup:github-app -- --base-url https://cms.example.com --env .env.local
```

Useful options:

- `--owner-type personal|org`
- `--org <slug>`
- `--app-name "PagesCMS (local)"`
- `--webhook-url <url>` (optional public webhook URL when `--base-url` is local)
- `--env .env.local`
- `--no-open`

After creating the app, enable **Account permissions → Email addresses → Read-only** in GitHub App settings (required for GitHub sign-in). The setup helper cannot set account permissions in the manifest — GitHub only accepts repository/org permission keys there.

5. Apply database migrations to your D1 database (see `wrangler.jsonc`):

```bash
npm run db:migrate:local   # local dev (vinext dev uses local D1)
npm run db:migrate         # remote/production D1
```

If cache state is stale or corrupted:

```bash
npm run db:clear-cache
```

6. Start the app:

```bash
npm run dev
```

### Email (Cloudflare Email Service)

PagesCMS sends login codes and collaborator invites via [Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/). The Worker uses the `EMAIL` send binding configured in `wrangler.jsonc`.

1. In the Cloudflare dashboard, go to **Compute** → **Email Service** → **Email Sending** and onboard your sender domain ([domain setup guide](https://developers.cloudflare.com/email-service/configuration/domains/)).
2. Set `EMAIL_FROM` to an address on that domain:

```bash
EMAIL_FROM="Pages CMS <no-reply@yourdomain.com>"
```

In production, email is sent through the `EMAIL` binding when you deploy with `npm run deploy`.

For local development, the binding uses `remote: true` so sends go through your Cloudflare account. If the binding is unavailable, set these REST API fallbacks in `.env.local`:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

The API token needs permission to send email for the account that owns the onboarded domain. See the [REST API docs](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/) for details.

For more detail on CMS configuration, see upstream docs:

- [Install locally](https://pagescms.org/docs/guides/installing/)
- [Create the GitHub App](https://pagescms.org/docs/guides/installing/github-app/)
- [Environment variables](https://pagescms.org/docs/development/environment-variables/)
- [Caching](https://pagescms.org/docs/development/caching/)

## Support upstream

If you benefit from the original project, consider supporting its author:

- [Star Pages CMS on GitHub](https://github.com/pagescms/pagescms)
- [Sponsor Ronan Berder](https://github.com/sponsors/hunvreus)
- [Report upstream issues](https://github.com/pagescms/pagescms/issues)

For issues specific to this fork, use [Blaise1030/pagescms issues](https://github.com/Blaise1030/pagescms/issues).

## License

Released under the [MIT License](LICENSE). Original copyright remains with Ronan Berder; modifications in this fork are copyright Blaise Tiong. See [ATTRIBUTION.md](ATTRIBUTION.md).
