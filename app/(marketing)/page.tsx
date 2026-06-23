import React from "react";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { MarketingBackground } from "@/components/marketing/marketing-background";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { DOCS_PATH, SIGN_IN_PATH } from "@/lib/routes";
import { FORK_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

type EditorialOverlay = {
  src: string;
  alt: string;
  position: "corner" | "center";
  className?: string;
  backdrop?: boolean;
};

type EditorialSection = {
  fig: string;
  headline: string;
  description: string;
  src: string;
  overlay?: EditorialOverlay;
  inset?: {
    src: string;
    alt: string;
    className?: string;
  };
};

const editorialSections: EditorialSection[] = [
  {
    fig: "FIG 1–1",
    headline: "Zero setup",
    description:
      "Connect your GitHub repo, add a config file, and you're done. No infrastructure, no vendor accounts.",
    src: "/images/screenshot-hero.png",
    overlay: {
      src: "/images/screenshot-config.png",
      alt: "Configuration file",
      position: "corner",
    },
  },
  {
    fig: "FIG 1–2",
    headline: "Visual editing",
    description:
      "A rich editor that adapts to your content structure. Fields, media, rich-text — exactly as you define them.",
    src: "/images/screenshot-visual-editing.png",
  },
  {
    fig: "FIG 1–3",
    headline: "Git as your backend",
    description:
      "Every save is a commit. Full history, instant rollbacks, and branch-based workflows — all built in.",
    src: "/images/screenshot-hero.png",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative mx-auto flex max-w-screen-xl flex-col px-4 pb-24 pt-24 md:px-6 md:pt-32">
        <MarketingBackground />

        {/* Headline */}
        <h1 className="marketing-fade-up max-w-3xl text-5xl font-medium tracking-[-0.03em] text-balance text-foreground md:text-7xl">
          The simplest CMS you&apos;ll ever need
        </h1>

        {/* Subtext */}
        <p className="marketing-fade-up marketing-fade-up-delay-1 mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
          Manage content and media right in your GitHub repository. No database, no API, no extra backend.
        </p>

        {/* CTAs */}
        <div className="marketing-fade-up marketing-fade-up-delay-2 mt-10 flex flex-wrap items-center gap-3">
          <Link href={SIGN_IN_PATH} className={buttonVariants({ size: "lg" })}>
            Get started
          </Link>
          <Link
            href={DOCS_PATH}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Quick start →
          </Link>
        </div>

        {/* Product screenshot */}
        <div className="marketing-fade-up marketing-fade-up-delay-3 relative mt-16 w-full">
          <div className="overflow-hidden border-t border-border/60 bg-card/30 backdrop-blur-sm">
            <Image
              src="/images/screenshot-hero.png"
              alt="PagesCMS editor interface"
              width={1456}
              height={816}
              className="w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* Editorial Sections */}
      <section className="mx-auto max-w-screen-xl px-4 md:px-6">
        {editorialSections.map(({ fig, headline, description, src, overlay, inset }) => (
          <div key={fig} className="border-t border-border/40 py-16 md:py-20">
            <div className="mb-10 grid gap-6 md:grid-cols-2 md:gap-12">
              <div>
                <span className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {fig}
                </span>
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-foreground md:text-5xl lg:text-6xl">
                  {headline}
                </h2>
              </div>
              <div className="flex items-end">
                <p className="text-base leading-7 text-muted-foreground md:text-lg">
                  {description}
                </p>
              </div>
            </div>
            <div className="relative border border-border/60 bg-card/20 p-px">
              <div className="overflow-hidden">
                <Image
                  src={src}
                  alt={headline}
                  width={1440}
                  height={900}
                  className="w-full object-cover object-top"
                />
              </div>
              {overlay?.backdrop && (
                <div className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-[1px]" />
              )}
              {overlay && (
                <div
                  className={cn(
                    "absolute z-20 overflow-hidden shadow-2xl",
                    overlay.position === "center"
                      ? "inset-0 flex items-center justify-center p-4"
                      : "bottom-6 right-6 w-2/5",
                  )}
                >
                  <Image
                    src={overlay.src}
                    alt={overlay.alt}
                    width={720}
                    height={480}
                    className={cn(
                      "h-auto w-full object-cover object-top",
                      overlay.position === "center" && overlay.className,
                    )}
                  />
                </div>
              )}
              {inset && (
                <div
                  className={cn(
                    "absolute overflow-hidden rounded-lg border border-border/60 shadow-2xl",
                    inset.className ?? "bottom-6 right-6 w-2/5",
                  )}
                >
                  <Image
                    src={inset.src}
                    alt={inset.alt}
                    width={720}
                    height={480}
                    className="h-auto w-full object-cover object-top"
                  />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
            </div>
          </div>
        ))}
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-screen-xl px-4 pb-24 md:px-6">
        <p className="mb-12 max-w-4xl text-3xl leading-snug tracking-[-0.02em] text-foreground md:text-[2.5rem]">
          <span className="font-semibold">Just as powerful as the big boys...</span>{" "}
          <span className="font-normal text-muted-foreground">
            Without the price tag, the sales call, or the vendor lock-in.
          </span>
        </p>
        <FeatureGrid />
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-screen-xl px-4 pb-32 md:px-6">
        <div className="rounded-3xl border border-border/60 bg-card/20 px-8 py-16 text-center">
          <h2 className="mx-auto max-w-xl text-3xl font-medium tracking-[-0.03em] text-foreground md:text-4xl">
            Ready to edit content in the AI era?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
            Deploy your own instance or connect Claude and ChatGPT to your repo today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={SIGN_IN_PATH} className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link
              href={FORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              View on GitHub →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
