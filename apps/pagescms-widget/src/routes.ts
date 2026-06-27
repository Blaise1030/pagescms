import type { BootstrapRoute } from "./types";
import {
  escapeRegex,
  getCurrentMetadataValue,
  getCurrentPathname,
  getTokenValue,
  normalizePathname,
} from "./utils";

export function buildRepoUrl(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
) {
  if (!owner || !repo || !branch) return cmsOrigin;
  return `${cmsOrigin}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}`;
}

export function buildEditUrl(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
) {
  const contentName = getCurrentMetadataValue("pagescms:name");
  const contentType = getCurrentMetadataValue("pagescms:type");
  const contentPath = getCurrentMetadataValue("pagescms:path");
  const repoUrl = buildRepoUrl(cmsOrigin, owner, repo, branch);

  if (!contentName) return null;

  if (contentType === "file") {
    return `${repoUrl}/file/${encodeURIComponent(contentName)}`;
  }

  if (contentType === "collection" && contentPath) {
    return `${repoUrl}/collection/${encodeURIComponent(contentName)}/edit/${encodeURIComponent(contentPath)}`;
  }

  return null;
}

export function buildCollectionEditUrl(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
  name: string,
  contentPath: string,
) {
  return `${buildRepoUrl(cmsOrigin, owner, repo, branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(contentPath)}`;
}

export function resolveFilenameFromRoute(
  route: BootstrapRoute,
  params: Record<string, string>,
) {
  if (route.type !== "collection") return null;

  const template =
    typeof route.filename === "string" && route.filename ? route.filename : "";
  const hasUnsupportedDateToken = /\{(?:year|month|day|hour|minute|second)\}/.test(
    template,
  );

  if (template && !hasUnsupportedDateToken) {
    let failed = false;
    const resolved = template.replace(
      /\{(?:fields\.)?([^}]+)\}/g,
      (_, token: string) => {
        const tokenValue = getTokenValue(params, token);
        if (!tokenValue) {
          failed = true;
          return "";
        }
        return String(tokenValue);
      },
    );

    if (!failed && !resolved.includes("{")) {
      return resolved;
    }
  }

  let fallbackValue = getTokenValue(params, "slug");
  if (!fallbackValue) {
    const paramKeys = Object.keys(params);
    fallbackValue = paramKeys.length > 0 ? params[paramKeys[0]] : "";
  }

  if (!fallbackValue) return null;

  const extension = route.extension
    ? `.${String(route.extension).replace(/^\./, "")}`
    : "";
  return `${String(fallbackValue)}${extension}`;
}

export function matchRoutePath(route: BootstrapRoute, pathname?: string) {
  if (!route.sitePath) return null;

  const tokenNames: string[] = [];
  const pattern = `^${escapeRegex(normalizePathname(route.sitePath)).replace(
    /\\\{([^}]+)\\\}/g,
    (_, token: string) => {
      tokenNames.push(token);
      return "([^/]+)";
    },
  )}/?$`;
  const match = new RegExp(pattern).exec(getCurrentPathname(pathname));
  if (!match) return null;

  const params: Record<string, string> = {};
  tokenNames.forEach((token, index) => {
    params[token] = decodeURIComponent(match[index + 1]);
  });
  return params;
}

export function buildRouteEditUrl(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
  route: BootstrapRoute,
) {
  if (!route.name) return null;

  if (
    route.type === "file" &&
    normalizePathname(route.sitePath || "") === getCurrentPathname()
  ) {
    return `${buildRepoUrl(cmsOrigin, owner, repo, branch)}/file/${encodeURIComponent(route.name)}`;
  }

  if (route.type !== "collection" || !route.contentPath) return null;

  const params = matchRoutePath(route);
  if (!params) return null;

  const filename = resolveFilenameFromRoute(route, params);
  if (!filename) return null;

  return buildCollectionEditUrl(
    cmsOrigin,
    owner,
    repo,
    branch,
    route.name,
    `${route.contentPath.replace(/\/+$/, "")}/${filename}`,
  );
}

export function buildResolvedEditUrl(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
  routes: BootstrapRoute[],
) {
  const metadataUrl = buildEditUrl(cmsOrigin, owner, repo, branch);
  if (metadataUrl) return metadataUrl;

  for (const route of routes) {
    const routeEditUrl = buildRouteEditUrl(
      cmsOrigin,
      owner,
      repo,
      branch,
      route,
    );
    if (routeEditUrl) return routeEditUrl;
  }

  return null;
}
