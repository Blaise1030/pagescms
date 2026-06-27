"use strict";
(() => {
  // src/bootstrap.ts
  async function loadBootstrap(cmsOrigin, owner, repo, branch) {
    var _a, _b;
    if (!owner || !repo || !branch) {
      return { create: [], routes: [] };
    }
    const endpoint = `${cmsOrigin}/api/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/site`;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        mode: "cors"
      });
      if (!response.ok) {
        throw new Error("Failed to load site actions.");
      }
      const payload = await response.json();
      return {
        create: Array.isArray((_a = payload == null ? void 0 : payload.data) == null ? void 0 : _a.create) ? payload.data.create : [],
        routes: Array.isArray((_b = payload == null ? void 0 : payload.data) == null ? void 0 : _b.routes) ? payload.data.routes : []
      };
    } catch {
      return { create: [], routes: [] };
    }
  }

  // src/config.ts
  function readSiteConfig() {
    const scriptElement = document.currentScript;
    if (!(scriptElement instanceof HTMLScriptElement)) return null;
    const scriptUrl = new URL(scriptElement.src, window.location.href);
    return {
      scriptElement,
      scriptUrl,
      cmsOrigin: scriptElement.getAttribute("data-pagescms-origin") || scriptUrl.origin,
      owner: scriptElement.getAttribute("data-pagescms-owner") || "",
      repo: scriptElement.getAttribute("data-pagescms-repo") || "",
      branch: scriptElement.getAttribute("data-pagescms-branch") || "main",
      isEmbedded: window.top !== window
    };
  }
  function cleanupActivationFromUrl() {
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
  function hasActivationInLocation() {
    const url = new URL(window.location.href);
    return url.searchParams.has("pagescms") || url.hash === "#pagescms" || url.hash.startsWith("#pagescms=");
  }

  // src/preview.ts
  function applyBinding(element, bind, value) {
    if (!element) return;
    switch (bind) {
      case "text":
        element.textContent = value == null ? "" : String(value);
        return;
      case "html":
        element.innerHTML = value == null ? "" : String(value);
        return;
      case "value":
        if ("value" in element) {
          element.value = value == null ? "" : String(value);
        } else {
          element.setAttribute("value", value == null ? "" : String(value));
        }
        return;
      case "src":
        element.setAttribute("src", value == null ? "" : String(value));
        if ("src" in element) {
          element.src = value == null ? "" : String(value);
        }
        return;
      case "href":
        element.setAttribute("href", value == null ? "" : String(value));
        if ("href" in element) {
          element.href = value == null ? "" : String(value);
        }
        return;
      case "checked":
        if ("checked" in element) {
          element.checked = Boolean(value);
        } else if (value) {
          element.setAttribute("checked", "checked");
        } else {
          element.removeAttribute("checked");
        }
        return;
      case "content":
        element.setAttribute("content", value == null ? "" : String(value));
        return;
      default:
        return;
    }
  }
  function hideRepeatedNode(node) {
    if (!node.hasAttribute("data-pagescms-display")) {
      node.setAttribute("data-pagescms-display", node.style.display || "");
    }
    node.style.display = "none";
  }
  function showRepeatedNode(node) {
    const previousDisplay = node.getAttribute("data-pagescms-display");
    node.style.display = previousDisplay == null ? "" : previousDisplay;
  }
  function resolveRepeatedTargets(selector, desiredCount) {
    if (selector.includes("{n}")) {
      const indexedTargets = [];
      for (let index = 0; index < desiredCount; index += 1) {
        const indexedElement = document.querySelector(
          selector.replace(/\{n\}/g, String(index + 1))
        );
        if (indexedElement) {
          indexedTargets.push(indexedElement);
        }
      }
      return indexedTargets;
    }
    const matchedNodes = Array.from(document.querySelectorAll(selector));
    if (matchedNodes.length === 0) return [];
    if (desiredCount === 0) {
      matchedNodes.forEach((node) => {
        hideRepeatedNode(node);
      });
      return [];
    }
    const templateNode = matchedNodes[0];
    const parentNode = templateNode.parentElement;
    if (!parentNode) {
      return matchedNodes.slice(0, desiredCount);
    }
    while (matchedNodes.length < desiredCount) {
      const clone = templateNode.cloneNode(true);
      parentNode.appendChild(clone);
      matchedNodes.push(clone);
    }
    matchedNodes.forEach((node, index) => {
      if (index < desiredCount) {
        showRepeatedNode(node);
      } else {
        hideRepeatedNode(node);
      }
    });
    return matchedNodes.slice(0, desiredCount);
  }
  function applyPreviewBinding(binding, warnedPreviewTargets, onDebug) {
    if (!(binding == null ? void 0 : binding.target) || !binding.bind) return 0;
    if (Array.isArray(binding.value)) {
      const targets = resolveRepeatedTargets(binding.target, binding.value.length);
      if (targets.length === 0 && !warnedPreviewTargets[binding.target]) {
        warnedPreviewTargets[binding.target] = true;
        console.warn("[Pages CMS] Preview target not found:", binding.target);
        onDebug("warn", `Preview target not found: ${binding.target}`);
      }
      binding.value.forEach((item, index) => {
        var _a;
        applyBinding((_a = targets[index]) != null ? _a : null, binding.bind, item);
      });
      return targets.length;
    }
    const target = document.querySelector(binding.target);
    if (!target && !warnedPreviewTargets[binding.target]) {
      warnedPreviewTargets[binding.target] = true;
      console.warn("[Pages CMS] Preview target not found:", binding.target);
      onDebug("warn", `Preview target not found: ${binding.target}`);
    }
    applyBinding(target, binding.bind, binding.value);
    return target ? 1 : 0;
  }

  // src/utils.ts
  function normalizePathname(pathname) {
    if (!pathname || pathname === "/") return "/";
    return pathname.replace(/\/+$/, "") || "/";
  }
  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function getCurrentPathname(pathname = window.location.pathname) {
    return normalizePathname(pathname);
  }
  function getCurrentMetadataValue(name) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.getAttribute("content") : null;
  }
  function getTokenValue(params, tokenName) {
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

  // src/routes.ts
  function buildRepoUrl(cmsOrigin, owner, repo, branch) {
    if (!owner || !repo || !branch) return cmsOrigin;
    return `${cmsOrigin}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}`;
  }
  function buildEditUrl(cmsOrigin, owner, repo, branch) {
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
  function buildCollectionEditUrl(cmsOrigin, owner, repo, branch, name, contentPath) {
    return `${buildRepoUrl(cmsOrigin, owner, repo, branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(contentPath)}`;
  }
  function resolveFilenameFromRoute(route, params) {
    if (route.type !== "collection") return null;
    const template = typeof route.filename === "string" && route.filename ? route.filename : "";
    const hasUnsupportedDateToken = /\{(?:year|month|day|hour|minute|second)\}/.test(
      template
    );
    if (template && !hasUnsupportedDateToken) {
      let failed = false;
      const resolved = template.replace(
        /\{(?:fields\.)?([^}]+)\}/g,
        (_, token) => {
          const tokenValue = getTokenValue(params, token);
          if (!tokenValue) {
            failed = true;
            return "";
          }
          return String(tokenValue);
        }
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
    const extension = route.extension ? `.${String(route.extension).replace(/^\./, "")}` : "";
    return `${String(fallbackValue)}${extension}`;
  }
  function matchRoutePath(route, pathname) {
    if (!route.sitePath) return null;
    const tokenNames = [];
    const pattern = `^${escapeRegex(normalizePathname(route.sitePath)).replace(
      /\\\{([^}]+)\\\}/g,
      (_, token) => {
        tokenNames.push(token);
        return "([^/]+)";
      }
    )}/?$`;
    const match = new RegExp(pattern).exec(getCurrentPathname(pathname));
    if (!match) return null;
    const params = {};
    tokenNames.forEach((token, index) => {
      params[token] = decodeURIComponent(match[index + 1]);
    });
    return params;
  }
  function buildRouteEditUrl(cmsOrigin, owner, repo, branch, route) {
    if (!route.name) return null;
    if (route.type === "file" && normalizePathname(route.sitePath || "") === getCurrentPathname()) {
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
      `${route.contentPath.replace(/\/+$/, "")}/${filename}`
    );
  }
  function buildResolvedEditUrl(cmsOrigin, owner, repo, branch, routes) {
    const metadataUrl = buildEditUrl(cmsOrigin, owner, repo, branch);
    if (metadataUrl) return metadataUrl;
    for (const route of routes) {
      const routeEditUrl = buildRouteEditUrl(
        cmsOrigin,
        owner,
        repo,
        branch,
        route
      );
      if (routeEditUrl) return routeEditUrl;
    }
    return null;
  }

  // src/ui/styles.ts
  var WIDGET_STYLES = [
    ":host { all: initial; }",
    ".pagescms-root, .pagescms-root * { box-sizing: border-box; }",
    ".pagescms-root { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: oklch(0.985 0.001 106.423); }",
    ".pagescms-bar { all: unset; position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; display: none; flex-direction: column; align-items: center; gap: 0; padding: 4px; border-radius: 0.875rem; border: 1px solid oklch(1 0 0 / 0.1); background: oklch(0.147 0.004 49.25 / 0.94); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.18), 0 2px 4px -2px rgba(0,0,0,0.18); }",
    ".pagescms-button { all: unset; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 0.5rem; background: transparent; color: oklch(0.709 0.01 56.259); cursor: pointer; transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease; -webkit-tap-highlight-color: transparent; }",
    ".pagescms-button:hover, .pagescms-button:focus-visible, .pagescms-button[data-open='true'] { background: oklch(0.216 0.006 56.043); color: oklch(0.985 0.001 106.423); }",
    ".pagescms-button:focus-visible { outline: 2px solid oklch(0.553 0.013 58.071); outline-offset: 2px; }",
    ".pagescms-button[hidden] { display: none; }",
    ".pagescms-menu { position: fixed; z-index: 2147483647; width: max-content; min-width: 120px; max-width: calc(100vw - 32px); overflow: hidden; border: 1px solid oklch(1 0 0 / 0.1); border-radius: 0.5rem; background: oklch(0.216 0.006 56.043); color: oklch(0.985 0.001 106.423); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.18), 0 2px 4px -2px rgba(0,0,0,0.18); outline: none; padding: 0.25rem; opacity: 0; transform: translateY(4px) scale(0.95); transform-origin: left center; pointer-events: none; visibility: hidden; transition: opacity 120ms ease, transform 120ms ease, visibility 120ms step-end; }",
    ".pagescms-menu[data-open='true'] { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; visibility: visible; transition: opacity 120ms ease, transform 120ms ease, visibility 0s; }",
    ".pagescms-empty { margin: 0; padding: 0.375rem 0.5rem; color: oklch(0.709 0.01 56.259); font-size: 0.875rem; line-height: 1.25rem; }",
    ".pagescms-items { display: grid; gap: 0; }",
    ".pagescms-item { all: unset; display: flex; width: 100%; min-height: 0; align-items: center; gap: 0.5rem; border-radius: 0.375rem; padding: 0.375rem 0.5rem; color: oklch(0.985 0.001 106.423); font-size: 0.875rem; line-height: 1.25rem; font-weight: 400; white-space: nowrap; text-decoration: none; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }",
    ".pagescms-item:hover, .pagescms-item:focus-visible { background: oklch(0.268 0.007 34.298); color: oklch(0.985 0.001 106.423); }",
    ".pagescms-item:focus-visible { outline: none; }"
  ].join("");

  // src/ui/icons.ts
  function createIcon(paths) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("style", "width:16px;height:16px;display:block;");
    paths.forEach((definition) => {
      const node = document.createElementNS(
        "http://www.w3.org/2000/svg",
        definition.type
      );
      Object.entries(definition.attributes).forEach(([name, value]) => {
        node.setAttribute(name, value);
      });
      svg.appendChild(node);
    });
    return svg;
  }
  function createPencilIcon() {
    return createIcon([
      {
        type: "path",
        attributes: {
          d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      },
      {
        type: "path",
        attributes: {
          d: "m15 5 4 4",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      }
    ]);
  }
  function createPlusIcon() {
    return createIcon([
      {
        type: "path",
        attributes: {
          d: "M12 5v14",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      },
      {
        type: "path",
        attributes: {
          d: "M5 12h14",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      }
    ]);
  }
  function createCloseIcon() {
    return createIcon([
      {
        type: "path",
        attributes: {
          d: "M18 6 6 18",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      },
      {
        type: "path",
        attributes: {
          d: "m6 6 12 12",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      }
    ]);
  }

  // src/ui/admin-widget.ts
  var AdminWidget = class {
    constructor(cmsOrigin, owner, repo, branch, isEmbedded, onHide) {
      this.cmsOrigin = cmsOrigin;
      this.owner = owner;
      this.repo = repo;
      this.branch = branch;
      this.isEmbedded = isEmbedded;
      this.onHide = onHide;
      this.hostElement = null;
      this.shadowRootElement = null;
      this.barElement = null;
      this.editButtonElement = null;
      this.addButtonElement = null;
      this.closeButtonElement = null;
      this.menuElement = null;
      this.bootstrapData = { create: [], routes: [] };
      this.sessionKey = "pagescms:admin-visible";
    }
    setBootstrapData(data) {
      this.bootstrapData = data;
    }
    ensureUiRoot() {
      if (this.shadowRootElement) return this.shadowRootElement;
      this.hostElement = document.createElement("div");
      this.hostElement.id = "pagescms-widget-root";
      this.hostElement.setAttribute("aria-hidden", "false");
      this.shadowRootElement = this.hostElement.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = WIDGET_STYLES;
      const root = document.createElement("div");
      root.className = "pagescms-root";
      this.shadowRootElement.appendChild(style);
      this.shadowRootElement.appendChild(root);
      document.body.appendChild(this.hostElement);
      return this.shadowRootElement;
    }
    createMenuItem(options) {
      this.ensureUiRoot();
      const element = document.createElement(options.href ? "a" : "button");
      if (options.href) {
        element.href = options.href;
        if (options.external !== false) {
          element.target = "_blank";
          element.rel = "noreferrer";
        }
      } else {
        element.type = "button";
      }
      element.textContent = options.label;
      element.className = "pagescms-item";
      if (options.onClick) {
        element.addEventListener("click", options.onClick);
      }
      return element;
    }
    createActionButton(label, icon) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "pagescms-button";
      element.setAttribute("aria-label", label);
      element.setAttribute("title", label);
      element.appendChild(icon);
      return element;
    }
    ensureBar() {
      if (this.barElement) return this.barElement;
      const root = this.ensureUiRoot().querySelector(".pagescms-root");
      if (!root) throw new Error("Pages CMS widget root not found.");
      this.barElement = document.createElement("div");
      this.barElement.className = "pagescms-bar";
      this.editButtonElement = document.createElement("a");
      this.editButtonElement.className = "pagescms-button";
      this.editButtonElement.setAttribute("aria-label", "Edit entry");
      this.editButtonElement.setAttribute("title", "Edit entry");
      this.editButtonElement.target = "_blank";
      this.editButtonElement.rel = "noreferrer";
      this.editButtonElement.appendChild(createPencilIcon());
      this.addButtonElement = this.createActionButton("Add content", createPlusIcon());
      this.addButtonElement.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.setMenuVisible(
          !(this.menuElement && this.menuElement.getAttribute("data-open") === "true")
        );
      });
      this.closeButtonElement = this.createActionButton("Close menu", createCloseIcon());
      this.closeButtonElement.addEventListener("click", () => {
        if (!window.confirm("Hide the Pages CMS menu for this tab?")) return;
        this.onHide();
      });
      this.barElement.appendChild(this.editButtonElement);
      this.barElement.appendChild(this.addButtonElement);
      this.barElement.appendChild(this.closeButtonElement);
      root.appendChild(this.barElement);
      return this.barElement;
    }
    ensureMenu() {
      if (this.menuElement) return this.menuElement;
      const root = this.ensureUiRoot().querySelector(".pagescms-root");
      if (!root) throw new Error("Pages CMS widget root not found.");
      this.menuElement = document.createElement("div");
      this.menuElement.id = "pagescms-admin-menu";
      this.menuElement.className = "pagescms-menu";
      this.menuElement.setAttribute("data-open", "false");
      root.appendChild(this.menuElement);
      return this.menuElement;
    }
    setMenuVisible(isVisible) {
      const menu = this.ensureMenu();
      menu.setAttribute("data-open", isVisible ? "true" : "false");
      if (this.addButtonElement) {
        this.addButtonElement.setAttribute("data-open", isVisible ? "true" : "false");
      }
      if (isVisible) {
        this.positionMenu();
      }
    }
    positionMenu() {
      if (!this.menuElement || !this.addButtonElement) return;
      const rect = this.addButtonElement.getBoundingClientRect();
      const menuWidth = this.menuElement.offsetWidth || 120;
      const menuHeight = this.menuElement.offsetHeight || 0;
      let left = Math.min(rect.right + 8, window.innerWidth - menuWidth - 16);
      left = Math.max(16, left);
      let top = rect.top + rect.height / 2 - menuHeight / 2;
      top = Math.max(16, Math.min(top, window.innerHeight - menuHeight - 16));
      this.menuElement.style.left = `${left}px`;
      this.menuElement.style.top = `${top}px`;
    }
    renderMenu() {
      const menu = this.ensureMenu();
      menu.textContent = "";
      const createItems = this.bootstrapData.create;
      if (createItems.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.textContent = "No collections available.";
        emptyState.className = "pagescms-empty";
        menu.appendChild(emptyState);
      } else {
        const createGroup = document.createElement("div");
        createGroup.className = "pagescms-items";
        createItems.forEach((item) => {
          createGroup.appendChild(
            this.createMenuItem({
              label: item.label,
              href: `${this.cmsOrigin}${item.href}`
            })
          );
        });
        menu.appendChild(createGroup);
      }
      this.positionMenu();
    }
    syncBarActions() {
      this.renderMenu();
      this.ensureBar();
      const editUrl = buildResolvedEditUrl(
        this.cmsOrigin,
        this.owner,
        this.repo,
        this.branch,
        this.bootstrapData.routes
      );
      if (this.editButtonElement) {
        this.editButtonElement.href = editUrl || buildRepoUrl(this.cmsOrigin, this.owner, this.repo, this.branch);
        this.editButtonElement.hidden = !editUrl;
      }
    }
    setAdminBarVisible(isVisible) {
      if (this.isEmbedded) return false;
      if (isVisible) {
        sessionStorage.setItem(this.sessionKey, "1");
        this.syncBarActions();
        this.ensureBar().style.display = "flex";
        return true;
      }
      sessionStorage.removeItem(this.sessionKey);
      this.setMenuVisible(false);
      if (this.barElement) {
        this.barElement.style.display = "none";
      }
      return false;
    }
    isMenuOpen() {
      var _a;
      return ((_a = this.menuElement) == null ? void 0 : _a.getAttribute("data-open")) === "true";
    }
    closeMenu() {
      this.setMenuVisible(false);
    }
    repositionMenuIfOpen() {
      if (this.isMenuOpen()) {
        this.positionMenu();
      }
    }
    isBarVisible() {
      return sessionStorage.getItem(this.sessionKey) === "1";
    }
    handleDocumentClick(event) {
      if (!this.isMenuOpen() || !this.menuElement) return;
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (eventPath.includes(this.menuElement)) return;
      if (this.barElement && eventPath.includes(this.barElement)) return;
      this.setMenuVisible(false);
    }
  };

  // src/index.ts
  function main() {
    const config = readSiteConfig();
    if (!config) return;
    const warnedPreviewTargets = {};
    let bootstrapPromise = null;
    let bootstrapLoaded = false;
    const widget = new AdminWidget(
      config.cmsOrigin,
      config.owner,
      config.repo,
      config.branch,
      config.isEmbedded,
      () => window.PagesCMS.hide()
    );
    function postPreviewDebug(level, message) {
      if (!config.isEmbedded || !window.parent) return;
      window.parent.postMessage(
        {
          type: "pagescms:preview:debug",
          level,
          message
        },
        config.cmsOrigin
      );
    }
    function notifyPreviewReady() {
      if (!config.isEmbedded || !window.parent) return;
      window.parent.postMessage({ type: "pagescms:preview:ready" }, config.cmsOrigin);
    }
    function handlePreviewMessage(event) {
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
      data.bindings.forEach((binding) => {
        applyPreviewBinding(binding, warnedPreviewTargets, postPreviewDebug);
      });
    }
    function setAdminBarVisible(isVisible) {
      return widget.setAdminBarVisible(isVisible);
    }
    function ensureBootstrapLoaded() {
      if (bootstrapLoaded) return Promise.resolve();
      if (bootstrapPromise) return bootstrapPromise;
      bootstrapPromise = loadBootstrap(
        config.cmsOrigin,
        config.owner,
        config.repo,
        config.branch
      ).then((data) => {
        widget.setBootstrapData(data);
        widget.syncBarActions();
        bootstrapLoaded = true;
      }).finally(() => {
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
        toggle(nextValue) {
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
        }
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
})();
