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
