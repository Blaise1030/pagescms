"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocsToc } from "@/components/marketing/docs-toc";
import { docsHeadingId } from "@/lib/docs-heading-id";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Link2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function extractH2s(markdown: string): { id: string; title: string }[] {
  return Array.from(markdown.matchAll(/^## (.+)$/gm)).map(([, title]) => ({
    id: docsHeadingId(title),
    title,
  }));
}

type PageLink = { title: string; href: string };

function CopyPageButton({ content }: { content: string }) {
  const [copied, setCopied] = useState<"link" | "markdown" | null>(null);

  function copy(type: "link" | "markdown") {
    const text = type === "link" ? window.location.href : content;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 1800);
  }

  const base = cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full");

  return (
    <div className="flex items-center">
      <button onClick={() => copy("link")} className={cn(base, "rounded-r-none pr-2.5")}>
        {copied === "link" ? <Check className="text-green-500" /> : <Copy />}
        Copy page
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(base, "rounded-l-none border-l border-secondary-foreground/10 px-2")}>
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copy("link")}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy("markdown")}>
            {copied === "markdown" ? <Check className="text-green-500" /> : <Copy />}
            Copy as markdown
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DocsMarkdownContent({
  title,
  description,
  content,
  prev,
  next,
}: {
  title: string;
  description?: string;
  content: string;
  prev?: PageLink;
  next?: PageLink;
}) {
  const { register, unregister } = useDocsToc();

  useEffect(() => {
    const headings = extractH2s(content);
    headings.forEach((h) => register(h));
    return () => headings.forEach((h) => unregister(h.id));
  }, [content, register, unregister]);

  return (
    <article className="docs-content min-w-0 space-y-8 text-[15px] leading-7 text-foreground/90">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-1 pt-1">
            <CopyPageButton content={content} />
          </div>
        </div>
        {description && (
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </header>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2({ children }) {
            const text = String(children);
            const id = docsHeadingId(text);
            return (
              <section className="scroll-mt-24 space-y-4">
                <h2
                  id={id}
                  className="text-xl font-semibold tracking-tight text-foreground"
                >
                  {children}
                </h2>
              </section>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base font-semibold text-foreground">
                {children}
              </h3>
            );
          },
          p({ children }) {
            return <p className="text-muted-foreground">{children}</p>;
          },
          ul({ children }) {
            return (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                {children}
              </ol>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            const isBlock = Boolean(className?.startsWith("language-"));
            if (isBlock) {
              return (
                <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/30">
                  <pre className="overflow-x-auto p-4 text-sm leading-6">
                    <code className={className}>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[480px] text-left text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="border-b border-border/80 bg-muted/40">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 font-medium text-foreground">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-3 text-muted-foreground">{children}</td>
            );
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-foreground">
                {children}
              </strong>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      <footer className="mt-12 flex items-center justify-between gap-4 border-t border-border/60 pt-8">
        {prev ? (
          <Link href={prev.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <ChevronLeft />
            {prev.title}
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link href={next.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {next.title}
            <ChevronRight />
          </Link>
        ) : (
          <div />
        )}
      </footer>
    </article>
  );
}
