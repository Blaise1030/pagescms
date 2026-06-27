# Repository conventions

## Commits and pull requests

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) for release-please versioning and changelog generation. CI enforces this on every pull request.

**PR titles** and **every commit** in a PR must use this format:

```
<type>: <lowercase description>
```

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.

Examples:

```
feat: add preview panel collapse toggle
fix(auth): enable GitHub sign-in on preview deployments
ci: enforce conventional commit format on pull requests
```

Avoid plain titles like `Deploy PR previews to staging` or `Merge pull request #N` as the only commit on `main` — release-please cannot parse them.

## Branches and preview deployments

Preview deployments run only for pull requests whose **head branch** starts with `feature/`.

- Use `feature/<short-description>` when you need a Cloudflare preview URL on the PR.
- Other branch prefixes (`cursor/`, `chore/`, etc.) do not get preview deployments.

Example: `feature/preview-panel-collapse-toggle`

When a preview deployment is required, create or rename the branch to `feature/...` before opening the PR.
