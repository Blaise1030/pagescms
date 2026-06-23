import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MarketingBackground } from "@/components/marketing/marketing-background";
import { cn } from "@/lib/utils";
import { DOCS_PATH, SIGN_IN_PATH } from "@/lib/routes";
import { FORK_URL } from "@/lib/brand";

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
                "Content lives in your repository. Every edit is a commit. Roll back any change in seconds.",
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
      <section id="agents" className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        {/* Row 1 */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Large card — 2/3 */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Editor
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Write and edit with AI
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Draft content, get suggestions, and iterate — all without leaving your CMS.
            </p>
            <div className="mt-auto flex h-36 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground/30 text-xs">
              Editor screenshot
            </div>
          </div>

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
        </div>

        {/* Row 2 */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/* Small card — 1/3 */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Git
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Every edit is a commit
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Full history. Roll back instantly. Deploy on merge.
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
              href={FORK_URL}
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
