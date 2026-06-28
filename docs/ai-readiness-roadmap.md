# PagesCMS — AI Readiness Roadmap

> Dated: 2026-06-28  
> Stack: Next.js · Cloudflare Workers · D1 · Cloudflare AI Gateway (types already wired)

---

## Why now

The Cloudflare AI Gateway provider list is already declared in `worker-configuration.d.ts` (Anthropic, OpenAI, Workers AI, Mistral, Groq, DeepSeek, etc.). There is zero production code using any of it. That gap is the opportunity — the plumbing exists, just no features on top.

---

## Phase 1 — AI Infrastructure (Foundation)

**Goal:** One config, any model. No AI feature ships without this.

| Task | Detail |
|------|--------|
| AI provider settings UI | Let workspace owners pick a provider + paste an API key (stored encrypted in D1). Default to `workers-ai` (free tier, no key needed). |
| `lib/ai.ts` service layer | Thin wrapper: `ai.complete(prompt, opts)` routes to the configured provider through Cloudflare AI Gateway. Swap models without touching callers. |
| Rate-limit + cost guard | Per-workspace token budget stored in D1. Reject calls over limit gracefully. |
| Feature flag | `AI_ENABLED` env var — off by default, on per deployment. |

**Effort:** ~1 week. Unlocks every phase below.

---

## Phase 2 — Smart Editor (Highest User Impact)

**Goal:** AI inside the Tiptap rich-text editor without leaving the page.

| Feature | UX | Implementation |
|---------|----|----------------|
| **AI Write** | Select text → right-click → "Improve / Expand / Shorten / Change tone" | Tiptap extension calling `lib/ai.ts`. Streamed response replaces selection. |
| **AI Draft** | Empty doc → "Generate draft from title" button in toolbar | Send page title + content-type schema as context. |
| **SEO assistant** | Side panel: live score + AI-suggested meta title, description, slug | Run on save. Store suggestions in D1 alongside the content record. |
| **Auto alt-text** | Media manager: on image upload, auto-fill alt text field | Call Workers AI `@cf/microsoft/resnet-50` (free) or vision model. |

**Effort:** ~2 weeks.

---

## Phase 3 — Semantic Search

**Goal:** Replace keyword search with meaning-based search.

Current search is full-text only. Users can't find "pricing page" by searching "cost" or "plans."

| Task | Detail |
|------|--------|
| Cloudflare Vectorize index | One index per workspace. 768-dim vectors (Workers AI `@cf/baai/bge-base-en-v1.5`, free). |
| Embed on save | After every content save, embed the text and upsert into Vectorize. |
| Hybrid search API | `GET /api/search?q=…` runs both full-text (D1 FTS) and vector (Vectorize) and merges results by rank. |
| Search UI | Update the existing search modal to call the new hybrid endpoint. Add a "Semantic" toggle. |

**Effort:** ~1.5 weeks.

---

## Phase 4 — Content Intelligence

**Goal:** Proactive suggestions, not just reactive assistance.

| Feature | Detail |
|---------|--------|
| **Auto-tagging** | On save: AI reads content, suggests tags from the workspace taxonomy. One-click accept. |
| **Stale content alerts** | Nightly D1 job: find pages not updated in N days that rank poorly → surface in dashboard. |
| **Readability score** | Inline: Flesch-Kincaid grade, passive voice %, avg sentence length. No LLM needed — computed client-side. |
| **AI change summaries** | On each GitHub commit, generate a one-sentence "what changed" summary. Store in D1, show in content history. |

**Effort:** ~2 weeks.

---

## Phase 5 — Agentic CMS (Biggest Moat)

**Goal:** Expose PagesCMS as a tool that AI agents can read from and write to.

This is the structural shift. In the AI era, CMS content is consumed by agents (Cursor, Claude, Copilot, custom pipelines), not just browsers.

| Task | Detail |
|------|--------|
| **MCP Server endpoint** | `GET /mcp` — implement the Model Context Protocol server spec. Exposes tools: `list_content`, `get_content`, `create_content`, `update_content`, `search_content`. Authenticated via API key. |
| **LLM-friendly content API** | `GET /api/content?format=llm` returns clean Markdown with frontmatter stripped — no HTML, no navigation boilerplate. Ideal for RAG pipelines. |
| **Webhook → AI pipeline** | On publish: optionally POST content to a user-configured AI pipeline URL (LangChain, n8n, Make). |
| **API key management UI** | Generate scoped API keys (read-only vs read-write) per workspace. |

**Effort:** ~2 weeks. The MCP server alone makes PagesCMS show up in every AI coding assistant's list of available tools.

---

## Phase 6 — AI-Powered "Soon" Features

Upgrade the four "Soon" items on the landing page with AI from the start.

| Feature | AI Angle |
|---------|---------|
| **Scheduling** | "Publish when engagement is highest" — AI suggests optimal publish time based on past analytics data. |
| **Analytics** | Natural language queries: "Which pages lost traffic last month?" → generates and runs a PostHog/Cloudflare Analytics query. |
| **Comments** | Auto-moderation: flag spam/toxicity before a human reviews. AI-suggested reply drafts for editors. |
| **Permissions** | AI anomaly detection: alert when a user's access pattern looks unusual. |

---

## Quick Wins (Ship This Week)

These require no AI infrastructure at all:

1. **Wordcount + reading time** in the editor toolbar — users expect it, costs nothing.
2. **"Copy as Markdown" button** in the media manager — LLMs consume Markdown, not rich HTML.
3. **`robots.txt` / `llms.txt` generator** — let site owners declare what AI crawlers can index. Emerging standard as of 2025.
4. **Keyboard shortcut** `Cmd+K` for the search modal — makes semantic search feel instant when it ships.

---

## Stack Fit

| Need | Existing Asset | Gap |
|------|---------------|-----|
| LLM calls | CF AI Gateway (types exist) | `lib/ai.ts` service |
| Vector search | CF Vectorize (available in Workers) | Wrangler binding + index |
| Image AI | Workers AI vision models | Binding + media manager hook |
| Agent protocol | — | MCP server route |
| Storage for AI metadata | D1 | New columns / tables via Drizzle |

No new vendors needed. Everything runs on Cloudflare, on the same Workers deployment, billed on the same account.

---

## Suggested Sequence

```
Week 1-2:   Phase 1 (infra) + Quick Wins
Week 3-4:   Phase 2 (smart editor)
Week 5-6:   Phase 3 (semantic search)
Week 7-8:   Phase 4 (content intelligence)
Week 9-10:  Phase 5 (MCP / agentic)
Week 11+:   Phase 6 (upgrade "Soon" features)
```

Start with Phase 1 — nothing else is possible without the AI service layer.
