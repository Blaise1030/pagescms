import type { SiteConfig } from "./types";

export function readSiteConfig(): SiteConfig | null {
  const scriptElement = document.currentScript;
  if (!(scriptElement instanceof HTMLScriptElement)) return null;

  const scriptUrl = new URL(scriptElement.src, window.location.href);

  return {
    scriptElement,
    scriptUrl,
    cmsOrigin:
      scriptElement.getAttribute("data-pagescms-origin") || scriptUrl.origin,
    owner: scriptElement.getAttribute("data-pagescms-owner") || "",
    repo: scriptElement.getAttribute("data-pagescms-repo") || "",
    branch: scriptElement.getAttribute("data-pagescms-branch") || "main",
    isEmbedded: window.top !== window,
  };
}

export function cleanupActivationFromUrl() {
  const currentUrl = new URL(window.location.href);
  let changed = false;

  if (currentUrl.searchParams.has("pagescms")) {
    currentUrl.searchParams.delete("pagescms");
    changed = true;
  }

  if (currentUrl.hash === "#pagescms" || currentUrl.hash.startsWith("#pagescms=")) {
    currentUrl.hash = "";
    changed = true;
  }

  if (changed) {
    window.history.replaceState(window.history.state, "", currentUrl.toString());
  }
}

export function hasActivationInLocation() {
  const url = new URL(window.location.href);
  return (
    url.searchParams.has("pagescms") ||
    url.hash === "#pagescms" ||
    url.hash.startsWith("#pagescms=")
  );
}
