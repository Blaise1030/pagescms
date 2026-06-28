# Permissions & Scheduling — Feature Analysis

> Dated: 2026-06-28  
> Context: PagesCMS as an MCP server for Claude-driven content pipelines

---

## 1. Permissions

### Current state

The codebase has a **binary permission model**:

- `lib/authz-server.ts` — checks one thing: does the user have GitHub `push` access to the repo?
- `lib/github-cache-permissions.ts` — caches that check in the `cache_permission` D1 table (TTL: 60 min) to avoid hammering the GitHub API.
- `db/schema.ts` (collaborator table, lines 74–94) — tracks who was invited to a repo/branch, but has **no `role` column**. It's a presence list, not an access matrix.

There is no concept of editor vs viewer vs admin inside PagesCMS today.

### Why this becomes a security hole with MCP

An MCP API key currently would have to inherit the binary model: full write access or nothing. That means:

- A content writer's Claude session could delete content it shouldn't touch.
- An external automation (CI, n8n, Make) gets the same power as the workspace owner.
- A read-only reporting integration can mutate data.

### What needs to be built

**A. API key table**

```sql
CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,  -- owner/repo
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,  -- bcrypt, never store plaintext
  scope       TEXT NOT NULL,  -- JSON array: ["read", "write:posts", "write:media"]
  created_by  TEXT NOT NULL REFERENCES user(id),
  created_at  INTEGER NOT NULL,
  last_used   INTEGER,
  expires_at  INTEGER         -- nullable, no expiry = forever
);
```

**B. Scope grammar**

Keep it simple and Git-inspired:

| Scope | Access |
|-------|--------|
| `read` | Read all collections and media |
| `write` | Write to all collections |
| `write:<collection>` | Write to one named collection only |
| `admin` | Full access including key management |

An MCP key for a content writer: `["read", "write:blog"]`.  
A CI pipeline key: `["read"]`.  
A full automation key: `["read", "write"]`.

**C. MCP middleware**

Every MCP tool call passes through one check:

```ts
// lib/mcp-auth.ts
export async function assertMcpScope(
  request: Request,
  required: string,
  collection?: string
): Promise<void> {
  const key = extractBearer(request)
  const record = await db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, hash(key)) })
  if (!record) throw new McpError(401, 'Invalid API key')
  if (!hasScope(record.scope, required, collection)) throw new McpError(403, 'Insufficient scope')
  await db.update(apiKeys).set({ lastUsed: Date.now() }).where(eq(apiKeys.id, record.id))
}
```

**D. Settings UI**

One new page: Settings → Integrations → API Keys.

- Generate a key (shown once, then hashed).
- Name it (e.g. "Claude Desktop – content writer").
- Select scope via checkboxes.
- Set optional expiry.
- Revoke at any time.
- Show the exact JSON snippet for `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pagescms": {
      "url": "https://your-site.pages.dev/mcp",
      "headers": { "Authorization": "Bearer <key>" }
    }
  }
}
```

### What this unlocks

- A journalist's Claude session can only write to `articles` — it cannot touch `pricing` or `legal`.
- A read-only analytics pipeline cannot accidentally publish.
- Keys expire automatically for contractors.
- The audit trail (`last_used`) shows which integrations are still active.

### Effort estimate

3–4 days: D1 migration + key generation + scope middleware + settings UI. No external dependencies.

---

## 2. Scheduling

### Current state

"Drafts" today are **client-side only** — stored in IndexedDB (`lib/idb.ts`) as an auto-save buffer. When the user saves, the file commits directly to GitHub. There is no concept of "save now, publish later."

- `wrangler.jsonc` — no `triggers.crons` defined.
- `worker/index.ts` — no `scheduled` export handler.
- No `publishAt`, `draft`, or `status` field in any schema.

### The minimal approach (recommended)

Do not build a publishing queue. Build two small things:

**A. `draft` and `publishAt` as first-class frontmatter fields**

Add them to the content schema system (`lib/schema.ts`) as optional built-in fields available on any collection:

```yaml
# Content file frontmatter
---
title: "Q3 Launch Announcement"
draft: true
publishAt: "2026-07-04T09:00:00Z"
---
```

PagesCMS writes these fields on save — nothing more. Claude sets them by calling the `update_content` MCP tool. The user never has to touch a date picker if they don't want to:

> *"Schedule the Q3 launch post for Friday at 9am Pacific."*  
> Claude calls `update_content({ slug: "q3-launch", frontmatter: { draft: true, publishAt: "2026-07-04T16:00:00Z" } })`

**B. One Worker cron job**

Add a single cron trigger that runs every 5 minutes:

```jsonc
// wrangler.jsonc
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

```ts
// worker/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    await publishDueContent(env)
  }
}
```

`publishDueContent` scans for GitHub files across tracked repos where `draft: true` and `publishAt <= now`, then commits a change flipping `draft: false`. That's it. No queue, no state machine, no database rows for content.

### What this does NOT need

- No new DB tables (frontmatter lives in the file, in GitHub).
- No content status columns.
- No webhook from the cron back to the user (GitHub commit history is the audit trail).
- No UI scheduling panel beyond what exists. Claude is the scheduling UI.

### What MCP tools this enables

| Tool | Description |
|------|-------------|
| `list_scheduled` | Returns entries where `draft: true` and `publishAt` is set |
| `update_content` | Claude sets `publishAt` directly in frontmatter |
| `publish_content` | Immediately flips `draft: false` (bypasses schedule) |

### Example Claude workflow

```
User: "Schedule the pricing update for next Monday 8am and the case study for Wednesday noon."

Claude:
1. Calls list_content({ collection: "blog", filter: "draft" }) to confirm slugs
2. Calls update_content({ slug: "pricing-update", publishAt: "2026-06-29T08:00:00Z" })
3. Calls update_content({ slug: "acme-case-study", publishAt: "2026-07-01T12:00:00Z" })
4. Calls list_scheduled() to confirm both appear in the queue
5. Reports back to user with confirmation
```

No scheduling UI needed. The intelligence is Claude. PagesCMS just executes on time.

### Effort estimate

2 days: frontmatter field definitions + cron trigger + `publishDueContent` GitHub commit logic + `list_scheduled` MCP tool.

---

## Summary

| Feature | Current gap | Build | Effort |
|---------|------------|-------|--------|
| Permissions | Binary GitHub check only | API key table + scope grammar + MCP middleware + settings UI | 3–4 days |
| Scheduling | Client-side drafts only, no cron | `draft`/`publishAt` frontmatter fields + one Worker cron job + 3 MCP tools | 2 days |

Both are **small builds with large leverage**. Permissions make the MCP server safe enough to give API keys to external tools. Scheduling makes the most common content automation request ("publish this later") work with zero UI — Claude does the reasoning, PagesCMS does the execution.
