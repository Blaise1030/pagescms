"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfig } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context";
import { getRelativePath, joinPathSegments, normalizePath } from "@/lib/utils/file";
import { getSchemaByName } from "@/lib/schema";
import { requireApiSuccess } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function FileRename({
  isOpen,
  onOpenChange,
  path,
  type,
  sha,
  name,
  onRename
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  type: "collection" | "file" | "media" | "settings";
  sha: string;
  name?: string;
  onRename?: (path: string, newPath: string) => void;
}) {
  const { config } = useConfig();
  const queryClient = useQueryClient();
  if (!config) throw new Error(`Configuration not found.`);

  if (!name) throw new Error("Name is required for FileRename");

  const schema = getSchemaByName(config.object, name, type);
  if (!schema) throw new Error(`Schema not found for ${name}.`);

  const rootPath = useMemo(() => type === "media" ? schema.input : schema.path, [type, schema.input, schema.path]);
  const normalizedPath = useMemo(() => normalizePath(path), [path]);
  const relativePath = useMemo(() => getRelativePath(normalizedPath, rootPath), [normalizedPath, rootPath]);

  const [newRelativePath, setNewRelativePath] = useState(relativePath);

  const renameMutation = useMutation({
    mutationFn: async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(fromPath)}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: (type === "collection" || type === "file") ? "content" : type,
            name,
            newPath: toPath,
          }),
        }
      );
      return requireApiSuccess<any>(response, "Failed to rename file");
    },
    onSuccess: (_data, { toPath }) => {
      if (type === "media" && name) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.mediaAll(config.owner, config.repo, config.branch, name) });
      } else if (name) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.collectionAll(config.owner, config.repo, config.branch, name) });
      }
      if (onRename) onRename(path, toPath);
      onOpenChange(false);
    },
  });

  const handleRename = async () => {
    try {
      const newPath = joinPathSegments([rootPath, normalizePath(newRelativePath)]);

      const renamePromise = renameMutation.mutateAsync({ fromPath: normalizedPath, toPath: newPath });

      toast.promise(renamePromise, {
        loading: `Renaming "${path}" to "${newPath}"`,
        success: (data: any) => data.message,
        error: (error: any) => error.message,
      });
    } catch (error) {
      console.error(error);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <Input
          defaultValue={relativePath}
          onChange={(e) => setNewRelativePath(e.target.value)}
        />
        <DialogFooter className="max-sm:gap-y-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={handleRename}>Rename</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
