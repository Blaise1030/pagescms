"use client";

import { createContext, useContext, useMemo } from "react";
import { useConfig } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context";
import { getSchemaByName, getPrimaryField } from "@/lib/schema";
import { resolveContentOperations } from "@/lib/operations";
import { getSchemaActions, type RepoActionConfig } from "@/lib/actions";

type ContentOperations = { create: boolean; rename: boolean; delete: boolean };

type CollectionState = {
  schema: Record<string, unknown> | undefined;
  operations: ContentOperations;
  actions: RepoActionConfig[];
  primaryField: string | undefined;
};

const CollectionContext = createContext<CollectionState | null>(null);

export function CollectionProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const { config } = useConfig();

  const value = useMemo<CollectionState>(() => {
    const schema = config ? getSchemaByName(config.object, name) : undefined;
    const operations = resolveContentOperations({ schema });
    const actions = schema ? getSchemaActions(schema, "collection") : [];
    const primaryField = schema ? getPrimaryField(schema) : undefined;
    return { schema, operations, actions, primaryField };
  }, [config, name]);

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection(): CollectionState {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollection must be used inside CollectionProvider");
  return ctx;
}
