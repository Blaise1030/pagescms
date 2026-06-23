import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsMarkdownContent } from "@/components/marketing/docs-markdown";
import { getAllDocSlugs, loadDocContent } from "@/lib/docs-content-loader";
import { getFlattenedDocs } from "@/lib/docs-navigation";

type Params = { slug?: string[] };

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) =>
    slug.length === 0 ? {} : { slug },
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadDocContent(slug ?? []);
  if (!doc) return {};
  return {
    title: doc.data.title,
    description: doc.data.description,
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = loadDocContent(slug ?? []);
  if (!doc) notFound();

  const currentHref = "/docs" + (slug && slug.length > 0 ? "/" + slug.join("/") : "");
  const flatDocs = getFlattenedDocs();
  const currentIndex = flatDocs.findIndex((p) => p.href === currentHref);
  const prev = currentIndex > 0 ? flatDocs[currentIndex - 1] : undefined;
  const next = currentIndex < flatDocs.length - 1 ? flatDocs[currentIndex + 1] : undefined;

  return (
    <DocsMarkdownContent
      title={doc.data.title}
      description={doc.data.description}
      content={doc.content}
      prev={prev}
      next={next}
    />
  );
}
