import { createHttpError } from "@/lib/api-error";
import { buildCommitTokens, resolveCommitMessage } from "@/lib/commit-message";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getParentPath } from "@/lib/utils/file";

type SaveFileOptions = {
  configObject?: Record<string, unknown>;
  templatesOverride?: Record<string, string>;
  contentName?: string;
  user?: string;
  onConflict?: "rename" | "error";
  committer?: { name: string; email: string };
};

const githubSaveFile = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  sha?: string,
  options?: SaveFileOptions,
) => {
  const octokit = createOctokitInstance(token, { retry: { doNotRetry: [409] } });

  const message = resolveCommitMessage({
    configObject: options?.configObject,
    templatesOverride: options?.templatesOverride,
    action: sha ? "update" : "create",
    tokens: buildCommitTokens({
      action: sha ? "update" : "create",
      owner,
      repo,
      branch,
      path,
      contentName: options?.contentName,
      user: options?.user,
      userName: options?.committer?.name,
      userEmail: options?.committer?.email,
    }),
  });

  try {
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentBase64,
      branch,
      sha: sha || undefined,
      committer: options?.committer,
    });

    if (response.data.content && response.data.commit) return response;
    throw new Error("Invalid response structure");
  } catch (error: unknown) {
    const err = error as { status?: number; response?: { data?: { message?: string } } };
    const githubMessage =
      typeof err.response?.data?.message === "string" ? err.response.data.message : undefined;

    if (err.status === 409) {
      if (githubMessage?.includes("Repository rule violations found")) {
        throw createHttpError(
          "This repository requires changes through a pull request. Save to a different branch or fork, or ask a maintainer to relax the repository rule for direct edits.",
          409,
        );
      }
      if (sha) {
        throw createHttpError(
          "File has changed since you last loaded it. Please refresh the page and try again.",
          409,
        );
      }
    }

    if (err.status === 422 && !sha) {
      if (options?.onConflict === "error") {
        throw createHttpError(`File "${path}" already exists.`, 409);
      }

      const parentDir = getParentPath(path);
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: parentDir || ".",
        ref: branch,
      });

      if (!Array.isArray(data)) throw new Error("Expected directory listing");

      const basename = path.split("/").pop() || "";
      const lastDotIndex = basename.lastIndexOf(".");
      const filename = lastDotIndex > 0 ? basename.slice(0, lastDotIndex) : basename;
      const extension = lastDotIndex > 0 ? basename.slice(lastDotIndex + 1) : "";
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = extension
        ? new RegExp(`^${escapeRegExp(filename)}-(\\d+)\\.${escapeRegExp(extension)}$`)
        : new RegExp(`^${escapeRegExp(filename)}-(\\d+)$`);
      const maxNumber = Math.max(
        0,
        ...data.map((file) => {
          const match = file.name.match(pattern);
          return match ? parseInt(match[1], 10) : 0;
        }),
      );

      for (let i = 1; i <= 3; i++) {
        const candidateFilename = extension
          ? `${filename}-${maxNumber + i}.${extension}`
          : `${filename}-${maxNumber + i}`;
        const newPath = `${parentDir ? `${parentDir}/` : ""}${candidateFilename}`;
        const fallbackMessage = resolveCommitMessage({
          configObject: options?.configObject,
          templatesOverride: options?.templatesOverride,
          action: "create",
          tokens: buildCommitTokens({
            action: "create",
            owner,
            repo,
            branch,
            path: newPath,
            contentName: options?.contentName,
            user: options?.user,
            userName: options?.committer?.name,
            userEmail: options?.committer?.email,
          }),
        });
        try {
          const response = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: newPath,
            message: fallbackMessage,
            content: contentBase64,
            branch,
            committer: options?.committer,
          });
          if (response.data.content && response.data.commit) return response;
        } catch (retryError: unknown) {
          const retry = retryError as { status?: number };
          if (i === 3 || retry.status !== 422) throw retryError;
        }
      }
    }
    throw error;
  }
};

const githubDeleteFile = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  sha: string,
  message: string,
  committer?: { name: string; email: string },
) => {
  const octokit = createOctokitInstance(token);
  return octokit.rest.repos.deleteFile({
    owner,
    repo,
    branch,
    path,
    sha,
    message,
    committer,
  });
};

const createProposeBranch = async (
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  headSha: string,
) => {
  const octokit = createOctokitInstance(token);
  const branchName = `gitcms-mcp/${Date.now()}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: headSha,
  });
  return branchName;
};

const openPullRequest = async (
  token: string,
  owner: string,
  repo: string,
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string,
) => {
  const octokit = createOctokitInstance(token);
  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head: headBranch,
    base: baseBranch,
  });
  return response.data;
};

export { createProposeBranch, githubDeleteFile, githubSaveFile, openPullRequest };
export type { SaveFileOptions };
