# Homepage Linear Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the marketing homepage to match Linear's visual style — dark minimal aesthetic, bold centered hero, 3-pillar row, asymmetric bento grid, multi-column footer, and scroll-activated header border.

**Architecture:** Three focused file changes — page.tsx (content rebuild), marketing-footer.tsx (multi-column layout), marketing-header.tsx (scroll border state). No new abstractions, no new dependencies; reuses existing `marketing-fade-up` keyframes, `bg-card/20 border-border/60` card tokens, and `MarketingBackground` background component.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS v4, existing shadcn button variants, `@/lib/brand` constants, `@/lib/routes` constants.

## Global Constraints

- Do NOT modify `components/marketing/marketing-chrome.tsx`, `app/(marketing)/layout.tsx`, docs layout, or any `app/(main)` routes.
- Brand constants (`APP_NAME`, `FORK_URL`, `FORK_COPYRIGHT`, `FORK_TAGLINE`, etc.) must be imported from `@/lib/brand` — do not hardcode them.
- Route constants (`DOCS_PATH`, `SIGN_IN_PATH`) from `@/lib/routes`.
- Use only existing Tailwind tokens: `bg-background`, `bg-card/20`, `border-border/60`, `text-foreground`, `text-muted-foreground`, `rounded-2xl`, `rounded-3xl`.
- Hero typography: `text-5xl md:text-7xl`, `tracking-[-0.03em]`, `text-balance`.
- Glow color: `rgba(99,102,241,0.15)` (indigo).
- Animations: reuse `.marketing-fade-up`, `.marketing-fade-up-delay-1/2/3` from `globals.css`.

---

### Task 1: Header — scroll border effect

**Files:**
- Modify: `components/marketing/marketing-header.tsx`

**Interfaces:**
- Produces: `MarketingHeader` component with `border-b border-border/40` that becomes visible after scrolling past 10px.

- [ ] **Step 1: Add `useScrolled` state to the existing `MarketingHeader` component**

Open `components/marketing/marketing-header.tsx`. Add a `useEffect` that listens to `scroll` on `window` and sets a boolean `scrolled` state to `true` when `scrollY > 10`.

Replace the existing `MarketingHeader` function body with:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { DOCS_PATH, SIGN_IN_PATH } from "@/lib/routes";

const navItems = [
  { label: "Docs", href: DOCS_PATH },
  {
    label: "GitHub",
    href: "https://github.com/Blaise1030/pagescms",
    external: true,
  },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();
  const isDocs = pathname.startsWith("/docs");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-gradient-to-t from-transparent via-transparent to-background transition-all duration-200",
        scrolled && "border-b border-border/40",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-14 items-center gap-4 px-4 md:px-6",
          isDocs ? "max-w-[1400px]" : "max-w-6xl",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-medium tracking-tight text-foreground/90 transition-colors hover:text-foreground"
        >
          <AppLogo className="size-6" />
          <span>{APP_NAME}</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname.startsWith(item.href) && !item.external
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center">
          <Link
            href={SIGN_IN_PATH}
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or same errors as baseline before this change).

- [ ] **Step 3: Commit**

```bash
git add components/marketing/marketing-header.tsx
git commit -m "feat: add scroll border to marketing header"
```

---

### Task 2: Footer — multi-column layout

**Files:**
- Modify: `components/marketing/marketing-footer.tsx`

**Interfaces:**
- Consumes: `APP_NAME`, `FORK_URL`, `FORK_COPYRIGHT` from `@/lib/brand`; `DOCS_PATH` from `@/lib/routes`
- Produces: `MarketingFooter` with left brand column + two right link columns (Product, Resources)

- [ ] **Step 1: Rewrite `MarketingFooter` with multi-column layout**

Replace the entire file content of `components/marketing/marketing-footer.tsx`:

```tsx
import Link from "next/link";
import { APP_NAME, FORK_URL, FORK_COPYRIGHT } from "@/lib/brand";
import { DOCS_PATH } from "@/lib/routes";

const productLinks = [
  { label: "Features", href: "/#features" },
  { label: "Agents / MCP", href: "/#agents" },
] as const;

const resourceLinks = [
  { label: "Documentation", href: DOCS_PATH },
  { label: "GitHub", href: FORK_URL, external: true },
] as const;

export function MarketingFooter() {
  return (
    <footer className="sticky bottom-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background border-t-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 md:flex-row md:items-start md:px-6">
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium tracking-tight text-foreground">{APP_NAME}</p>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            Git-based content editing for the AI era. MIT licensed.
          </p>
          <p className="text-xs text-muted-foreground/60">{FORK_COPYRIGHT}</p>
        </div>

        <div className="flex gap-x-16 text-sm">
          <div className="space-y-3">
            <p className="font-medium text-foreground">Product</p>
            <nav className="flex flex-col gap-2 text-muted-foreground">
              {productLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-3">
            <p className="font-medium text-foreground">Resources</p>
            <nav className="flex flex-col gap-2 text-muted-foreground">
              {resourceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                  {...("external" in item && item.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify `FORK_COPYRIGHT` exists in brand exports**

```bash
grep -n "FORK_COPYRIGHT" /Users/blaisetiong/Developer/projects/cms/pagescms/lib/brand.ts
```

If it does not exist, check `brand.json` for the copyright field:
```bash
cat /Users/blaisetiong/Developer/projects/cms/pagescms/brand.json | grep -i copyright
```

If `fork.copyright` is missing from `brand.json`, fall back to a static string `"© 2024"` in the component and skip the import.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add components/marketing/marketing-footer.tsx
git commit -m "feat: multi-column footer layout"
```

---

### Task 3: Homepage — Hero section

**Files:**
- Modify: `app/(marketing)/page.tsx`

**Interfaces:**
- Produces: default export `HomePage` with Hero section containing pill badge, headline, subtext, two CTAs, and placeholder product screenshot area.

- [ ] **Step 1: Write the Hero section**

Replace the entire content of `app/(marketing)/page.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MarketingBackground } from "@/components/marketing/marketing-background";
import { cn } from "@/lib/utils";
import { DOCS_PATH, SIGN_IN_PATH } from "@/lib/routes";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center px-4 pb-24 pt-24 text-center md:pt-32">
        <MarketingBackground />

        {/* Pill badge */}
        <div className="marketing-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/30 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          <span className="text-foreground font-medium">New</span>
          <span>→</span>
          <span>AI & MCP agents</span>
        </div>

        {/* Headline */}
        <h1 className="marketing-fade-up marketing-fade-up-delay-1 mx-auto max-w-3xl text-5xl font-bold tracking-[-0.03em] text-balance text-foreground md:text-7xl">
          Git-based content editing for the AI era
        </h1>

        {/* Subtext */}
        <p className="marketing-fade-up marketing-fade-up-delay-2 mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
          Let Claude and ChatGPT draft, edit, and review content inside your existing workflow. Git stays the source of truth.
        </p>

        {/* CTAs */}
        <div className="marketing-fade-up marketing-fade-up-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={SIGN_IN_PATH}
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            Get started
          </Link>
          <Link
            href={DOCS_PATH}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Learn about agents →
          </Link>
        </div>

        {/* Product screenshot placeholder */}
        <div className="marketing-fade-up marketing-fade-up-delay-3 relative mt-16 w-full max-w-4xl">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="marketing-hero-glow rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div className="flex h-[320px] items-center justify-center text-muted-foreground/40 text-sm md:h-[480px]">
              {/* Replace with actual screenshot: <Image src="/screenshot.png" alt="Editor" fill className="object-cover object-top" /> */}
              Editor screenshot
            </div>
          </div>
        </div>
      </section>

      {/* 3-Pillar Row */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            {
              label: "Ownership",
              title: "Git as source of truth",
              description:
                "Content lives in your repo, not a database. No vendor lock-in, full ownership.",
            },
            {
              label: "AI-native",
              title: "AI-native workflow",
              description:
                "Claude and ChatGPT work inside your editorial flow — brainstorm, draft, iterate.",
            },
            {
              label: "Safety",
              title: "Review before publish",
              description:
                "AI drafts stay attached to content tasks. The same human approval path decides what ships.",
            },
          ].map(({ label, title, description }) => (
            <div key={title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {label}
              </p>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bento Feature Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        {/* Row 1 */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Large card — 2/3 */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Editing
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              A familiar editing experience
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Markdown-first editor that feels like the tools you already know, powered by your Git repo.
            </p>
            <div className="mt-auto flex h-36 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground/30 text-xs">
              Editor screenshot
            </div>
          </div>

          {/* Small card — 1/3 */}
          <div id="agents" className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Agents
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              MCP connector
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Paste one URL. Claude & ChatGPT are connected to your content workflow.
            </p>
          </div>
        </div>

        {/* Row 2 */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/* Small card — 1/3 */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Workflow
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Task-first workflow
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Scope the work before drafting. Agents operate inside well-defined tasks.
            </p>
          </div>

          {/* Large card — 2/3 */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Review
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Review before publish
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Drafts go through the same human approval path. AI suggests, humans decide.
            </p>
            <div className="mt-auto flex h-36 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground/30 text-xs">
              Review UI screenshot
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-6xl px-4 pb-32 md:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/20 px-8 py-16 text-center">
          {/* Top-right radial glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18),transparent_70%)]" />

          <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
            Ready to edit content in the AI era?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
            Deploy your own instance or connect Claude and ChatGPT to your repo today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={SIGN_IN_PATH}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              Get started
            </Link>
            <Link
              href="https://github.com/Blaise1030/pagescms"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View on GitHub →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/page.tsx"
git commit -m "feat: rebuild homepage with Linear-style layout"
```

---

### Task 4: Visual check — run dev server

**Files:** (no code changes)

- [ ] **Step 1: Start dev server**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && pnpm dev
```

Navigate to `http://localhost:3000` in a browser.

- [ ] **Step 2: Verify success criteria**

Checklist (visual, not automated):
- [ ] Hero pill badge visible at top
- [ ] Hero headline is large, bold, centered (`text-5xl md:text-7xl`)
- [ ] Two CTAs render side-by-side
- [ ] 3-pillar row shows 3 columns on desktop, stacks on mobile
- [ ] Bento grid shows asymmetric 2/3 + 1/3 rows on desktop, stacks on mobile
- [ ] CTA section is inside dark rounded card with visible glow
- [ ] Footer shows left brand column + Product + Resources columns on desktop
- [ ] Scrolling the page causes the header border to appear (subtle `border-b border-border/40`)
- [ ] Navigate to `/docs` — docs layout unchanged, no regressions

- [ ] **Step 3: Commit if any minor CSS tweaks needed**

```bash
git add -p
git commit -m "fix: homepage visual polish after review"
```

---

## Self-Review

**Spec coverage:**
- ✅ Hero: pill badge, headline, subtext, two CTAs, screenshot placeholder, purple glow behind image
- ✅ 3-Pillar Row: 3 equal columns, label + title + description, no card borders
- ✅ Bento Feature Grid: 4 cards in 2 rows, asymmetric 2/3 + 1/3, mobile stacks
- ✅ CTA Section: dark rounded card, top-right radial glow, two buttons
- ✅ Footer: left brand column + Product + Resources link columns, `gap-x-16`
- ✅ Header: scroll border via `useScrolled` state + `scroll` event listener
- ✅ `MarketingChrome` untouched, docs layout untouched
- ✅ `APP_NAME`, `FORK_URL`, brand constants used (not hardcoded)
- ✅ Animations: `.marketing-fade-up` and delay classes reused

**Placeholder scan:** Screenshot areas use visible placeholder text with a comment showing how to replace with `<Image>` — intentional, not incomplete logic. All copy is final per spec.

**Type consistency:** `SIGN_IN_PATH`, `DOCS_PATH` used consistently in Task 3; `FORK_COPYRIGHT` import in Task 2 has a fallback instruction if the export doesn't exist in `brand.ts`.
