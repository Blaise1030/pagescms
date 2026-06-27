import { loadBootstrap } from "./bootstrap";
import {
  cleanupActivationFromUrl,
  hasActivationInLocation,
  readSiteConfig,
} from "./config";
import { applyPreviewBinding } from "./preview";
import type { PreviewBinding } from "./types";
import { AdminWidget } from "./ui/admin-widget";

function main() {
  const config = readSiteConfig();
  if (!config) return;

  const warnedPreviewTargets: Record<string, boolean> = {};
  let bootstrapPromise: Promise<void> | null = null;
  let bootstrapLoaded = false;

  const widget = new AdminWidget(
    config.cmsOrigin,
    config.owner,
    config.repo,
    config.branch,
    config.isEmbedded,
    () => window.PagesCMS.hide(),
  );

  function postPreviewDebug(level: "info" | "warn", message: string) {
    if (!config.isEmbedded || !window.parent) return;
    window.parent.postMessage(
      {
        type: "pagescms:preview:debug",
        level,
        message,
      },
      config.cmsOrigin,
    );
  }

  function notifyPreviewReady() {
    if (!config.isEmbedded || !window.parent) return;
    window.parent.postMessage({ type: "pagescms:preview:ready" }, config.cmsOrigin);
  }

  function handlePreviewMessage(event: MessageEvent) {
    if (event.origin !== config.cmsOrigin) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "pagescms:preview:hello") {
      notifyPreviewReady();
      return;
    }

    if (data.type !== "pagescms:preview:update" || !Array.isArray(data.bindings)) {
      return;
    }

    (data.bindings as PreviewBinding[]).forEach((binding) => {
      applyPreviewBinding(binding, warnedPreviewTargets, postPreviewDebug);
    });
  }

  function setAdminBarVisible(isVisible: boolean) {
    return widget.setAdminBarVisible(isVisible);
  }

  function ensureBootstrapLoaded() {
    if (bootstrapLoaded) return Promise.resolve();
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = loadBootstrap(
      config.cmsOrigin,
      config.owner,
      config.repo,
      config.branch,
    )
      .then((data) => {
        widget.setBootstrapData(data);
        widget.syncBarActions();
        bootstrapLoaded = true;
      })
      .finally(() => {
        bootstrapPromise = null;
      });

    return bootstrapPromise;
  }

  function activateFromLocation() {
    if (!hasActivationInLocation()) return false;
    setAdminBarVisible(true);
    cleanupActivationFromUrl();
    return true;
  }

  function initialize() {
    window.PagesCMS = Object.assign({}, window.PagesCMS, {
      toggle(nextValue?: boolean) {
        if (typeof nextValue === "boolean") {
          return setAdminBarVisible(nextValue);
        }
        return setAdminBarVisible(!widget.isBarVisible());
      },
      show() {
        return setAdminBarVisible(true);
      },
      hide() {
        return setAdminBarVisible(false);
      },
    });

    document.addEventListener("click", (event) => {
      widget.handleDocumentClick(event);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        widget.closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      widget.repositionMenuIfOpen();
    });

    if (!activateFromLocation() && widget.isBarVisible()) {
      setAdminBarVisible(true);
    }

    void ensureBootstrapLoaded();
    window.addEventListener("message", handlePreviewMessage);
    notifyPreviewReady();
    window.addEventListener("load", notifyPreviewReady, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
}

main();
