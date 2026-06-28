# Configuration references for setup-pages-cms

Agents must treat **`content/docs/configuration/*.md`** as the single source of
truth for the `.pages.yml` contract. Sub-skills add *opinion* (which collections
and fields suit a blog vs docs vs marketing site); these docs supply *facts*
(valid keys, field types, and behavior).

## Read order

1. [`content/docs/configuration/index.md`](../../../content/docs/configuration/index.md) — top-level keys and minimal example
2. [`content/docs/configuration/content.md`](../../../content/docs/configuration/content.md) — collections, files, groups, view, format
3. [`content/docs/configuration/media.md`](../../../content/docs/configuration/media.md) — upload paths and public URLs
4. [`content/docs/configuration/components.md`](../../../content/docs/configuration/components.md) — reusable field groups
5. [`content/docs/configuration/settings.md`](../../../content/docs/configuration/settings.md) — site URL, merge mode, commits
6. [`content/docs/configuration/actions.md`](../../../content/docs/configuration/actions.md) — workflow buttons (optional)

## Do not duplicate

- Do **not** copy the full config spec into skill prompts or generated output
- When unsure about a key or field type, read the relevant doc section first
- Cross-check ambiguous cases against `lib/config-schema.ts` (`ConfigSchema`)

## Machine-readable bundle

For offline or token-efficient access, generate:

```bash
pnpm run generate:llms-txt
```

This writes [`public/llms.txt`](../../../public/llms.txt) — all docs under
`content/docs/` with frontmatter stripped and section headers added.

## Validation backstop

Draft `.pages.yml` output must pass:

```bash
npx tsx lib/validate-pages-config.ts .pages.yml
```

`ConfigSchema` in `lib/config-schema.ts` is the runtime ground truth when docs
and implementation differ; fix the draft to satisfy validation before writing.
