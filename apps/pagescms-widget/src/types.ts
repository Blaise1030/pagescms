export type PreviewBind =
  | "text"
  | "html"
  | "value"
  | "src"
  | "href"
  | "checked"
  | "content";

export type PreviewBinding = {
  target: string;
  bind: PreviewBind;
  value: string | boolean | Array<string | boolean>;
};

export type BootstrapCreateItem = {
  label: string;
  href: string;
};

export type BootstrapRoute = {
  name: string;
  type: "collection" | "file";
  sitePath?: string;
  contentPath?: string;
  filename?: string;
  extension?: string;
};

export type BootstrapData = {
  create: BootstrapCreateItem[];
  routes: BootstrapRoute[];
};

export type SiteConfig = {
  scriptElement: HTMLScriptElement;
  scriptUrl: URL;
  cmsOrigin: string;
  owner: string;
  repo: string;
  branch: string;
  isEmbedded: boolean;
};

export type PagesCMSApi = {
  toggle: (nextValue?: boolean) => boolean;
  show: () => boolean;
  hide: () => boolean;
};

declare global {
  interface Window {
    PagesCMS: PagesCMSApi;
  }
}

export {};
