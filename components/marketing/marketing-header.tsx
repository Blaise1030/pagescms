"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, FORK_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { DOCS_PATH, SIGN_IN_PATH } from "@/lib/routes";

const navItems = [
  { label: "Docs", href: DOCS_PATH },
  {
    label: "GitHub",
    href: FORK_URL,
    external: true,
  },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();
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
        className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 md:px-6"
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
