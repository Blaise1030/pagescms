"use client";

import { Fragment, useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context";
import { parseAndValidateConfig } from "@/lib/config";
import { resolveContentOperations } from "@/lib/operations";
import { requireApiSuccess } from "@/lib/api-client";
import { useEntryStore } from "@/app/(main)/[owner]/[repo]/[branch]/_hooks/use-entry-store";
import { getSchemaActions } from "@/lib/actions";
import {
  generateFilename,
  getPrimaryField,
  getSchemaByName,
  initializeState,
  safeAccess,
  sanitizeObject,
} from "@/lib/schema";
import type { Field } from "@/types/field";
import {
  getFileExtension,
  getFileName,
  getParentPath,
  getRelativePath,
  joinPathSegments,
  normalizePath
} from "@/lib/utils/file";
import type { ApiSuccess, EntryData, EntryHistoryItem } from "@/types/api";
import { EntryForm } from "./entry-form";
import { PreviewPanel } from "./preview-panel";
import { EntryHistoryBlock } from "./entry-history";
import { SaveStatus, type SaveStatusValue } from "./save-status";
import { DraftRestoreBanner } from "./draft-restore-banner";
import { EmptyCreate } from "@/components/empty-create";
import { FileOptions } from "@/app/(main)/[owner]/[repo]/[branch]/_components/file/file-options";
import { RepoActionButtons } from "@/app/(main)/[owner]/[repo]/[branch]/_components/repo/repo-action-buttons";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useRepoHeader } from "@/app/(main)/[owner]/[repo]/[branch]/_components/repo/repo-header-context";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner";
import { ArrowLeft, EllipsisVertical, Lock, LockOpen, Save } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useSidebarOptional } from "@/components/ui/sidebar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, usePanelRef } from "@/components/ui/resizable";
import { getPreviewUrl } from "@/lib/preview";

function toFormContentShape(
  contentObject: Record<string, unknown> | undefined,
  listSchema: boolean,
): Record<string, unknown> {
  if (!contentObject) return {};
  return listSchema ? { listWrapper: contentObject } : contentObject;
}

function normalizedFormSnapshot(
  fields: Field[],
  contentShape: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeObject(initializeState(fields, sanitizeObject(contentShape)));
}

function draftMatchesContent(
  fields: Field[],
  draft: Record<string, unknown>,
  contentObject: Record<string, unknown> | undefined,
  listSchema: boolean,
): boolean {
  const baseline = toFormContentShape(contentObject, listSchema);
  return (
    JSON.stringify(sanitizeObject(draft)) ===
    JSON.stringify(normalizedFormSnapshot(fields, baseline))
  );
}

type LintView = {
  state: {
    doc: {
      toString(): string;
    };
  };
};

type GroupTrailItem = {
  name: string;
  label?: string | null;
};

export function Entry({
  name = "",
  path: initialPath,
  parent,
  title,
  headerMeta,
  onSave,
}: {
  name?: string;
  path?: string;
  parent?: string;
  title?: string;
  headerMeta?: ReactNode;
  onSave?: (data: Record<string, unknown>) => void;
}) {
  const [path, setPath] = useState<string | undefined>(initialPath);
  const [entry, setEntry] = useState<EntryData | null>();
  const [sha, setSha] = useState<string | undefined>();
  const [displayTitle, setDisplayTitle] = useState<string>(() => {
    if (title) return title;
    if (initialPath && initialPath !== ".pages.yml") {
      return `Editing "${getFileName(normalizePath(initialPath))}"`;
    }
    return "Edit";
  });
  const [isLoading, setIsLoading] = useState(path ? true : false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftContent, setDraftContent] = useState<Record<string, unknown> | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [hasRegisteredChanges, setHasRegisteredChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "history">("content");
  const [error, setError] = useState<string | undefined | null>(null);
  const changeVersionRef = useRef(0);
  const queryClient = useQueryClient();

  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewFormValues, setPreviewFormValues] = useState<Record<string, unknown>>({});
  const previewFormValuesRef = useRef<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const previewPanelRef = usePanelRef();
  const editorPanelRef = usePanelRef();
  const sidebar = useSidebarOptional();

  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);
  
  const schema = useMemo(() => {
    if (!name) return;
    return getSchemaByName(config?.object, name)
  }, [config, name]);
  const schemaType = schema?.type;

  const createEntryMutation = useMutation({
    mutationFn: async ({ savePath, body }: { savePath: string; body: object }) => {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return requireApiSuccess<any>(response, "Failed to save file");
    },
    onSuccess: (data) => {
      if (data.data.sha) setSha(data.data.sha);
      if (schemaType === "collection") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
        });
      }
    },
  });

  const renameEntryMutation = useMutation({
    mutationFn: async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(fromPath)}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "content", name, newPath: toPath }),
        },
      );
      return requireApiSuccess<any>(response, "Failed to rename file");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
      });
    },
  });

  const {
    entry: storeEntry,
    hasDraft: storeHasDraft,
    isSaving: storeIsSaving,
    isLoading: storeIsLoading,
    error: storeError,
    save: storeSave,
    saveDraft,
    discard: storeDiscard,
    mutateEntry,
  } = useEntryStore(path, {
    config,
    name,
    schema,
    schemaType,
    onSave,
  });

  const saveStatus: SaveStatusValue = storeIsSaving ? "saving" : storeError ? "error" : "saved";

  const previewUrl = getPreviewUrl(
    config?.object?.siteUrl as string | undefined,
    schema?.previewPath as string | undefined,
  );

  useEffect(() => {
    if (!previewUrl) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("hideSidebar") === "true") return;
    url.searchParams.set("hideSidebar", "true");
    window.history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString());
  // ponytail: run once when previewUrl is determined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);
  const operations = useMemo(
    () =>
      resolveContentOperations({
        schema,
        scope:
          path === ".pages.yml" || initialPath === ".pages.yml"
            ? "settings"
            : undefined,
      }),
    [initialPath, path, schema],
  );
  const canCreate = operations.create;
  const canRename = operations.rename;
  const canDelete = operations.delete;
  const isFileEditorMode = !schema?.fields || schema.fields.length === 0;
  const filenameFieldMode = useMemo(() => {
    if (!schema || schema.type !== "collection") return "hidden";
    if (schema.filenameField === true) return "enabled";
    if (schema.filenameField === "create") return "create";
    if (schema.filenameField === false) return "hidden";
    return isFileEditorMode ? "enabled" : "hidden";
  }, [isFileEditorMode, schema]);
  const showFilenameField = useMemo(() => {
    if (schemaType !== "collection") return false;
    if (filenameFieldMode === "enabled") return true;
    if (filenameFieldMode === "create") return !path;
    return false;
  }, [filenameFieldMode, path, schemaType]);
  const [filenameValue, setFilenameValue] = useState("");
  const [isFilenameUnlocked, setIsFilenameUnlocked] = useState(false);
  
  const entryFields = useMemo(() => {
    return !schema?.fields || schema.fields.length === 0
      ? [{
          name: "body",
          type: "code",
          label: showFilenameField ? "Content" : false,
          options: {
            format: schema?.extension || (entry?.name && getFileExtension(entry.name)) || "markdown",
            lintFn: path === ".pages.yml"
              ? (view: LintView) => {
                  const {parseErrors, validationErrors} = parseAndValidateConfig(view.state.doc.toString());
                  return [...parseErrors, ...validationErrors];
                }
              : undefined
          }
        }]
      : schema?.list === true
        ? [{
            name: "listWrapper",
            label: false,
            type: "object",
            list: true,
            fields: schema.fields
          }]
        : schema.fields;
  }, [schema, entry, path, showFilenameField]);

  const entryContentObject = useMemo(() => {
    return path
      ? schema?.list === true
        ? { listWrapper: entry?.contentObject }
        : entry?.contentObject
      : schema?.list === true
        ? { listWrapper: [] }
        : {};
  }, [schema, entry, path]);

  useEffect(() => {
    if (!showFilenameField || schemaType !== "collection" || !schema) return;

    if (path) {
      setFilenameValue(getFileName(normalizePath(path)));
      setIsFilenameUnlocked(false);
      return;
    }

    const generated = generateFilename(schema.filename, schema, entryContentObject as Record<string, unknown>);
    setFilenameValue(generated || "untitled");
    setIsFilenameUnlocked(true);
  }, [entryContentObject, path, schema, schemaType, showFilenameField]);

  useEffect(() => {
    if (!storeEntry || !path) return;
    setEntry(storeEntry);
    setSha(storeEntry.sha);
    setHasRegisteredChanges(false);
    setIsLoading(false);
    setError(null);

    if (initialPath && schema && schema.type === "collection") {
      const primaryField = getPrimaryField(schema);
      const primaryValue = primaryField
        ? safeAccess(storeEntry.contentObject ?? {}, primaryField)
        : undefined;
      const hasPrimaryValue = typeof primaryValue === "string"
        ? primaryValue !== ""
        : primaryValue != null;
      const titleValue = hasPrimaryValue
        ? String(primaryValue)
        : getFileName(normalizePath(path));
      setDisplayTitle(`Editing "${titleValue}"`);
    } else if (!title && path && path !== ".pages.yml") {
      setDisplayTitle(`Editing "${getFileName(normalizePath(path))}"`);
    }
  }, [initialPath, path, schema, storeEntry, title]);

  useEffect(() => {
    setIsLoading(storeIsLoading);
  }, [storeIsLoading]);

  useEffect(() => {
    if (!storeError) return;
    setError(storeError.message);
    setIsLoading(false);
  }, [storeError]);

  useEffect(() => {
    if (storeHasDraft) {
      setShowDraftBanner(true);
    }
  }, [storeHasDraft]);

  const historyApiUrl = useMemo(() => (
    path
      ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path)}/history?name=${encodeURIComponent(name)}`
      : null
  ), [config.owner, config.repo, config.branch, path, name]);

  const historyEnabled = activeTab === "history" && !!path && !!historyApiUrl;

  const { data: historyData } = useQuery<EntryHistoryItem[]>({
    queryKey: historyEnabled
      ? [...queryKeys.entryHistory(config.owner, config.repo, config.branch, path!, name), sha ?? '']
      : ['entryHistory-disabled'],
    queryFn: async () => {
      const response = await fetch(historyApiUrl!);
      const data = await requireApiSuccess<any>(
        response,
        "Failed to fetch entry's history",
      );
      return data.data as EntryHistoryItem[];
    },
    enabled: historyEnabled,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  });

  const currentFilename = useMemo(
    () => path ? getFileName(normalizePath(path)) : "",
    [path],
  );
  const filenameChanged = showFilenameField
    && filenameValue.trim().length > 0
    && filenameValue.trim() !== currentFilename;

  const executeSave = useCallback(
    async (contentObject: Record<string, unknown>, savePath: string) => {
      try {
        const result = await storeSave(contentObject, savePath);
        if (result.sha) setSha(result.sha);
        setHasRegisteredChanges(false);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to save file.";
        toast.error(message, {
          duration: Infinity,
          action: {
            label: "Retry",
            onClick: () => void executeSave(contentObject, savePath),
          },
        });
      }
    },
    [setHasRegisteredChanges, storeSave],
  );

  const onSubmit = async (contentObject: Record<string, unknown>) => {
    if (!path) {
      setIsSaving(true);
      const submitStartChangeVersion = changeVersionRef.current;

      const savePromise = new Promise<ApiSuccess<EntryData>>(async (resolve, reject) => {
        try {
          if (!schema) throw new Error("Cannot create entry without schema.");
          if (!canCreate) throw new Error("Creating entries in this content item isn't allowed.");
          const basePath = parent ?? schema.path;
          if (basePath == null) throw new Error("Cannot create entry without a target path.");
          const trimmedFilename = filenameValue.trim();
          const normalizedFilename = normalizePath(trimmedFilename).split("/").pop() || "";
          if (showFilenameField && !normalizedFilename) throw new Error("Filename is required.");
          const generatedFilename = showFilenameField
            ? normalizedFilename
            : generateFilename(schema.filename, schema, contentObject);
          const savePath = joinPathSegments([basePath, generatedFilename]);

          const data = await createEntryMutation.mutateAsync({
            savePath,
            body: {
              type: "content",
              name,
              content: schema?.list === true ? contentObject.listWrapper : contentObject,
              sha: undefined,
            },
          });
          if (schemaType === "collection") {
            router.push(
              `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(data.data.path)}`
            );
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });

      toast.promise(savePromise, {
        loading: "Creating file…",
        success: (response: ApiSuccess<EntryData>) => {
          if (onSave) onSave(response.data);
          return response.message;
        },
        error: (error: unknown) =>
          error instanceof Error ? error.message : "Failed to create file.",
      });

      try {
        await savePromise;
        if (submitStartChangeVersion === changeVersionRef.current) {
          setHasRegisteredChanges(false);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    let savePath = path;
    const trimmedFilename = filenameValue.trim();
    const normalizedFilename = normalizePath(trimmedFilename).split("/").pop() || "";

    if (
      showFilenameField &&
      filenameFieldMode === "enabled" &&
      isFilenameUnlocked &&
      filenameChanged &&
      schemaType === "collection"
    ) {
      if (!canRename) throw new Error("Renaming this entry isn't allowed.");
      const newPath = joinPathSegments([getParentPath(savePath), normalizedFilename]);
      await renameEntryMutation.mutateAsync({ fromPath: savePath, toPath: newPath });
      savePath = newPath;
      setPath(newPath);
      setIsFilenameUnlocked(false);
      router.replace(
        `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(newPath)}`
      );
    }

    void executeSave(contentObject, savePath);
  };

  const isBusy = isLoading || isSaving || storeIsSaving;

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s") return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey) return;

      event.preventDefault();
      if (isBusy) return;

      const form = document.getElementById("entry-form");
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [isBusy]);

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

  const handleValuesChange = useCallback((values: Record<string, unknown>) => {
    previewFormValuesRef.current = values;
    setPreviewFormValues(values);
  }, []);

  const handleDraftChange = useCallback(async (content: Record<string, unknown>) => {
    if (
      draftMatchesContent(
        entryFields,
        content,
        entry?.contentObject,
        schema?.list === true,
      )
    ) {
      await storeDiscard();
    } else {
      saveDraft(content);
      setDraftContent(content);
      setShowDraftBanner(true);
    }
  }, [entryFields, entry?.contentObject, schema?.list, storeDiscard, saveDraft]);

  const handleDelete = useCallback((path: string) => {
    // TODO: disable save button or freeze form while deleting?
    if (schemaType === "collection") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
      });
    }
    if (schemaType === "collection") {
      router.push(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`);
    } else {
      void mutateEntry();
    }
  }, [config.branch, config.owner, config.repo, queryClient, mutateEntry, name, router, schemaType]);

  const handleRename = useCallback((oldPath: string, newPath: string) => {
    if (schemaType === "collection") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
      });
    }
    void mutateEntry();
    setPath(newPath);
    router.replace(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(newPath)}`);
  }, [config.branch, config.owner, config.repo, queryClient, mutateEntry, name, router, schemaType]);

  const breadcrumbNode = useMemo(() => {
    if (!schema) {
      return <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>;
    }

    const groupTrail: GroupTrailItem[] = Array.isArray(schema.groupTrail)
      ? schema.groupTrail
      : [];

    if (schemaType !== "collection") {
      return (
        <>
          {groupTrail.map((group) => (
            <Fragment key={`group-${group.name}`}>
              <BreadcrumbItem>
                <span>{group.label || group.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem className="truncate">
            <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }

    const rootLabel = schema.label || schema.name || name;

    if (!path) {
      return (
        <>
          {groupTrail.map((group) => (
            <Fragment key={`group-${group.name}`}>
              <BreadcrumbItem>
                <span>{group.label || group.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}>
                {rootLabel}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate">
            <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }

    const rootPath = normalizePath(schema.path);
    const parentPath = normalizePath(getParentPath(path));
    const relativePath = getRelativePath(parentPath, rootPath);
    const segments = relativePath ? relativePath.split("/").filter(Boolean) : [];

    const parentEntries = segments.map((segment, index) => ({
      name: segment,
      path: joinPathSegments([rootPath, segments.slice(0, index + 1).join("/")]),
    }));

    const immediateParent = parentEntries.length > 0 ? parentEntries[parentEntries.length - 1] : null;
    const middleEntries = parentEntries.length > 1 ? parentEntries.slice(0, -1) : [];

    return (
      <>
        {groupTrail.map((group) => (
          <Fragment key={`group-${group.name}`}>
            <BreadcrumbItem>
              <span>{group.label || group.name}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}>
              {rootLabel}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {middleEntries.length > 0 && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center">
                  <BreadcrumbEllipsis className="h-4 w-4" />
                  <span className="sr-only">Show hidden segments</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {middleEntries.map((entry) => (
                    <DropdownMenuItem key={entry.path} asChild>
                      <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}?path=${encodeURIComponent(entry.path)}`}>
                        {entry.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {immediateParent && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}?path=${encodeURIComponent(immediateParent.path)}`}>
                  {immediateParent.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        <BreadcrumbItem className="truncate">
          <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }, [config.branch, config.owner, config.repo, displayTitle, name, path, schema, schemaType]);
  const isCreationBlocked = !path && schemaType === "collection" && !canCreate;
  const showHeaderActions = error !== "Not found" && !isCreationBlocked;
  const headerActionsNode = useMemo(() => {
    if (!schema || !path) return null;

    if (schemaType === "file") {
      const fileActions = getSchemaActions(schema);
      if (fileActions.length === 0) return null;

      return (
        <RepoActionButtons
          actions={fileActions}
          owner={config.owner}
          repo={config.repo}
          refName={config.branch}
          contextType="file"
          contextName={schema.name}
          contextPath={path}
          contextData={{
            label: schema.label || schema.name,
            sha: sha ?? null,
            content: entry?.contentObject ?? null,
          }}
        />
      );
    }

    if (schemaType === "collection" && entry) {
      const entryActions = getSchemaActions(schema, "entry");
      if (entryActions.length === 0) return null;

      return (
        <RepoActionButtons
          actions={entryActions}
          owner={config.owner}
          repo={config.repo}
          refName={config.branch}
          contextType="entry"
          contextName={schema.name}
          contextPath={path}
          contextData={{
            label: schema.label || schema.name,
            entryName: entry.name ?? null,
            sha: sha ?? null,
            content: entry.contentObject ?? null,
          }}
        />
      );
    }

    return null;
  }, [config.branch, config.owner, config.repo, entry, path, schema, schemaType, sha]);

  const headerNode = useMemo(() => (
    <div className="flex min-w-0 items-center gap-2">
      {previewUrl && (
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="min-w-0 flex-nowrap">
            {breadcrumbNode}
          </BreadcrumbList>
        </Breadcrumb>
        {headerMeta}
      </div>
      {showHeaderActions && (
        <div className="flex shrink-0 items-center gap-x-2">
          {headerActionsNode}
          {path && activeTab === "content" && <SaveStatus status={saveStatus} />}
          {activeTab === "content" && (
            <Button
              type="submit"
              form="entry-form"
              disabled={
                isBusy ||
                (showFilenameField && filenameValue.trim().length === 0) ||
                (
                  Boolean(path) &&
                  !(
                    isFormDirty
                    || hasRegisteredChanges
                    || (
                      showFilenameField
                      && filenameFieldMode === "enabled"
                      && isFilenameUnlocked
                      && filenameChanged
                    )
                  )
                )
              }
              aria-label="Save"
            >
              <Save className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}
          {path && (
            <ButtonGroup>
              {sha
                ? (
                  <FileOptions
                    path={path}
                    sha={sha}
                    type={path === ".pages.yml" ? "settings" : (schemaType ?? "content")}
                    name={name}
                    canDelete={canDelete}
                    canRename={canRename}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  >
                    <Button variant="outline" size="icon" disabled={isBusy}>
                      <EllipsisVertical />
                    </Button>
                  </FileOptions>
                )
                : <Button variant="outline" size="icon" disabled><EllipsisVertical /></Button>
              }
            </ButtonGroup>
          )}
        </div>
      )}
    </div>
  ), [activeTab, breadcrumbNode, canDelete, canRename, filenameChanged, filenameFieldMode, filenameValue, handleDelete, handleRename, hasRegisteredChanges, headerActionsNode, headerMeta, isBusy, isFilenameUnlocked, isFormDirty, name, path, previewUrl, router, saveStatus, schemaType, sha, showEditor, showFilenameField, showHeaderActions, showPreview]);

  useRepoHeader({ header: headerNode });

  const loadingSkeleton = useMemo(() => (
    <div className="w-full grid items-start gap-6 px-2 py-3 pr-4">
      {path !== ".pages.yml"
        ? 
          <>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <div className="grid grid-flow-col auto-cols-max gap-6">
                <Skeleton className="w-28 h-28 rounded-md" />
                <Skeleton className="w-28 h-28 rounded-md" />
                <Skeleton className="w-28 h-28 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-60 rounded-md" />
            </div>
          </>
        : <Skeleton className="w-full h-96 rounded-md" />
      }
    </div>
  ), [path]);

  
  if (error) {
    // TODO: should we use a custom error class with code?
    // TODO: errors show no header (unlike collection and media). Consider standardizing templates.
    if (error === "Not found") {
      const isSettingsPage = path === ".pages.yml";
      return (
        <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
          <Empty className="max-w-[420px] flex-none">
            <EmptyHeader>
              <EmptyTitle>{isSettingsPage ? "Configuration not found" : "File not found"}</EmptyTitle>
              <EmptyDescription>
                {isSettingsPage
                  ? "The configuration file \".pages.yml\" does not exist yet."
                  : `The file "${path ?? schema?.path ?? "unknown"}" does not exist yet.`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {isSettingsPage ? (
                <EmptyCreate type="settings">Create configuration file</EmptyCreate>
              ) : canCreate ? (
                <EmptyCreate type="content" name={schema?.name ?? name}>Create file</EmptyCreate>
              ) : null}
            </EmptyContent>
          </Empty>
        </div>
      );
    } else {
      return (
        <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
          <Empty className="max-w-[420px] flex-none">
            <EmptyHeader>
              <EmptyTitle>Something went wrong</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
                href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/configuration`}
              >
                Go to configuration
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      );
    }
  }

  if (!path && schemaType === "collection" && !canCreate) {
    return (
      <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
        <Empty className="max-w-[420px] flex-none">
          <EmptyHeader>
            <EmptyTitle>Creating entries is disabled</EmptyTitle>
            <EmptyDescription>
              New entries are not allowed for this collection.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
              href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}
            >
              Back to collection
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }
  
  const handleTabChange = (tab: "content" | "history") => {
    setActiveTab(tab);
  };

  const editorContent = (
    <div className="w-full flex flex-col items-start gap-6 px-2 py-3 pr-4">
      {path && (
        <div className="w-full max-w-screen-md mx-auto flex gap-1">
          <Button
            type="button"
            variant={activeTab === "content" ? "secondary" : "ghost"}
            className={activeTab === "content" ? "border" : ""}
            size="sm"
            onClick={() => handleTabChange("content")}
          >
            Content
          </Button>
          <Button
            type="button"
            variant={activeTab === "history" ? "secondary" : "ghost"}
            className={activeTab === "history" ? "border" : ""}
            size="sm"
            onClick={() => handleTabChange("history")}
          >
            History
          </Button>
        </div>
      )}
      {activeTab === "history" && path ? (
        <div className="w-full max-w-screen-md mx-auto">
          {historyData && historyData.length > 0
            ? <EntryHistoryBlock path={path} history={historyData} />
            : <p className="text-sm text-muted-foreground">Loading history…</p>}
        </div>
      ) : (
        <>
          {showDraftBanner && draftContent && (
            <div className="w-full max-w-screen-md mx-auto">
            <DraftRestoreBanner
              onRestore={() => {
                setEntry((prev) => prev ? { ...prev, contentObject: draftContent } : prev);
                setShowDraftBanner(false);
              }}
              onDiscard={async () => {
                await storeDiscard();
                setDraftContent(null);
                setShowDraftBanner(false);
              }}
            />
            </div>
          )}
          <EntryForm
            fields={entryFields}
            contentObject={entryContentObject}
            onSubmit={onSubmit}
            filePath={
              showFilenameField
                ? <InputGroup data-disabled={path ? !isFilenameUnlocked : false}>
                    <InputGroupInput
                      value={filenameValue}
                      onChange={(event) => setFilenameValue(event.target.value)}
                      placeholder="Filename"
                      disabled={path ? !isFilenameUnlocked : false}
                      aria-label="Filename"
                    />
                    {path && filenameFieldMode === "enabled" && canRename && (
                      <InputGroupAddon align="inline-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InputGroupButton
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setIsFilenameUnlocked((prev) => !prev)}
                              aria-label={isFilenameUnlocked ? "Lock filename" : "Unlock filename"}
                            >
                              {isFilenameUnlocked
                                ? <LockOpen className="size-3.5" />
                                : <Lock className="size-3.5" />}
                            </InputGroupButton>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isFilenameUnlocked ? "Lock filename" : "Unlock to edit"}
                          </TooltipContent>
                        </Tooltip>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                : undefined
            }
            onDirtyChange={setIsFormDirty}
            onChangeRegistered={() => {
              changeVersionRef.current += 1;
              setHasRegisteredChanges(true);
            }}
            onDraftChange={path ? handleDraftChange : undefined}
            onValuesChange={previewUrl ? handleValuesChange : undefined}
          />
        </>
      )}
    </div>
  );

  return (
    isLoading
      ? loadingSkeleton
      : previewUrl
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
        : editorContent
  );
};
