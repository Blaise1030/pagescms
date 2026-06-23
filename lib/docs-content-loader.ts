export type DocFrontmatter = {
  title: string;
  description?: string;
};

const docModules = import.meta.glob<string>("../content/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function parseFrontmatter(raw: string): { data: DocFrontmatter; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: { title: "" }, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^"|"$/g, "");
    data[key] = val;
  }

  return {
    data: { title: data.title ?? "", description: data.description },
    content: match[2].trimStart(),
  };
}

function filePathToSlugKey(importPath: string): string {
  const match = importPath.match(/content\/docs\/(.+)\.md$/);
  if (!match) return "";
  const rel = match[1];
  if (rel === "index") return "";
  const parts = rel.split("/");
  if (parts[parts.length - 1] === "index") {
    return parts.slice(0, -1).join("/");
  }
  return rel;
}

const docsBySlugKey = new Map<string, string>();

for (const [importPath, raw] of Object.entries(docModules)) {
  docsBySlugKey.set(filePathToSlugKey(importPath), raw);
}

function slugToKey(slug: string[]): string {
  if (slug.length === 0) return "";
  return slug.join("/");
}

export function loadDocContent(slug: string[]): { data: DocFrontmatter; content: string } | null {
  const key = slugToKey(slug);
  const raw = docsBySlugKey.get(key);
  if (!raw) return null;
  return parseFrontmatter(raw);
}

export function getAllDocSlugs(): string[][] {
  return [...docsBySlugKey.keys()].map((key) => (key === "" ? [] : key.split("/")));
}
