import type { Config } from "@/types/config";

type SiteBootstrapRoute = {
  name: string;
  type: string;
  label?: string;
  contentPath: string;
  filename: string | null;
  extension: string;
  sitePath: string;
};

type SiteBootstrapCreateItem = {
  label: string;
  href: string;
};

type SiteBootstrapData = {
  create: SiteBootstrapCreateItem[];
  routes: SiteBootstrapRoute[];
};

const toWidgetSitePath = (path: string) =>
  path.replace(/\{\{([^}]+)\}\}/g, "{$1}").replace(/\{fields\.([^}]+)\}/g, "{$1}");

const buildSiteBootstrapData = (
  config: Config | null,
  params: { owner: string; repo: string; branch: string },
): SiteBootstrapData => {
  const contentItems = Array.isArray(config?.object?.content)
    ? config.object.content
    : [];

  const owner = config?.owner || params.owner.toLowerCase();
  const repo = config?.repo || params.repo.toLowerCase();
  const branch = params.branch;

  const create = contentItems
    .filter(
      (item: Record<string, unknown>) =>
        item?.type === "collection" && typeof item.name === "string",
    )
    .map((item: Record<string, unknown>) => ({
      label:
        typeof item.label === "string" && item.label.length > 0
          ? item.label
          : String(item.name),
      href: `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/collection/${encodeURIComponent(String(item.name))}/new`,
    }));

  const routes = contentItems
    .filter(
      (item: Record<string, unknown>) =>
        typeof item?.name === "string"
        && typeof item?.type === "string"
        && (item.type === "collection" || item.type === "file")
        && typeof item?.site === "object"
        && typeof (item.site as Record<string, unknown>)?.path === "string",
    )
    .map((item: Record<string, unknown>) => ({
      name: String(item.name),
      type: String(item.type),
      label:
        typeof item.label === "string" && item.label.length > 0
          ? item.label
          : String(item.name),
      contentPath: typeof item.path === "string" ? item.path : "",
      filename: typeof item.filename === "string" ? item.filename : null,
      extension: typeof item.extension === "string" ? item.extension : "",
      sitePath: toWidgetSitePath(
        String((item.site as Record<string, unknown>).path),
      ),
    }));

  return { create, routes };
};

export type { SiteBootstrapCreateItem, SiteBootstrapData, SiteBootstrapRoute };
export { buildSiteBootstrapData, toWidgetSitePath };
