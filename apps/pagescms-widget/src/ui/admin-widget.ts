import type { BootstrapData } from "../types";
import { buildRepoUrl, buildResolvedEditUrl } from "../routes";
import { WIDGET_STYLES } from "./styles";
import { createCloseIcon, createPencilIcon, createPlusIcon } from "./icons";

type MenuItemOptions = {
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
};

export class AdminWidget {
  private hostElement: HTMLDivElement | null = null;
  private shadowRootElement: ShadowRoot | null = null;
  private barElement: HTMLDivElement | null = null;
  private editButtonElement: HTMLAnchorElement | null = null;
  private addButtonElement: HTMLButtonElement | null = null;
  private closeButtonElement: HTMLButtonElement | null = null;
  private menuElement: HTMLDivElement | null = null;
  private bootstrapData: BootstrapData = { create: [], routes: [] };
  private readonly sessionKey = "pagescms:admin-visible";

  constructor(
    private readonly cmsOrigin: string,
    private readonly owner: string,
    private readonly repo: string,
    private readonly branch: string,
    private readonly isEmbedded: boolean,
    private readonly onHide: () => boolean,
  ) {}

  setBootstrapData(data: BootstrapData) {
    this.bootstrapData = data;
  }

  private ensureUiRoot() {
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

  private createMenuItem(options: MenuItemOptions) {
    this.ensureUiRoot();
    const element = document.createElement(options.href ? "a" : "button");

    if (options.href) {
      element.href = options.href;
      if (options.external !== false) {
        element.target = "_blank";
        element.rel = "noreferrer";
      }
    } else {
      (element as HTMLButtonElement).type = "button";
    }

    element.textContent = options.label;
    element.className = "pagescms-item";

    if (options.onClick) {
      element.addEventListener("click", options.onClick);
    }

    return element;
  }

  private createActionButton(label: string, icon: SVGSVGElement) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "pagescms-button";
    element.setAttribute("aria-label", label);
    element.setAttribute("title", label);
    element.appendChild(icon);
    return element;
  }

  private ensureBar() {
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
        !(this.menuElement && this.menuElement.getAttribute("data-open") === "true"),
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

  private ensureMenu() {
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

  private setMenuVisible(isVisible: boolean) {
    const menu = this.ensureMenu();
    menu.setAttribute("data-open", isVisible ? "true" : "false");
    if (this.addButtonElement) {
      this.addButtonElement.setAttribute("data-open", isVisible ? "true" : "false");
    }
    if (isVisible) {
      this.positionMenu();
    }
  }

  private positionMenu() {
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
            href: `${this.cmsOrigin}${item.href}`,
          }),
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
      this.bootstrapData.routes,
    );

    if (this.editButtonElement) {
      this.editButtonElement.href =
        editUrl || buildRepoUrl(this.cmsOrigin, this.owner, this.repo, this.branch);
      this.editButtonElement.hidden = !editUrl;
    }
  }

  setAdminBarVisible(isVisible: boolean) {
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
    return this.menuElement?.getAttribute("data-open") === "true";
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

  handleDocumentClick(event: MouseEvent) {
    if (!this.isMenuOpen() || !this.menuElement) return;

    const eventPath =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    if (eventPath.includes(this.menuElement)) return;
    if (this.barElement && eventPath.includes(this.barElement)) return;
    this.setMenuVisible(false);
  }
}
