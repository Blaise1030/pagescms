"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { DocsTocProvider, DocsTocSidebar } from "@/components/marketing/docs-toc";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { docsNavigation } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";

function DocsNavLink({
  href,
  title,
  active,
  onNavigate,
}: {
  href: string;
  title: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "w-fit max-w-full rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {title}
    </Link>
  );
}

function DocsSidebarNav({
  pathname,
  navRef,
  onScroll,
  onNavigate,
  className,
}: {
  pathname: string;
  navRef?: React.RefObject<HTMLElement | null>;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav
      ref={navRef}
      onScroll={onScroll}
      className={cn(
        "scrollbar flex flex-col gap-1 overflow-y-auto px-0.5 pb-4 pr-3 pt-1",
        className,
      )}
    >
      {docsNavigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/docs" && pathname.startsWith(item.href));

        return (
          <div key={item.href} className="flex flex-col gap-0.5">
            <DocsNavLink
              href={item.href}
              title={item.title}
              active={isActive}
              onNavigate={onNavigate}
            />
            {item.items && item.items.length > 0 && (
              <div className="ml-4 flex flex-col gap-0.5">
                {item.items.map((child) => (
                  <DocsNavLink
                    key={child.href}
                    href={child.href}
                    title={child.title}
                    active={pathname === child.href}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobileNav = () => setMobileOpen(false);

  return (
    <DocsTocProvider>
      {!mobileOpen && (
        <button
          type="button"
          className="fixed bottom-6 left-4 z-50 flex size-11 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-muted/60 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open documentation navigation"
        >
          <PanelLeft className="size-5" />
        </button>
      )}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-xs gap-0 border-border/60 bg-background p-0 pt-12"
        >
          <div className="relative h-full overflow-hidden px-4 pb-6">
            <DocsSidebarNav
              pathname={pathname}
              onNavigate={closeMobileNav}
              className="h-full max-h-none"
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-6">
        <div className="grid items-start gap-8 py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px] xl:gap-12">
          <aside className="relative hidden md:sticky md:top-20 md:block md:h-[calc(100svh-6rem)] md:self-start">
            <div className="relative h-full overflow-hidden">
              <DocsSidebarNav
                pathname={pathname}
                navRef={navRef}
                onScroll={(event) => {
                  setScrolled(event.currentTarget.scrollTop > 8);
                }}
                className="h-full max-h-none"
              />
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background via-background/80 to-transparent transition-opacity duration-200",
                  scrolled ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background via-background/80 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 hidden w-px bg-gradient-to-b from-transparent via-border to-transparent md:block"
              />
            </div>
          </aside>

          <div className="min-w-0 pb-16">
            <div className="w-full max-w-3xl">{children}</div>
          </div>
          <DocsTocSidebar />
        </div>
      </div>
    </DocsTocProvider>
  );
}
