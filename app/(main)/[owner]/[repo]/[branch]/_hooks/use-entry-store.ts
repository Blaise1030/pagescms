"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  idbCacheKey,
  getFileDraft,
  setFileDraft,
  deleteFileDraft,
} from "@/lib/idb";
import { queryKeys } from "@/lib/query-keys";
import { requireApiSuccess } from "@/lib/api-client";
import type { Config } from "@/types/config";
import type { EntryData } from "@/types/api";

type UseEntryStoreOptions = {
  config: Config;
  name: string;
  schema?: Record<string, unknown> | null;
  schemaType?: string;
  onSave?: (data: Record<string, unknown>) => void;
};

type UseEntryStoreReturn = {
  entry: EntryData | null | undefined;
  hasDraft: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: Error | null;
  save: (contentObject: Record<string, unknown>, savePath: string) => Promise<{ path: string; sha: string }>;
  saveDraft: (values: Record<string, unknown>) => void;
  discard: () => Promise<void>;
  mutateEntry: () => void;
};

export function useEntryStore(
  path: string | undefined,
  { config, name, schema, schemaType, onSave }: UseEntryStoreOptions,
): UseEntryStoreReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const shaRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);
  const pendingFlushRef = useRef<Record<string, unknown> | null>(null);
  const saveRef = useRef<
    (contentObject: Record<string, unknown>, savePath: string) => Promise<{ path: string; sha: string }>
  >();
  const queryClient = useQueryClient();

  const entryKey = useMemo(
    () => path ? queryKeys.entry(config.owner, config.repo, config.branch, path, name) : null,
    [config.owner, config.repo, config.branch, path, name],
  );

  const {
    data: entry,
    error: queryError,
    isLoading,
  } = useQuery<EntryData>({
    queryKey: entryKey ?? ['entry-disabled'],
    queryFn: async () => {
      const url = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path!)}?name=${encodeURIComponent(name)}`;
      const response = await fetch(url);
      const data = await requireApiSuccess<{ data: EntryData }>(response, "Failed to fetch entry");
      const result = data.data as EntryData;

      if (result.sha) shaRef.current = result.sha;
      return result;
    },
    enabled: !!path,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!path || !entry?.contentObject) return;
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    void getFileDraft(key).then((draft) => {
      if (draft) setHasDraft(true);
    });
  }, [config.owner, config.repo, config.branch, entry?.contentObject, path]);

  const mutateEntry = useCallback(() => {
    if (!entryKey) return;
    void queryClient.invalidateQueries({ queryKey: entryKey });
  }, [queryClient, entryKey]);

  const saveDraft = useCallback((values: Record<string, unknown>) => {
    if (!path) return;
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    setHasDraft(true);
    void setFileDraft(key, values);
  }, [config, path]);

  const save = useCallback(async (
    contentObject: Record<string, unknown>,
    savePath: string,
  ): Promise<{ path: string; sha: string }> => {
    if (inFlightRef.current) {
      pendingFlushRef.current = contentObject;
      return { path: savePath, sha: shaRef.current ?? "" };
    }

    inFlightRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: savePath === ".pages.yml" ? "settings" : "content",
            name,
            content: schema && typeof schema === "object" && "list" in schema && schema.list === true
              ? (contentObject as { listWrapper?: unknown }).listWrapper
              : contentObject,
            sha: shaRef.current,
          }),
        },
      );
      const data = await requireApiSuccess<{ data: { path: string; sha: string } & Record<string, unknown> }>(
        response,
        "Failed to save file",
      );
      const result = { path: data.data.path, sha: data.data.sha };

      shaRef.current = data.data.sha;

      if (entryKey) {
        queryClient.setQueryData<EntryData>(entryKey, (prev) =>
          prev ? { ...prev, contentObject, sha: data.data.sha } : prev,
        );
      }

      if (schemaType === "collection") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name),
        });
      }

      if (path) {
        const key = idbCacheKey(config.owner, config.repo, config.branch, path);
        await deleteFileDraft(key);
        setHasDraft(false);
      }

      if (onSave) onSave(data.data);

      const pending = pendingFlushRef.current;
      pendingFlushRef.current = null;
      if (pending) {
        inFlightRef.current = false;
        return saveRef.current!(pending, savePath);
      }

      inFlightRef.current = false;
      setIsSaving(false);
      return result;
    } catch (err) {
      inFlightRef.current = false;
      setIsSaving(false);
      const e = err instanceof Error ? err : new Error("Failed to save file.");
      setError(e);
      throw e;
    }
  }, [config, name, path, schema, schemaType, onSave, queryClient, entryKey]);

  saveRef.current = save;

  const discard = useCallback(async () => {
    if (!path) return;
    const key = idbCacheKey(config.owner, config.repo, config.branch, path);
    await deleteFileDraft(key);
    setHasDraft(false);
  }, [config, path]);

  return {
    entry: entry ?? null,
    hasDraft,
    isSaving,
    isLoading: isLoading && !!path,
    error: error ?? (queryError instanceof Error ? queryError : null),
    save,
    saveDraft,
    discard,
    mutateEntry,
  };
}
