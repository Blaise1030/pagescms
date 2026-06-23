import { cn } from "@/lib/utils";

type FeatureShowcaseItem = {
  label: string;
  title: string;
  description: string;
};

export function FeatureShowcase({
  items,
  className,
}: {
  items: FeatureShowcaseItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {items.map((item, index) => (
        <article
          key={item.title}
          className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-6 backdrop-blur-sm transition-colors hover:border-border hover:bg-card/50"
        >
          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
            Fig {index + 1}
          </p>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <h3 className="mb-3 text-lg font-medium tracking-tight text-foreground">
            {item.title}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </article>
      ))}
    </div>
  );
}
