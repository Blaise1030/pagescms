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

- Node.js
- A Cloudflare account (for D1 and Workers deployment)
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
ADMIN_EMAILS=admin@example.com
```

Generate secrets with:

```bash
openssl rand -base64 32
```

4. Create your GitHub App with the helper:

```bash
npm run setup:github-app -- --base-url http://localhost:3000
```

Useful options:

- `--owner-type personal|org`
- `--org <slug>`
- `--app-name "PagesCMS (local)"`
- `--env .env.local`
- `--no-open`

5. Apply database migrations to your D1 database (see `wrangler.jsonc`):

```bash
npm run db:migrate
```

If cache state is stale or corrupted:

```bash
npm run db:clear-cache
```

6. Start the app:

```bash
npm run dev
```

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
