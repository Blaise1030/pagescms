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
    <footer className="bg-gradient-to-b from-transparent via-transparent to-background border-t-0">
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
