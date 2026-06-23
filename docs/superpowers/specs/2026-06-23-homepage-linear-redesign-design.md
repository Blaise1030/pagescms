---
name: homepage-linear-redesign
description: Redesign app/(marketing)/page.tsx to match Linear's visual style — dark background, bold centered hero, 3-pillar row, bento feature grid, multi-column footer
metadata:
  type: project
---

# Homepage Redesign — Linear Visual Style

## Goal

Redesign the PagesCMS marketing homepage (`app/(marketing)/page.tsx`) to match Linear's visual aesthetic: near-black background, large bold centered headline, product screenshot hero with glow, 3-pillar feature row, asymmetric bento grid, and multi-column footer. The angle is "Git-based content editing for the AI era."

## Scope

Files to modify:
- `app/(marketing)/page.tsx` — full section rebuild
- `components/marketing/marketing-footer.tsx` — multi-column layout
- `components/marketing/marketing-header.tsx` — scroll border effect (subtle border-bottom appears on scroll)
- `app/globals.css` — any new keyframes or utility classes needed

Files left untouched:
- `components/marketing/marketing-chrome.tsx`
- `app/(marketing)/layout.tsx`
- Docs layout and components

## Section Design

### Hero

- Small pill badge at top: `"New → AI & MCP agents"`
- Large bold centered headline (64px+, tight letter-spacing, text-balance): `"Git-based content editing for the AI era"`
- Muted subtext: `"Let Claude and ChatGPT draft, edit, and review content inside your existing workflow. Git stays the source of truth."`
- Two CTAs: `"Get started"` (filled, bg-foreground) + `"Learn about agents →"` (ghost/outline)
- Product screenshot below: dark frosted border (`border border-border/60 bg-card/30 backdrop-blur-sm`), subtle purple/indigo radial glow behind the image (`bg-[radial-gradient(...)]`)

### 3-Pillar Row

Three equal columns, small uppercase tracking label above each, short title + 2-line description. No card borders — just spacing.

| Pillar | Title | Description |
|--------|-------|-------------|
| 1 | Git as source of truth | Content lives in your repo, not a database. No vendor lock-in, full ownership. |
| 2 | AI-native workflow | Claude and ChatGPT work inside your editorial flow — brainstorm, draft, iterate. |
| 3 | Review before publish | AI drafts stay attached to content tasks. The same human approval path decides what ships. |

### Bento Feature Grid

Asymmetric 2-row grid of dark cards (`bg-card/20 border border-border/60 rounded-2xl`):

**Row 1:**
- Large card (≈2/3 width): "A familiar editing experience" — editor screenshot
- Small card (≈1/3 width): "MCP connector" — paste one URL, Claude & ChatGPT are connected

**Row 2:**
- Small card (≈1/3 width): "Task-first workflow" — scope the work before drafting
- Large card (≈2/3 width): "Review before publish" — review UI screenshot, drafts go through the same human approval path

On mobile: all cards stack full-width.

### CTA Section

Centered inside a rounded dark card (`rounded-3xl border border-border/60 bg-card/20`) with a subtle top-right radial glow:

- Heading: `"Ready to edit content in the AI era?"`
- Subtext: `"Deploy your own instance or connect Claude and ChatGPT to your repo today."`
- Two buttons: `"Get started"` (filled) + `"View on GitHub →"` (outline)

### Footer (multi-column)

Replace current single-row footer with:

**Left column:** App name + tagline ("Git-based content editing for the AI era. MIT licensed.") + copyright

**Right columns:**
- **Product**: Features, Agents / MCP
- **Resources**: Documentation, GitHub

Layout: `flex-col md:flex-row`, logo column takes more space, link columns use `gap-x-16` between them.

### Header (scroll enhancement)

Add a `border-b border-border/40` that appears only after scrolling past ~10px (via `useScrolled` hook or `scroll` event listener). Currently the header has no border at all — this matches Linear's pattern of a subtle separator that fades in on scroll.

## Visual Tokens (match existing project)

- Background: existing `bg-background` (already near-black in dark forced theme)
- Cards: `bg-card/20`, `border-border/60`
- Glow: `radial-gradient(ellipse at top, rgba(99,102,241,0.15), transparent 60%)`
- Typography: existing Tailwind scale — `text-5xl md:text-7xl` for hero, `tracking-[-0.03em]`
- Animations: reuse existing `marketing-fade-up` keyframes from `globals.css`

## What Does NOT Change

- `MarketingChrome` wrapper logic
- Docs layout, sidebar, or TOC
- Any app (main) routes
- Brand constants (`APP_NAME`, `FORK_URL`, etc.)

## Success Criteria

- Homepage visually reads as Linear-inspired: dark, minimal, bold
- "AI era" angle is front and center in the hero
- Bento grid and 3-pillar row are present and responsive
- Footer has multi-column link layout
- Header gains scroll border effect
- No regressions in docs layout
