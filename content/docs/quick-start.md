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
