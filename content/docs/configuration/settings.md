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
