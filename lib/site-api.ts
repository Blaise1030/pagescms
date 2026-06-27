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

const parseOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return null;
  }
};

const getExtraOriginsFromEnv = (): string[] => {
  const raw = process.env.PAGESCMS_SITE_API_ORIGINS || process.env.SITE_API_EXTRA_ORIGINS;
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => parseOrigin(item))
    .filter((origin): origin is string => Boolean(origin));
};

const getAllowedSiteOrigins = (configObject?: Record<string, unknown> | null): string[] => {
  const origins = new Set<string>(getExtraOriginsFromEnv());
  const site = configObject?.settings as Record<string, unknown> | undefined;
  const siteSettings = site?.site;

  if (!siteSettings || typeof siteSettings !== "object") {
    return [...origins];
  }

  const siteRecord = siteSettings as Record<string, unknown>;

  if (typeof siteRecord.url === "string") {
    const origin = parseOrigin(siteRecord.url);
    if (origin) origins.add(origin);
  }

  if (Array.isArray(siteRecord.origins)) {
    for (const entry of siteRecord.origins) {
      if (typeof entry !== "string") continue;
      const origin = parseOrigin(entry);
      if (origin) origins.add(origin);
    }
  }

  return [...origins];
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

const resolveSiteCorsHeaders = (
  request: Request,
  allowedOrigins: string[],
): HeadersInit => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const isSiteOriginAllowed = (request: Request, allowedOrigins: string[]) => {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

export type { SiteBootstrapCreateItem, SiteBootstrapData, SiteBootstrapRoute };
export {
  buildSiteBootstrapData,
  getAllowedSiteOrigins,
  isSiteOriginAllowed,
  resolveSiteCorsHeaders,
  toWidgetSitePath,
};
