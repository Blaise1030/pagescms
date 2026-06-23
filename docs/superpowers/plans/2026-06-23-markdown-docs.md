# Markdown-driven Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 4 hardcoded TSX doc pages with a file-based system where plain `.md` files in `content/docs/` are loaded dynamically via a single `[[...slug]]` catch-all route.

**Architecture:** A server component reads the `.md` file for the requested slug using `fs`, parses frontmatter (title, description), and passes the content string to a `"use client"` `DocsMarkdownContent` component that renders it with `react-markdown` and registers `h2` headings with the existing TOC context. Pages are statically generated at build time via `generateStaticParams`.

**Tech Stack:** `react-markdown`, `remark-gfm`, Next.js App Router `[[...slug]]`, `fs/path` (build-time only), existing `DocsContent`/`DocsToc` infrastructure.

---

## File map

| Action | Path |
|--------|------|
| Create | `content/docs/index.md` |
| Create | `content/docs/quick-start.md` |
| Create | `content/docs/configuration/index.md` |
| Create | `content/docs/configuration/media.md` |
| Create | `content/docs/configuration/content.md` |
| Create | `content/docs/configuration/components.md` |
| Create | `content/docs/configuration/settings.md` |
| Create | `content/docs/configuration/actions.md` |
| Create | `content/docs/deployment/cloudflare.md` |
| Create | `lib/docs-content-loader.ts` |
| Create | `components/marketing/docs-markdown.tsx` |
| Create | `app/(marketing)/docs/[[...slug]]/page.tsx` |
| Update | `lib/docs-navigation.ts` |
| Delete | `app/(marketing)/docs/page.tsx` |
| Delete | `app/(marketing)/docs/quick-start/page.tsx` |
| Delete | `app/(marketing)/docs/configuration/page.tsx` |
| Delete | `app/(marketing)/docs/deployment/cloudflare/page.tsx` |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install react-markdown and remark-gfm**

```bash
cd /path/to/pagescms
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Verify they appear in package.json**

```bash
grep -E '"react-markdown|remark-gfm' package.json
```

Expected output:
```
"react-markdown": "^9.x.x",
"remark-gfm": "^4.x.x",
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and remark-gfm"
```

---

## Task 2: Create content loader utility

**Files:**
- Create: `lib/docs-content-loader.ts`

- [ ] **Step 1: Create `lib/docs-content-loader.ts`**

```ts
import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export type DocFrontmatter = {
  title: string;
  description?: string;
};

function parseFrontmatter(raw: string): { data: DocFrontmatter; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: { title: "" }, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^"|"$/g, "");
    data[key] = val;
  }

  return {
    data: { title: data.title ?? "", description: data.description },
    content: match[2].trimStart(),
  };
}

function slugToFilePath(slug: string[]): string {
  if (slug.length === 0) return path.join(DOCS_DIR, "index.md");
  const last = slug[slug.length - 1];
  const dir = path.join(DOCS_DIR, ...slug.slice(0, -1));
  // try slug.md first, then slug/index.md
  const asFile = path.join(DOCS_DIR, ...slug.slice(0, -1), `${last}.md`);
  const asIndex = path.join(DOCS_DIR, ...slug, "index.md");
  if (fs.existsSync(asFile)) return asFile;
  return asIndex;
}

export function loadDocContent(slug: string[]): { data: DocFrontmatter; content: string } | null {
  const filePath = slugToFilePath(slug);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseFrontmatter(raw);
}

export function getAllDocSlugs(): string[][] {
  const results: string[][] = [[]]; // root /docs

  function walk(dir: string, prefix: string[]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.name.endsWith(".md")) {
        const base = entry.name.slice(0, -3);
        if (base === "index") {
          if (prefix.length > 0) results.push(prefix);
        } else {
          results.push([...prefix, base]);
        }
      }
    }
  }

  walk(DOCS_DIR, []);
  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/docs-content-loader.ts
git commit -m "feat: add docs content loader utility"
```

---

## Task 3: Create DocsMarkdownContent client component

**Files:**
- Create: `components/marketing/docs-markdown.tsx`

- [ ] **Step 1: Create `components/marketing/docs-markdown.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocsToc } from "@/components/marketing/docs-toc";
import { docsHeadingId } from "@/lib/docs-heading-id";

function extractH2s(markdown: string): { id: string; title: string }[] {
  return Array.from(markdown.matchAll(/^## (.+)$/gm)).map(([, title]) => ({
    id: docsHeadingId(title),
    title,
  }));
}

export function DocsMarkdownContent({
  title,
  description,
  content,
}: {
  title: string;
  description?: string;
  content: string;
}) {
  const { register, unregister } = useDocsToc();

  useEffect(() => {
    const headings = extractH2s(content);
    headings.forEach((h) => register(h));
    return () => headings.forEach((h) => unregister(h.id));
  }, [content, register, unregister]);

  return (
    <article className="docs-content min-w-0 space-y-8 text-[15px] leading-7 text-foreground/90">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </header>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2({ children }) {
            const text = String(children);
            const id = docsHeadingId(text);
            return (
              <section className="scroll-mt-24 space-y-4">
                <h2
                  id={id}
                  className="text-xl font-semibold tracking-tight text-foreground"
                >
                  {children}
                </h2>
              </section>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base font-semibold text-foreground">
                {children}
              </h3>
            );
          },
          p({ children }) {
            return <p className="text-muted-foreground">{children}</p>;
          },
          ul({ children }) {
            return (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                {children}
              </ol>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            const isBlock = Boolean(className?.startsWith("language-"));
            if (isBlock) {
              return (
                <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/30">
                  <pre className="overflow-x-auto p-4 text-sm leading-6">
                    <code className={className}>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[480px] text-left text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="border-b border-border/80 bg-muted/40">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 font-medium text-foreground">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-3 text-muted-foreground">{children}</td>
            );
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-foreground">
                {children}
              </strong>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/docs-markdown.tsx
git commit -m "feat: add DocsMarkdownContent client component"
```

---

## Task 4: Create catch-all route page

**Files:**
- Create: `app/(marketing)/docs/[[...slug]]/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "app/(marketing)/docs/[[...slug]]"
```

- [ ] **Step 2: Create `app/(marketing)/docs/[[...slug]]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsMarkdownContent } from "@/components/marketing/docs-markdown";
import { getAllDocSlugs, loadDocContent } from "@/lib/docs-content-loader";

type Params = { slug?: string[] };

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) =>
    slug.length === 0 ? {} : { slug }
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadDocContent(slug ?? []);
  if (!doc) return {};
  return {
    title: doc.data.title,
    description: doc.data.description,
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = loadDocContent(slug ?? []);
  if (!doc) notFound();

  return (
    <DocsMarkdownContent
      title={doc.data.title}
      description={doc.data.description}
      content={doc.content}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/docs/[[...slug]]/page.tsx"
git commit -m "feat: add markdown catch-all docs route"
```

---

## Task 5: Write introduction and quick-start markdown files

**Files:**
- Create: `content/docs/index.md`
- Create: `content/docs/quick-start.md`

- [ ] **Step 1: Create content/docs directory**

```bash
mkdir -p content/docs
```

- [ ] **Step 2: Create `content/docs/index.md`**

```markdown
---
title: "Introduction"
description: "Open-source CMS for static sites stored in GitHub repositories."
---

## What PagesCMS is

PagesCMS is an open-source CMS for static sites stored in GitHub repositories. It edits files in your repository directly. There is no separate CMS database for your site content.

This repository is a community fork that runs on Cloudflare Workers with D1 for application data. The editing model and `.pages.yml` configuration follow the upstream PagesCMS project.

## Why it exists

Most static sites do not need a database-backed CMS. They already have:

- content in files,
- media in the repository,
- Git history,
- a deployment flow.

The missing piece is usually the editing experience. PagesCMS gives teams a UI for editing content and media without asking every editor to learn Git.

## How it works

1. Add a `.pages.yml` file to the repository.
2. Define `content`, `media`, and optional `components` or `settings`.
3. Sign in to PagesCMS.
4. Edit content in the UI.
5. Save changes back to GitHub.

## What PagesCMS does not do

PagesCMS does not replace your site generator, deployment platform, or repository workflow. It only provides the editing layer on top of your existing Git-based project.
```

- [ ] **Step 3: Create `content/docs/quick-start.md`**

```markdown
---
title: "Quick start"
description: "Try PagesCMS on your own repositories."
---

## Use your instance

1. Go to the sign-in page and authenticate with GitHub.
2. Install the GitHub App on the account or organization that owns your repository.
3. Open the repository you want to edit.
4. Create `.pages.yml` when prompted.
5. Start editing.

## Minimal config

Use this as a first working config:

```yaml
media: media
content:
  - name: pages
    label: Pages
    type: collection
    path: docs
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
```

This gives you:

- one media folder at `media/`,
- one editable collection at `docs/`,
- a `title` field,
- a rich-text `body` field.

## What to do next

1. Add more fields.
2. Configure media storage.
3. Adjust filenames and collection view.
4. Deploy your own instance if you are not using a hosted deployment.
```

- [ ] **Step 4: Commit**

```bash
git add content/docs/index.md content/docs/quick-start.md
git commit -m "content: add introduction and quick-start docs"
```

---

## Task 6: Write configuration markdown files

**Files:**
- Create: `content/docs/configuration/index.md`
- Create: `content/docs/configuration/media.md`
- Create: `content/docs/configuration/content.md`
- Create: `content/docs/configuration/components.md`
- Create: `content/docs/configuration/settings.md`
- Create: `content/docs/configuration/actions.md`

- [ ] **Step 1: Create the configuration directory**

```bash
mkdir -p content/docs/configuration
```

- [ ] **Step 2: Create `content/docs/configuration/index.md`**

```markdown
---
title: "Configuration"
description: "`.pages.yml` is the single source of truth for PagesCMS configuration."
---

## What `.pages.yml` does

Place `.pages.yml` at the repository root. PagesCMS reads it per repository and per branch.

## Top-level keys

| Key | Description |
| --- | --- |
| `media` | Defines where uploaded files are stored and what URLs are written. |
| `content` | Defines editable collections and single files. |
| `components` | Reuses shared field definitions across collections. |
| `settings` | Sets repository-wide behavior such as merge mode and commit templates. |
| `actions` | Adds repository-level GitHub Actions buttons. |

## Read order

1. Define `media`.
2. Define `content`.
3. Add `components` if fields repeat.
4. Add `settings` if you need global behavior.
5. Add `actions` if you want custom workflow buttons.

## Minimal example

```yaml
media: media
content:
  - name: posts
    label: Posts
    type: collection
    path: content/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
```

## Example with a collection and a single file

```yaml
media:
  input: src/media
  output: /media
content:
  - name: posts
    label: Posts
    type: collection
    path: src/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
  - name: site
    label: Site settings
    type: file
    path: src/_data/site.json
    fields:
      - name: title
        type: string
      - name: description
        type: text
      - name: url
        type: string
actions:
  - name: deploy-site
    label: Deploy site
    workflow: pages-cms-action.yml
```
```

- [ ] **Step 3: Create `content/docs/configuration/media.md`**

```markdown
---
title: "Media"
description: "Configure where uploaded files are stored and what public paths are written."
---

## What `media` does

`media` defines file storage for image fields, file fields, and rich-text image uploads.

Use it to answer two questions:

1. Where should uploaded files be saved in the repository?
2. What public path should be written into content?

## Value

You can define `media` as a string, one object, or an array of named media sources.

### String form

```yaml
media: media
```

Equivalent to:

```yaml
media:
  input: media
  output: /media
```

### Single media object

```yaml
media:
  input: src/media
  output: /media
  rename: random
  categories: [image]
```

### Multiple media sources

Use an array when different field types should write to different folders.

```yaml
media:
  - name: images
    label: Images
    input: media/images
    output: /media/images
    rename: safe
    extensions: [png, jpg, webp]
  - name: docs
    label: Documents
    input: media/docs
    output: /media/docs
    categories: [document]
```

## Keys

| Key | Description |
| --- | --- |
| `name` ** | Internal media source name. Required when using an array. |
| `label` | UI label for the media source. |
| `input` * | Repository path where files are stored (e.g. `"src/media"`). |
| `output` * | Public path written into content (e.g. `"/media"`). |
| `extensions` | Allowed extensions (e.g. `["png", "webp"]`). |
| `categories` | Category-based extension sets: `image`, `document`, `video`, `audio`, `compressed`, `code`, `font`, `spreadsheet`. |
| `rename` | Upload renaming. `false` keeps the original filename (default), `true` or `safe` slugifies it, `random` generates a name. |
| `commit` | Per-media commit settings. |
| `actions` | Adds media action buttons. |

\* Required · \*\* Required with multiple sources

## Commit templates

`media[].commit.templates` overrides the global commit templates for that media source.

```yaml
media:
  - name: images
    input: media/images
    output: /media/images
    commit:
      templates:
        create: "chore(media): add {filename}"
        update: "chore(media): update {filename}"
        delete: "chore(media): remove {filename}"
        rename: "chore(media): rename {oldFilename} -> {newFilename}"
```
```

- [ ] **Step 4: Create `content/docs/configuration/content.md`**

```markdown
---
title: "Content"
description: "Define editable collections, files, and groups."
---

## Overview

`content` defines what editors can edit. Each entry is either:

- a `collection` for many files with the same schema,
- a `file` for one file with its own schema,
- a `group` for organizing entries in the sidebar.

`group` is navigation-only. It can contain nested `group`, `collection`, and `file` entries but does not create its own editor route.

## Keys

| Key | Description |
| --- | --- |
| `name` * | Unique internal name (e.g. `"posts"`). |
| `label` | UI label (e.g. `"Blog posts"`). |
| `type` * | Values: `collection`, `file`, `group`. |
| `path` * | Folder for collections or file path for single files. Not used by `group`. |
| `fields` | Field definitions shown in the editor. |
| `filename` | Collection filename template (e.g. `"{primary}.md"`). |
| `exclude` | Files to ignore in a collection (e.g. `["README.md"]`). |
| `format` | File format: `yaml-frontmatter`, `json-frontmatter`, `toml-frontmatter`, `yaml`, `json`, `toml`, `datagrid`, `code`, `raw`. |
| `delimiters` | Custom frontmatter delimiters (e.g. `"+++"`, `["<!--", "-->"]`). |
| `subfolders` | `true` or `false`. Enables or disables nested folders in collections. |
| `list` | Repeat a field as an array, or store a whole file as a top-level array. |
| `view` | Collection list settings for fields, sorting, search, and tree mode. |
| `operations` | Per-entry create/rename/delete controls (e.g. `{ delete: false }`). |
| `commit` | Per-entry commit settings (e.g. `{ identity: "user" }`). |
| `actions` | Adds collection or file action buttons. |
| `items` | Child entries inside a `group`. |

\* Required

## Examples

### Collection

```yaml
content:
  - name: posts
    label: Posts
    type: collection
    path: content/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
```

### Single file

```yaml
content:
  - name: site
    label: Site settings
    type: file
    path: src/_data/site.json
    fields:
      - name: title
        type: string
      - name: description
        type: text
```

### Group

```yaml
content:
  - name: blog
    label: Blog
    type: group
    items:
      - name: posts
        label: Posts
        type: collection
        path: content/posts
        fields:
          - name: title
            type: string
      - name: authors
        label: Authors
        type: collection
        path: content/authors
        fields:
          - name: name
            type: string
```
```

- [ ] **Step 5: Create `content/docs/configuration/components.md`**

```markdown
---
title: "Components"
description: "Reuse shared field definitions across multiple collections."
---

## What `components` does

Use `components` when the same field group appears in multiple places.

Typical examples:

- SEO fields,
- author objects,
- call-to-action blocks,
- repeated metadata groups.

Define the field group once, then reference it from `content`.

## Example

```yaml
components:
  seo:
    type: object
    label: SEO
    fields:
      - name: title
        type: string
      - name: description
        type: text

content:
  - name: pages
    type: collection
    path: content/pages
    fields:
      - name: heading
        type: string
      - name: seo
        component: seo
        label: Meta
```

## Override behavior

When you reference a component, field-level values can override component values.

In the example above the component label is `SEO`, but the field overrides it to `Meta`. The resolved field behaves as:

```yaml
- name: seo
  type: object
  label: Meta
  fields:
    - name: title
      type: string
    - name: description
      type: text
```
```

- [ ] **Step 6: Create `content/docs/configuration/settings.md`**

```markdown
---
title: "Settings"
description: "Configure repository-wide behavior such as commit messages and merge mode."
---

## What `settings` does

Use `settings` for behavior that applies across the whole repository. Typical uses:

- hide the admin settings page,
- preserve unmanaged keys when saving structured content,
- define default commit messages,
- choose commit identity behavior.

## Keys

| Key | Description |
| --- | --- |
| `hide` | If `true`, hides the Settings page in the UI. |
| `content` | Controls how structured content is saved. |
| `commit` | Controls commit settings. |

## Content

`settings.content.merge` controls how files outside the schema are handled on save.

| Value | Behavior |
| --- | --- |
| `false` | Default. Rewrite the file from the configured schema only. Keys outside the schema are removed. |
| `true` | Merge submitted fields into the existing file. Keys outside the schema are preserved unless overwritten. |

## Commit

### Commit templates

`settings.commit.templates` defines the default commit message format for content and media changes.

| Key | Default value |
| --- | --- |
| `create` | `Create {path} (via Pages CMS)` |
| `update` | `Update {path} (via Pages CMS)` |
| `delete` | `Delete {path} (via Pages CMS)` |
| `rename` | `Rename {oldPath} to {newPath} (via Pages CMS)` |

`content[].commit.templates` and `media[].commit.templates` override these global templates.

Available tokens:

| Token | Description |
| --- | --- |
| `{action}` | Current action: `create`, `update`, `delete`, or `rename`. |
| `{path}` | File path. |
| `{filename}` | File name only. |
| `{name}` | Content or media entry name. |
| `{owner}` | Repository owner. |
| `{repo}` | Repository name. |
| `{branch}` | Current branch. |
| `{userName}` | Current user display name when available. |
| `{userEmail}` | Current user email when available. |
| `{oldPath}` | Previous path. Rename only. |
| `{newPath}` | New path. Rename only. |

### Commit identity

`settings.commit.identity` controls whether PagesCMS sends explicit committer metadata on writes.

| Value | Behavior |
| --- | --- |
| `app` | Default. GitHub uses the authenticated writer identity for the request. |
| `user` | Send the current user's name and email as committer metadata when available. |

`content[].commit.identity` and `media[].commit.identity` override the global setting.

## Example

```yaml
settings:
  hide: false
  content:
    merge: true
  commit:
    identity: user
    templates:
      create: "content(create): {path}"
      update: "content(update): {path}"
      delete: "content(delete): {path}"
      rename: "content(rename): {oldPath} -> {newPath}"
```
```

- [ ] **Step 7: Create `content/docs/configuration/actions.md`**

```markdown
---
title: "Actions"
description: "Add custom buttons that trigger GitHub Actions workflows."
---

## What actions are

Actions allow you to add custom buttons that trigger GitHub Actions. They can appear:

- at the repository level in the sidebar,
- in the header of collection pages, collection entry pages, file pages, and media pages.

Actions start a GitHub Actions workflow with `workflow_dispatch` and a `payload` input containing contextual information about the trigger.

## Keys

| Key | Description |
| --- | --- |
| `name` * | Internal action name. |
| `label` * | Button label shown in the UI. |
| `workflow` * | Workflow file name in `.github/workflows/`. |
| `ref` | Git ref used to dispatch the workflow. Use `current` for the branch currently open. |
| `scope` | Collection-only. Values: `collection`, `entry`. |
| `cancelable` | Whether the run can be cancelled from PagesCMS. Defaults to `true`. |
| `confirm` | Confirmation dialog config. Use `false` to skip confirmation. |
| `fields` | Extra input fields collected before dispatch. |

\* Required

## Confirmation

Actions show a confirmation dialog by default. Set `confirm: false` to skip it, or customize the dialog:

```yaml
actions:
  - name: deploy-site
    label: Deploy site
    workflow: pages-cms-action.yml
    confirm:
      title: Deploy site?
      message: This will trigger the deployment workflow.
      button: Deploy
```

## Extra fields

Use `fields` to collect values passed to the workflow via `payload.inputs`. Each field supports `name`, `label`, `type` (`text`, `textarea`, `select`, `checkbox`, `number`), `required`, `default`, and `options`.

```yaml
actions:
  - name: deploy-site
    label: Deploy site
    workflow: pages-cms-action.yml
    fields:
      - name: environment
        label: Environment
        type: select
        required: true
        default: staging
        options:
          - label: Staging
            value: staging
          - label: Production
            value: production
      - name: force
        label: Force deploy
        type: checkbox
        default: false
```

## GitHub workflow configuration

Your workflow must accept a `payload` input:

```yaml
on:
  workflow_dispatch:
    inputs:
      payload:
        description: Pages CMS payload as JSON
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Parse payload
        run: echo '${{ inputs.payload }}' | jq .
```

GitHub Actions must be enabled for the repository and the GitHub App must have **Actions: Write** permission.
```

- [ ] **Step 8: Commit**

```bash
git add content/docs/configuration/
git commit -m "content: add configuration section docs"
```

---

## Task 7: Write deployment markdown files

**Files:**
- Create: `content/docs/deployment/cloudflare.md`

- [ ] **Step 1: Create deployment directory**

```bash
mkdir -p content/docs/deployment
```

- [ ] **Step 2: Create `content/docs/deployment/cloudflare.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add content/docs/deployment/cloudflare.md
git commit -m "content: add Cloudflare deployment docs"
```

---

## Task 8: Update docs navigation

**Files:**
- Modify: `lib/docs-navigation.ts`

- [ ] **Step 1: Replace `lib/docs-navigation.ts` with expanded navigation**

```ts
export type DocsNavItem = {
  title: string;
  href: string;
  items?: DocsNavItem[];
};

export const docsNavigation: DocsNavItem[] = [
  {
    title: "Introduction",
    href: "/docs",
  },
  {
    title: "Quick start",
    href: "/docs/quick-start",
  },
  {
    title: "Configuration",
    href: "/docs/configuration",
    items: [
      {
        title: "Overview",
        href: "/docs/configuration",
      },
      {
        title: "Media",
        href: "/docs/configuration/media",
      },
      {
        title: "Content",
        href: "/docs/configuration/content",
      },
      {
        title: "Components",
        href: "/docs/configuration/components",
      },
      {
        title: "Settings",
        href: "/docs/configuration/settings",
      },
      {
        title: "Actions",
        href: "/docs/configuration/actions",
      },
    ],
  },
  {
    title: "Deployment",
    href: "/docs/deployment/cloudflare",
    items: [
      {
        title: "Cloudflare Workers",
        href: "/docs/deployment/cloudflare",
      },
    ],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/docs-navigation.ts
git commit -m "feat: expand docs navigation for all markdown pages"
```

---

## Task 9: Delete old static pages and verify

**Files:**
- Delete: `app/(marketing)/docs/page.tsx`
- Delete: `app/(marketing)/docs/quick-start/page.tsx`
- Delete: `app/(marketing)/docs/configuration/page.tsx`
- Delete: `app/(marketing)/docs/deployment/cloudflare/page.tsx`

- [ ] **Step 1: Delete old pages and now-empty directories**

```bash
rm "app/(marketing)/docs/page.tsx"
rm "app/(marketing)/docs/quick-start/page.tsx"
rmdir "app/(marketing)/docs/quick-start"
rm "app/(marketing)/docs/configuration/page.tsx"
rmdir "app/(marketing)/docs/configuration"
rm "app/(marketing)/docs/deployment/cloudflare/page.tsx"
rmdir "app/(marketing)/docs/deployment/cloudflare"
rmdir "app/(marketing)/docs/deployment"
```

- [ ] **Step 2: Verify the build compiles without errors**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. The docs routes appear in the output as static pages (○ symbol in Next.js build output).

- [ ] **Step 3: Spot-check routes in dev**

```bash
npm run dev
```

Open:
- `http://localhost:3000/docs` → Introduction page
- `http://localhost:3000/docs/quick-start` → Quick start page
- `http://localhost:3000/docs/configuration` → Configuration overview
- `http://localhost:3000/docs/configuration/media` → Media page
- `http://localhost:3000/docs/deployment/cloudflare` → Cloudflare page
- `http://localhost:3000/docs/nonexistent` → 404 page

Confirm the sidebar navigation is visible and active link highlighting works.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: migrate docs to markdown file-based system"
```
