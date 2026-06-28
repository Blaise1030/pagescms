---
title: "Content service"
description: "Framework-agnostic content read layer shared by REST routes and the future MCP server."
---

# Content service

`lib/content-service.ts` is the shared core for reading repository content. REST API routes and the planned MCP server both call into it, so parsing, schema resolution, and caching behave identically regardless of transport.

Parsing helpers live in `lib/content-parsing.ts` — field codec transforms, collection filtering, and search matching are defined once and reused by the service, reference lookups, and future write paths.

## Context

Every function takes an explicit context instead of reading session or request objects:

```ts
type ContentServiceContext = {
  owner: string;
  repo: string;
  branch: string;
  user: User;
  token: string;
  config: Config;
};
```

Functions that fetch individual files from GitHub also require `octokit` (`ContentServiceReadContext`).

Route handlers build context with helpers:

```ts
toContentServiceContext({ owner, repo, branch }, { user, token, config })
toContentServiceReadContext({ owner, repo, branch }, repoContext)
```

## Read API

### `listCollections(ctx)`

Returns summaries of every entry in `config.object.content` — name, label, type, path, format, extension, and allowed operations.

### `getEntrySchema(ctx, name)`

Resolves a collection or file schema and returns:

- `jsonSchema` — generated from the same Zod validators the UI uses (`generateZodSchema` → `z.toJSONSchema`)
- `fields` — raw field definitions from `.pages.yml`
- `format`, `extension`, `list`

This is the contract MCP agents will use before writing content.

### `listEntries(ctx, name, options?)`

Lists entries under a collection path. Options:

| Option | Description |
| --- | --- |
| `path` | Collection subdirectory (required — use the schema's root `path`) |
| `type: "search"` | Enable search filtering |
| `query` | Search string (with `type: "search"`) |
| `searchFields` | Fields to match (default `["name"]`; use `fields.title` for frontmatter fields) |

Returns `{ contents, errors }`. Parse errors for individual files are collected in `errors` without failing the whole request.

### `getEntry(ctx, name, path)`

Fetches one schema-backed file: checks cache, falls back to GitHub, parses frontmatter, applies read codecs, returns `{ sha, name, path, contentObject }`.

### `getRawEntry(ctx, path)`

Fetches a file without schema parsing — used for `.pages.yml` settings. Returns `{ sha, name, path, contentObject: { body } }`.

## REST adapters

| Route | Service function |
| --- | --- |
| `GET .../collections/[name]` | `listEntries` |
| `GET .../entries/[path]?name=…` | `getEntry` |
| `GET .../entries/.pages.yml` (no name) | `getRawEntry` |

## Parsing pipeline

1. **Deserialize** — `parse()` for yaml/json/toml frontmatter (`serializedTypes` in `lib/utils/file.ts`)
2. **Validate shape** — Zod on write; read path trusts stored files
3. **Field codecs** — `getCodec(type).read` / `.write` per field type
4. **Cache** — D1-backed entry and folder caches (`lib/github-cache-file.ts`)

List-root schemas (`list: true`) wrap content in a temporary `listWrapper` object during codec application, matching the UI's edit model.

## Roadmap

Next steps from the MCP design:

1. **Write operations** — `writeEntry`, `deleteEntry`, `renameEntry` with `commit` and `propose` (PR) modes
2. **PAT auth** — scoped API tokens for MCP clients
3. **MCP endpoint** — Streamable HTTP on the Worker
4. **Docs tools** — `search_docs` / `get_doc` indexed from `content/docs/**`

Internal design specs for contributors live under `docs/superpowers/specs/2026-06-27-*.md` in the repository.
