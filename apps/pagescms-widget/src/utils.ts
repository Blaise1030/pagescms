export function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getCurrentPathname(pathname = window.location.pathname) {
  return normalizePathname(pathname);
}

export function getCurrentMetadataValue(name: string) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.getAttribute("content") : null;
}

export function getTokenValue(
  params: Record<string, string>,
  tokenName: string,
) {
  if (Object.prototype.hasOwnProperty.call(params, tokenName)) {
    return params[tokenName];
  }

  if (tokenName === "primary" || tokenName === "slug") {
    if (Object.prototype.hasOwnProperty.call(params, "slug")) return params.slug;
    if (Object.prototype.hasOwnProperty.call(params, "primary")) {
      return params.primary;
    }
    const keys = Object.keys(params);
    if (keys.length > 0) return params[keys[0]];
  }

  return "";
}
