# Preview Feature Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local branch's simple iframe preview with the upstream `feature/preview` bridge-based preview system — dynamic URL building, a hello/ready handshake, debounced field bindings, and a "not configured" card state.

**Architecture:** The upstream adds `lib/site.ts` for config-driven URL resolution and field binding collection, replaces `preview-panel.tsx` with `entry-preview.tsx` (a self-contained component managing the bridge protocol internally), and simplifies `entry.tsx` by removing manual `postMessage` effects.

**Tech Stack:** React, `use-debounce`, `date-fns`, `marked`, Lucide icons, shadcn/ui Card

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `types/field.ts` | Add `PreviewBind`, `PreviewTextTransform`, `PreviewTransform`, `PreviewRule` types and `preview` field on `Field` |
| Create | `lib/site.ts` | URL building (`buildSiteUrl`), field binding collection (`collectPreviewBindings`), config helpers |
| Create | `components/entry/entry-preview.tsx` | Self-contained preview component: iframe + bridge hello/ready handshake + debounced updates |
| Modify | `components/entry/entry.tsx` | Remove manual postMessage effects, swap `PreviewPanel` → `EntryPreview`, use `getPreviewDefaultOpen` |
| Delete | `lib/preview.ts` | Replaced by `lib/site.ts` |

---

## Task 1: Add preview types to `types/field.ts`

**Files:**
- Modify: `types/field.ts`

- [ ] **Step 1: Read current types/field.ts**

The file currently defines `Field` without any preview-related types. We're adding four new exported types and one new optional field.

- [ ] **Step 2: Add the preview types before the `Field` export**

Open `types/field.ts` and add these types. Insert them before the `Field` type definition:

```typescript
export type PreviewBind =
  | "text"
  | "html"
  | "value"
  | "src"
  | "href"
  | "checked"
  | "content";

export type PreviewTextTransform = "uppercase" | "lowercase" | "capitalize";

export type PreviewTransform =
  | { join: string }
  | { date: string }
  | { text: PreviewTextTransform }
  | { fallback: string }
  | { prefix: string }
  | { suffix: string };

export type PreviewRule = {
  target: string;
  bind: PreviewBind;
  transform?: PreviewTransform[];
};
```

- [ ] **Step 3: Add `preview` property to the `Field` type**

In the `Field` type, add this optional field (after `fields?` and `blocks?`):

```typescript
preview?: PreviewRule | PreviewRule[];
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `types/field.ts`.

- [ ] **Step 5: Commit**

```bash
git add types/field.ts
git commit -m "feat: add preview field types (PreviewBind, PreviewRule, PreviewTransform)"
```

---

## Task 2: Create `lib/site.ts`

**Files:**
- Create: `lib/site.ts`

This module is ported from upstream `feature/preview`. It reads `settings.site.url` from the Pages CMS config object and resolves schema `site.path` templates against live form values to build a dynamic preview URL. It also collects field-level preview bindings for the bridge protocol.

- [ ] **Step 1: Create `lib/site.ts`**

```typescript
import { format as formatDate } from "date-fns";
import { marked } from "marked";
import type {
  Field,
  PreviewBind,
  PreviewRule,
  PreviewTextTransform,
} from "@/types/field";
import { resolveSchemaTemplate, safeAccess } from "@/lib/schema";
import { getFileExtension, getFileName, normalizePath } from "@/lib/utils/file";

type PreviewBindingPayload = {
  target: string;
  bind: PreviewBind;
  value: string | boolean | Array<string | boolean>;
};

const normalizeSiteUrl = (url: string) => url.replace(/\/+$/, "");

const normalizeSitePath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
};

const getSiteSettings = (configObject?: Record<string, any>) => {
  if (!configObject || typeof configObject !== "object") return {};
  const settings = configObject.settings;
  if (!settings || typeof settings !== "object") return {};
  const site = settings.site;
  return site && typeof site === "object" ? site : {};
};

const getPreviewDefaultOpen = (configObject?: Record<string, any>) => {
  const site = getSiteSettings(configObject);
  return Boolean(site?.preview?.defaultOpen);
};

const resolveSchemaSitePath = (
  schema?: Record<string, any> | null,
  values?: Record<string, any>,
  entryPath?: string | null,
) => {
  if (!schema?.site?.path || typeof schema.site.path !== "string") return null;

  const normalizedValues = values || {};
  const filename = entryPath ? getFileName(normalizePath(entryPath)) : "";
  const extension = filename ? getFileExtension(filename) : "";
  const basename =
    filename && extension
      ? filename.slice(0, -(extension.length + 1))
      : filename;
  const aliases: Record<string, unknown> = {};

  const slug = safeAccess(normalizedValues, "slug");
  if (slug != null && slug !== "") aliases.slug = slug;
  else if (basename) aliases.slug = basename;

  if (filename) aliases.filename = filename;
  if (basename) aliases.basename = basename;

  return normalizeSitePath(
    resolveSchemaTemplate(schema.site.path, schema, normalizedValues, {
      aliases,
      slugifyValues: true,
    }),
  );
};

const buildSiteUrl = (
  configObject?: Record<string, any>,
  schema?: Record<string, any> | null,
  values?: Record<string, any>,
  entryPath?: string | null,
) => {
  const site = getSiteSettings(configObject);
  if (!site?.url || typeof site.url !== "string") return null;

  const resolvedPath = resolveSchemaSitePath(schema, values, entryPath);
  if (!resolvedPath) return null;

  try {
    return new URL(resolvedPath, `${normalizeSiteUrl(site.url)}/`).toString();
  } catch {
    return null;
  }
};

const normalizePreviewRules = (preview: Field["preview"]): PreviewRule[] => {
  if (!preview) return [];
  return Array.isArray(preview) ? preview : [preview];
};

const isEmptyPreviewValue = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const applyTextTransform = (value: string, transform: PreviewTextTransform) => {
  if (transform === "uppercase") return value.toUpperCase();
  if (transform === "lowercase") return value.toLowerCase();
  if (transform === "capitalize")
    return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
};

const applyPreviewTransforms = (
  input: unknown,
  transforms: PreviewRule["transform"],
): unknown => {
  if (!transforms?.length) return input;

  let currentValue = input;

  for (const transform of transforms) {
    if ("join" in transform) {
      currentValue = Array.isArray(currentValue)
        ? currentValue.join(transform.join)
        : currentValue;
    } else if ("date" in transform) {
      const applyDateTransform = (value: unknown) => {
        if (isEmptyPreviewValue(value)) return value;
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) return value;
        try {
          return formatDate(date, transform.date);
        } catch {
          return value;
        }
      };
      currentValue = Array.isArray(currentValue)
        ? currentValue.map(applyDateTransform)
        : applyDateTransform(currentValue);
    } else if ("text" in transform) {
      if (typeof currentValue === "string") {
        currentValue = applyTextTransform(currentValue, transform.text);
      } else if (Array.isArray(currentValue)) {
        currentValue = currentValue.map((v) =>
          typeof v === "string" ? applyTextTransform(v, transform.text) : v,
        );
      }
    } else if ("fallback" in transform) {
      if (isEmptyPreviewValue(currentValue)) currentValue = transform.fallback;
    } else if ("prefix" in transform) {
      if (!isEmptyPreviewValue(currentValue))
        currentValue = `${transform.prefix}${currentValue}`;
    } else if ("suffix" in transform) {
      if (!isEmptyPreviewValue(currentValue))
        currentValue = `${currentValue}${transform.suffix}`;
    }
  }

  return currentValue;
};

const coerceBindingValue = (
  field: Field,
  bind: PreviewBind,
  value: unknown,
): string | boolean | Array<string | boolean> => {
  if (bind === "checked") return Boolean(value);

  if (bind === "html" && typeof value === "string") {
    return String(marked(value));
  }

  if (Array.isArray(value)) {
    return value.map((v) => (v == null ? "" : String(v)));
  }

  if (value == null) return "";
  return String(value);
};

const buildPreviewBinding = (
  field: Field,
  rule: PreviewRule,
  value: unknown,
): PreviewBindingPayload => ({
  target: rule.target,
  bind: rule.bind,
  value: coerceBindingValue(
    field,
    rule.bind,
    applyPreviewTransforms(value, rule.transform),
  ),
});

const collectPreviewBindings = (
  fields: Field[],
  values: Record<string, any>,
) => {
  const bindings: PreviewBindingPayload[] = [];

  for (const field of fields) {
    if (!field.preview) continue;
    const value = safeAccess(values, field.name);
    normalizePreviewRules(field.preview).forEach((rule) => {
      bindings.push(buildPreviewBinding(field, rule, value));
    });
  }

  return bindings;
};

export type { PreviewBindingPayload };
export {
  buildSiteUrl,
  collectPreviewBindings,
  getPreviewDefaultOpen,
  getSiteSettings,
  normalizeSitePath,
  normalizeSiteUrl,
  resolveSchemaSitePath,
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `lib/site.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/site.ts
git commit -m "feat: add lib/site.ts with buildSiteUrl and collectPreviewBindings"
```

---

## Task 3: Create `components/entry/entry-preview.tsx`

**Files:**
- Create: `components/entry/entry-preview.tsx`

This component replaces `preview-panel.tsx`. It manages the iframe, the bridge protocol (hello→ready handshake), debounced binding updates, and a fallback card when preview is not configured.

- [ ] **Step 1: Create `components/entry/entry-preview.tsx`**

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { AlertCircle, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { buildSiteUrl, collectPreviewBindings } from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Field } from "@/types/field";

const PREVIEW_HELLO_EVENT = "pagescms:preview:hello";
const PREVIEW_READY_EVENT = "pagescms:preview:ready";
const PREVIEW_DEBUG_EVENT = "pagescms:preview:debug";
const PREVIEW_UPDATE_EVENT = "pagescms:preview:update";

export function EntryPreview({
  fields,
  path,
  schema,
  values,
}: {
  fields: Field[];
  path?: string | null;
  schema?: Record<string, any> | null;
  values: Record<string, unknown>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { config } = useConfig();
  const [debouncedValues] = useDebounce(values, 250);
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);
  const [isBridgeReady, setIsBridgeReady] = useState(false);
  const [showBridgeWarning, setShowBridgeWarning] = useState(false);
  const [bridgeDebugMessage, setBridgeDebugMessage] = useState("");
  const [bridgeDebugLevel, setBridgeDebugLevel] = useState<"info" | "warn">("info");

  const previewUrl = useMemo(
    () => buildSiteUrl(config?.object, schema, debouncedValues as Record<string, any>, path),
    [config?.object, debouncedValues, path, schema],
  );

  const previewOrigin = useMemo(() => {
    if (!previewUrl) return null;
    try {
      return new URL(previewUrl).origin;
    } catch {
      return null;
    }
  }, [previewUrl]);

  const bindings = useMemo(
    () => collectPreviewBindings(fields, debouncedValues as Record<string, any>),
    [debouncedValues, fields],
  );

  // Reset bridge state when the URL changes (navigating to a different page)
  useEffect(() => {
    setIsFrameLoaded(false);
    setIsBridgeReady(false);
    setShowBridgeWarning(false);
    setBridgeDebugMessage("");
    setBridgeDebugLevel("info");
  }, [previewUrl]);

  // Listen for READY and DEBUG messages from the iframe
  useEffect(() => {
    if (!previewOrigin) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== previewOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === PREVIEW_READY_EVENT) {
        setIsBridgeReady(true);
        setShowBridgeWarning(false);
        return;
      }

      if (event.data?.type === PREVIEW_DEBUG_EVENT) {
        setBridgeDebugMessage(String(event.data?.message || ""));
        setBridgeDebugLevel(event.data?.level === "warn" ? "warn" : "info");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [previewOrigin]);

  // Poll HELLO until bridge is ready; warn after 5 s
  useEffect(() => {
    if (!previewOrigin || !isFrameLoaded || isBridgeReady) return;

    const sendHello = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_HELLO_EVENT },
        previewOrigin,
      );
    };

    sendHello();
    const interval = setInterval(sendHello, 500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShowBridgeWarning(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isFrameLoaded, isBridgeReady, previewOrigin]);

  // Push binding updates once the bridge is ready
  useEffect(() => {
    if (!previewOrigin || !isBridgeReady) return;

    iframeRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_UPDATE_EVENT, bindings },
      previewOrigin,
    );
  }, [bindings, isBridgeReady, previewOrigin]);

  if (!previewUrl) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Configure <code>settings.site.url</code> and{" "}
            <code>content[].site.path</code> to enable iframe preview.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b shrink-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Preview</CardTitle>
            <CardDescription className="truncate">{previewUrl}</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Open
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative flex-1 p-0">
        {showBridgeWarning && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>
              Live bindings were not detected. Install{" "}
              <code>pagescms-widget.js</code> on the public site and make sure the
              site allows iframe embedding.
            </p>
          </div>
        )}
        {bridgeDebugMessage && (
          <div
            className={
              bridgeDebugLevel === "warn"
                ? "flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                : "flex items-start gap-2 border-b border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950"
            }
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{bridgeDebugMessage}</p>
          </div>
        )}
        <div className="relative h-full">
          {!isFrameLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading preview…
              </div>
            </div>
          )}
          <iframe
            key={previewUrl}
            ref={iframeRef}
            src={previewUrl}
            title="Preview"
            onLoad={() => setIsFrameLoaded(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/entry/entry-preview.tsx
git commit -m "feat: add EntryPreview component with bridge protocol and debounced bindings"
```

---

## Task 4: Update `components/entry/entry.tsx`

**Files:**
- Modify: `components/entry/entry.tsx`

Seven surgical changes:
1. Swap `PreviewPanel` import → `EntryPreview`
2. Swap `getPreviewUrl` import → `getPreviewDefaultOpen` from `lib/site`
3. Remove `iframeRef` and `previewFormValuesRef` (managed by `EntryPreview` now)
4. Replace `previewUrl = getPreviewUrl(...)` with `hasPreview` boolean
5. Use `getPreviewDefaultOpen` for initial `showPreview` state
6. Remove three manual `postMessage` effects (lines ~641–667)
7. Replace `<PreviewPanel ...>` with `<EntryPreview ...>` and update `onValuesChange`

- [ ] **Step 1: Swap component import**

Find:
```typescript
import { PreviewPanel } from "./preview-panel";
```
Replace with:
```typescript
import { EntryPreview } from "./entry-preview";
```

- [ ] **Step 2: Swap lib/preview import**

Find:
```typescript
import { getPreviewUrl } from "@/lib/preview";
```
Replace with:
```typescript
import { getPreviewDefaultOpen } from "@/lib/site";
```

- [ ] **Step 3: Remove `iframeRef` and `previewFormValuesRef`, update `showPreview` initial value**

Find:
```typescript
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewFormValues, setPreviewFormValues] = useState<Record<string, unknown>>({});
  const previewFormValuesRef = useRef<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
```
Replace with:
```typescript
  const [previewFormValues, setPreviewFormValues] = useState<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(() => getPreviewDefaultOpen(config?.object));
  const [showEditor, setShowEditor] = useState(true);
```

- [ ] **Step 4: Replace `previewUrl` computation with `hasPreview`**

Find:
```typescript
  const previewUrl = getPreviewUrl(
    config?.object?.siteUrl as string | undefined,
    schema?.previewPath as string | undefined,
  );

  useEffect(() => {
    if (previewUrl) sidebar?.setOpen(false);
  // ponytail: run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```
Replace with:
```typescript
  const hasPreview = Boolean(schema?.site?.path);

  useEffect(() => {
    if (hasPreview) sidebar?.setOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 5: Remove the three manual postMessage effects**

Delete this block entirely (~lines 641–667 in the original file):

```typescript
  useEffect(() => {
    if (!entryContentObject || Object.keys(previewFormValuesRef.current).length > 0) return;
    previewFormValuesRef.current = entryContentObject as Record<string, unknown>;
    setPreviewFormValues(entryContentObject as Record<string, unknown>);
  }, [entryContentObject]);

  useEffect(() => {
    if (!previewUrl || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "cms:preview", data: previewFormValues },
      "*",
    );
  }, [previewFormValues, previewUrl, config?.object?.siteUrl]);

  useEffect(() => {
    if (!previewUrl) return;
    function handleReady(event: MessageEvent) {
      if (event.data?.type !== "cms:preview:ready") return;
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        { type: "cms:preview", data: previewFormValuesRef.current },
        "*",
      );
    }
    window.addEventListener("message", handleReady);
    return () => window.removeEventListener("message", handleReady);
  }, [previewUrl]);
```

Replace with a single initialization effect:
```typescript
  useEffect(() => {
    if (!entryContentObject || Object.keys(previewFormValues).length > 0) return;
    setPreviewFormValues(entryContentObject as Record<string, unknown>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryContentObject]);
```

- [ ] **Step 6: Update `headerNode` — replace `previewUrl` references with `hasPreview`**

In the `headerNode` useMemo, find:
```typescript
      {previewUrl && (
        <Button type="button" variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
      )}
```
Replace with:
```typescript
      {hasPreview && (
        <Button type="button" variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
      )}
```

Also update the `useMemo` dependency array for `headerNode` — replace `previewUrl` with `hasPreview`.

- [ ] **Step 7: Update `onValuesChange` and the return statement**

In `editorContent`, find:
```typescript
            onValuesChange={previewUrl ? (values) => {
              previewFormValuesRef.current = values;
              setPreviewFormValues(values);
            } : undefined}
```
Replace with:
```typescript
            onValuesChange={(values) => {
              setPreviewFormValues(values);
            }}
```

In the return statement, find:
```typescript
      : previewUrl
        ? (
            <div className="absolute inset-0">
              <ResizablePanelGroup orientation="horizontal" className="h-full">
                ...
                <ResizablePanel
                  defaultSize={'70%'}
                  panelRef={previewPanelRef}
                  onResize={(size) => setShowPreview(size.asPercentage > 0)}
                  className="hidden lg:flex flex-1 flex-col"
                >
                  <PreviewPanel
                    previewUrl={previewUrl}
                    formValues={previewFormValues}
                    iframeRef={iframeRef}
                    showEditor={showEditor}
                    onToggleEditor={() => {
                      if (showEditor) {
                        editorPanelRef.current?.collapse();
                      } else {
                        editorPanelRef.current?.expand();
                      }
                    }}
                    onLoad={() => {
                      if (iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage(
                          { type: "cms:preview", data: previewFormValuesRef.current },
                          "*",
                        );
                      }
                    }}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          )
```
Replace the entire `previewUrl ?` branch with `hasPreview ?` and swap the panel content:
```typescript
      : hasPreview
        ? (
            <div className="absolute inset-0">
              <ResizablePanelGroup orientation="horizontal" className="h-full">
                <ResizablePanel
                  collapsible
                  collapsedSize={0}
                  defaultSize={'30%'}
                  minSize={'32%'}
                  panelRef={editorPanelRef}
                  onResize={(size) => setShowEditor(size.asPercentage > 0)}
                  className="scrollbar overflow-y-auto overflow-x-hidden"
                >
                  {editorContent}
                </ResizablePanel>
                <ResizableHandle className="hidden lg:flex mx-1" />
                <ResizablePanel
                  defaultSize={'70%'}
                  panelRef={previewPanelRef}
                  onResize={(size) => setShowPreview(size.asPercentage > 0)}
                  className="hidden lg:flex flex-1 flex-col"
                >
                  <EntryPreview
                    fields={entryFields}
                    path={path}
                    schema={schema}
                    values={previewFormValues}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          )
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. If `iframeRef` is referenced elsewhere in the file, remove those references too.

- [ ] **Step 9: Commit**

```bash
git add components/entry/entry.tsx
git commit -m "feat: integrate EntryPreview into entry editor, remove manual postMessage bridge"
```

---

## Task 5: Delete `lib/preview.ts`

**Files:**
- Delete: `lib/preview.ts`

- [ ] **Step 1: Confirm nothing else imports `lib/preview`**

```bash
grep -r "lib/preview" /Users/blaisetiong/Developer/projects/cms/pagescms/components /Users/blaisetiong/Developer/projects/cms/pagescms/app /Users/blaisetiong/Developer/projects/cms/pagescms/lib 2>/dev/null
```

Expected: no results (the only consumer was `entry.tsx`, already updated).

- [ ] **Step 2: Delete the file**

```bash
rm /Users/blaisetiong/Developer/projects/cms/pagescms/lib/preview.ts
```

- [ ] **Step 3: Final TypeScript check**

```bash
cd /Users/blaisetiong/Developer/projects/cms/pagescms && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove lib/preview.ts, replaced by lib/site.ts"
```

---

## `.pages.yml` config schema change (for users)

The preview feature now reads from a different config structure. Old:

```yaml
siteUrl: "https://mysite.com"
content:
  - name: posts
    previewPath: "/blog/preview"
```

New:

```yaml
settings:
  site:
    url: "https://mysite.com"
    preview:
      defaultOpen: true   # optional — auto-opens preview panel
content:
  - name: posts
    site:
      path: "/blog/{{slug}}"   # template resolved against live form values
```

The `site.path` template supports `{{slug}}`, `{{filename}}`, `{{basename}}`, and any field name from the schema. Values are slugified automatically.

---

## Self-Review

**Spec coverage check:**
- ✅ Dynamic URL building from config (`buildSiteUrl`) — Task 2
- ✅ Field-level bindings (`collectPreviewBindings`) — Task 2
- ✅ Bridge hello/ready handshake — Task 3
- ✅ 5-second bridge warning — Task 3
- ✅ 250ms debounce — Task 3
- ✅ Debug message passthrough — Task 3
- ✅ `defaultOpen` from config — Task 4 (Step 3)
- ✅ Remove old `cms:preview` message protocol — Task 4 (Step 5)
- ✅ Type definitions — Task 1
- ✅ Delete obsolete `lib/preview.ts` — Task 5

**Placeholder scan:** No TBD, TODO, or "similar to" placeholders found.

**Type consistency:** `PreviewRule`, `PreviewBind`, `PreviewTransform`, `PreviewTextTransform` defined in Task 1 and used in Task 2 (`lib/site.ts`). `EntryPreview` props (`fields`, `path`, `schema`, `values`) defined in Task 3 and passed in Task 4 with matching types.
