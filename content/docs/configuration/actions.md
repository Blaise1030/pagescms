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
