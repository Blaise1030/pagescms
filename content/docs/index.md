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

## AI agents & MCP

PagesCMS is building toward [MCP-native content editing](/docs/ai): AI agents will read and write the same schema-validated files through a shared content service. See [AI & MCP](/docs/ai) for the roadmap and [Content service](/docs/ai/content-service) for the developer API available today.

## What PagesCMS does not do

PagesCMS does not replace your site generator, deployment platform, or repository workflow. It only provides the editing layer on top of your existing Git-based project.
