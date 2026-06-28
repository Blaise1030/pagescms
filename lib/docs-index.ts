import { getAllDocSlugs, loadDocContent } from "@/lib/docs-content-loader";

type DocChunk = {
  slug: string;
  title: string;
  content: string;
};

const buildDocIndex = (): DocChunk[] => {
  const chunks: DocChunk[] = [];
  for (const slug of getAllDocSlugs()) {
    const doc = loadDocContent(slug);
    if (!doc) continue;
    chunks.push({
      slug: slug.join("/") || "index",
      title: doc.data.title,
      content: doc.content,
    });
  }
  return chunks;
};

const DOC_INDEX = buildDocIndex();

const searchDocs = (query: string, limit = 5): DocChunk[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return DOC_INDEX.map((chunk) => {
    const haystack = `${chunk.title}\n${chunk.content}`.toLowerCase();
    const titleMatch = chunk.title.toLowerCase().includes(normalized) ? 3 : 0;
    const contentMatch = haystack.includes(normalized) ? 1 : 0;
    const termHits = normalized
      .split(/\s+/)
      .filter(Boolean)
      .reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
    return { chunk, score: titleMatch + contentMatch + termHits };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
};

const getDoc = (slug: string): DocChunk | null => {
  const parts = slug === "index" || slug === "" ? [] : slug.split("/");
  const doc = loadDocContent(parts);
  if (!doc) return null;
  return {
    slug: parts.join("/") || "index",
    title: doc.data.title,
    content: doc.content,
  };
};

export { getDoc, searchDocs };
export type { DocChunk };
