import { clearFileCache, updateMultipleFilesCache } from "@/lib/github-cache-file";
import { deleteCacheFileMeta } from "@/lib/github-cache-meta";
import { clearScopedFileCache } from "@/lib/github-webhook-installation";

type WebhookChanges = {
  added: string[];
  modified: string[];
  removed: string[];
};

type WebhookInvalidateOptions = {
  token: string;
  commit?: { sha: string; timestamp: number };
};

const invalidate = async (
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<void> => {
  await clearScopedFileCache(owner, repo, branch, [path]);
};

const invalidateBranch = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<void> => {
  await clearFileCache(owner, repo, branch);
  await deleteCacheFileMeta(owner, repo, branch);
};

const invalidateScoped = async (
  owner: string,
  repo: string,
  branch: string,
  paths: string[],
): Promise<void> => {
  await clearScopedFileCache(owner, repo, branch, paths);
};

const invalidateByWebhook = async (
  owner: string,
  repo: string,
  branch: string,
  changes: WebhookChanges,
  options: WebhookInvalidateOptions,
): Promise<void> => {
  const removedFiles = changes.removed.map((path) => ({ path }));
  const modifiedFiles = changes.modified.map((path) => ({
    path,
    sha: options.commit?.sha ?? "",
  }));
  const addedFiles = changes.added.map((path) => ({
    path,
    sha: options.commit?.sha ?? "",
  }));

  await updateMultipleFilesCache(
    owner,
    repo,
    branch,
    removedFiles,
    modifiedFiles,
    addedFiles,
    options.token,
    options.commit,
  );
};

export const ContentCache = {
  invalidate,
  invalidateBranch,
  invalidateScoped,
  invalidateByWebhook,
};
export type { WebhookChanges, WebhookInvalidateOptions };
