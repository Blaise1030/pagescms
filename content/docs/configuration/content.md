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
