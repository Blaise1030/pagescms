export type DocsNavItem = {
  title: string;
  href: string;
  items?: DocsNavItem[];
};

export function getFlattenedDocs(): { title: string; href: string }[] {
  const result: { title: string; href: string }[] = [];
  for (const item of docsNavigation) {
    if (item.items && item.items.length > 0) {
      result.push(...item.items);
    } else {
      result.push({ title: item.title, href: item.href });
    }
  }
  return result;
}

export const docsNavigation: DocsNavItem[] = [
  {
    title: "Introduction",
    href: "/docs",
  },
  {
    title: "Quick start",
    href: "/docs/quick-start",
  },
  {
    title: "Configuration",
    href: "/docs/configuration",
    items: [
      {
        title: "Overview",
        href: "/docs/configuration",
      },
      {
        title: "Media",
        href: "/docs/configuration/media",
      },
      {
        title: "Content",
        href: "/docs/configuration/content",
      },
      {
        title: "Components",
        href: "/docs/configuration/components",
      },
      {
        title: "Settings",
        href: "/docs/configuration/settings",
      },
      {
        title: "Actions",
        href: "/docs/configuration/actions",
      },
      {
        title: "Collaborators",
        href: "/docs/configuration/collaborators",
      },
    ],
  },
  {
    title: "Preview",
    href: "/docs/preview",
    items: [
      {
        title: "Overview",
        href: "/docs/preview",
      },
      {
        title: "Next.js",
        href: "/docs/preview/nextjs",
      },
      {
        title: "Nuxt",
        href: "/docs/preview/nuxt",
      },
      {
        title: "SvelteKit",
        href: "/docs/preview/sveltekit",
      },
      {
        title: "Astro",
        href: "/docs/preview/astro",
      },
    ],
  },
  {
    title: "AI & MCP",
    href: "/docs/ai",
    items: [
      {
        title: "Overview",
        href: "/docs/ai",
      },
      {
        title: "Content service",
        href: "/docs/ai/content-service",
      },
      {
        title: "Setup skills",
        href: "/docs/ai/setup-skills",
      },
    ],
  },
  {
    title: "Deployment",
    href: "/docs/deployment/cloudflare",
    items: [
      {
        title: "Cloudflare Workers",
        href: "/docs/deployment/cloudflare",
      },
    ],
  },
];
