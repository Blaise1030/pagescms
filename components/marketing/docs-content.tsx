"use client";

import { useEffect } from "react";
import { docsHeadingId } from "@/lib/docs-heading-id";
import { cn } from "@/lib/utils";
import { useDocsToc } from "@/components/marketing/docs-toc";

export function DocsContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "docs-content min-w-0 space-y-8 text-[15px] leading-7 text-foreground/90",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function DocsTitle({
  children,
  description,
}: {
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <header className="space-y-3 border-b border-border/60 pb-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {children}
      </h1>
      {description ? (
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function DocsSection({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  const sectionId = id ?? docsHeadingId(title);
  const { register, unregister } = useDocsToc();

  useEffect(() => {
    register({ id: sectionId, title });
    return () => unregister(sectionId);
  }, [register, sectionId, title, unregister]);

  return (
    <section className="scroll-mt-24 space-y-4">
      <h2
        id={sectionId}
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {title}
      </h2>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </section>
  );
}

export function DocsCodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-muted/30",
        className,
      )}
    >
      <pre className="overflow-x-auto p-4 text-sm leading-6">
        <code>{children}</code>
      </pre>
    </div>
  );
}
