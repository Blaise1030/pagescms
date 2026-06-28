import { getCodec } from "@/app/(main)/[owner]/[repo]/[branch]/_fields/registry";
import { createHttpError } from "@/lib/api-error";
import { buildCommitTokens, resolveCommitIdentity, resolveCommitMessage } from "@/lib/commit-message";
import { decodeBase64Utf8, encodeUtf8Base64 } from "@/lib/encoding";
import {
  createProposeBranch,
  githubDeleteFile,
  githubSaveFile,
  openPullRequest,
} from "@/lib/github-file-ops";
import { updateFileCache } from "@/lib/github-cache-file";
import { isContentOperationAllowed } from "@/lib/operations";
import { deepMap, generateZodSchema, getSchemaByName, sanitizeObject } from "@/lib/schema";
import { parse, stringify } from "@/lib/serialization";
import { getFileExtension, getFileName, getParentPath, normalizePath, serializedTypes } from "@/lib/utils/file";
import { createOctokitInstance } from "@/lib/utils/octokit";
import type { Config } from "@/types/config";
import type { User } from "@/types/user";
import type { Field } from "@/types/field";
import mergeWith from "lodash.mergewith";

type WriteMode = "commit" | "propose";

type WriteEntryInput = {
  name: string;
  path: string;
  content: Record<string, unknown>;
  sha?: string;
  onConflict?: "error" | "rename";
  mode?: WriteMode;
};

type WriteEntryResult = {
  path: string;
  sha: string;
  commitSha: string;
  pullRequestUrl?: string;
};

type DeleteEntryInput = {
  name: string;
  path: string;
  sha: string;
  mode?: WriteMode;
};

const resolveCommitter = (
  user: User,
  configObject: Record<string, unknown>,
  schemaCommitIdentity?: "app" | "user",
) => {
  const commitIdentity = resolveCommitIdentity({
    configObject,
    identityOverride: schemaCommitIdentity,
  });
  if (commitIdentity === "user" && user.email) {
    return { name: user.name?.trim() || user.email, email: user.email };
  }
  return undefined;
};

const formatValidationErrors = (issues: { message: string; path: (string | number)[] }[]) =>
  issues
    .map((issue) => {
      let message = issue.message;
      if (issue.path.length > 0) message = `${message} at ${issue.path.join(".")}`;
      return message;
    })
    .join(", ");

const prepareContentBase64 = async (
  schema: Record<string, unknown>,
  config: Config,
  content: Record<string, unknown>,
  sha: string | undefined,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token: string,
): Promise<string> => {
  if (getFileName(path) === ".gitkeep") return "";

  const fields = schema.fields as Field[] | undefined;
  if (!serializedTypes.includes(schema.format as string) || !fields) {
    return encodeUtf8Base64(String((content as { body?: string }).body ?? ""));
  }

  let contentFields: Field[];
  let contentObject: Record<string, unknown>;

  if (schema.list) {
    contentObject = { listWrapper: content };
    contentFields = [{ name: "listWrapper", type: "object", list: true, fields }];
  } else {
    contentObject = content;
    contentFields = fields;
  }

  const zodSchema = generateZodSchema(contentFields);
  const zodValidation = zodSchema.safeParse(contentObject);
  if (!zodValidation.success) {
    throw createHttpError(
      `Content validation failed: ${formatValidationErrors(zodValidation.error.issues)}`,
      400,
    );
  }

  const validatedContentObject = deepMap(
    zodValidation.data as Record<string, unknown>,
    contentFields,
    (value, field) => {
      const write = getCodec(field.type as string)?.write;
      return write ? write(value, field, config.object) : value;
    },
  );

  const unwrapped = schema.list
    ? (validatedContentObject as Record<string, unknown>).listWrapper
    : validatedContentObject;

  let finalContentObject = JSON.parse(JSON.stringify(unwrapped)) as Record<string, unknown>;

  if (config.object?.settings?.content?.merge && sha && !schema.list) {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (!Array.isArray(response.data) && response.data.type === "file") {
      const existingContent = decodeBase64Utf8(response.data.content);
      const existingContentObject = parse(existingContent, {
        format: schema.format as string,
        delimiters: schema.delimiters as string | undefined,
      });
      finalContentObject = mergeWith({}, existingContentObject, unwrapped, (_obj, src) =>
        Array.isArray(src) ? src : undefined,
      );
    }
  }

  const stringified = stringify(sanitizeObject(finalContentObject), {
    format: schema.format as string,
    delimiters: schema.delimiters as string | undefined,
  });
  return encodeUtf8Base64(stringified);
};

const resolveWriteBranch = async (
  mode: WriteMode,
  token: string,
  owner: string,
  repo: string,
  branch: string,
) => {
  if (mode === "commit") return { branch, proposeBranch: undefined as string | undefined };

  const octokit = createOctokitInstance(token);
  const ref = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const proposeBranch = await createProposeBranch(token, owner, repo, branch, ref.data.object.sha);
  return { branch: proposeBranch, proposeBranch };
};

const writeContentEntry = async (
  ctx: {
    user: User;
    token: string;
    config: Config;
    owner: string;
    repo: string;
    branch: string;
  },
  input: WriteEntryInput,
): Promise<WriteEntryResult> => {
  const schema = getSchemaByName(ctx.config.object, input.name);
  if (!schema) throw createHttpError(`Content schema not found for ${input.name}.`, 404);
  if (!input.sha && !isContentOperationAllowed("create", { schema })) {
    throw createHttpError(`Creating entries isn't allowed for "${input.name}".`, 403);
  }

  const normalizedPath = normalizePath(input.path);
  if (!normalizedPath.startsWith(schema.path)) {
    throw createHttpError(`Invalid path "${input.path}" for "${input.name}".`, 400);
  }
  if (schema.subfolders === false && getParentPath(normalizedPath) !== schema.path) {
    throw createHttpError(`Subfolders are not allowed for collection "${input.name}".`, 400);
  }
  if (
    getFileName(normalizedPath) !== ".gitkeep" &&
    getFileExtension(normalizedPath) !== (schema.extension ?? "")
  ) {
    throw createHttpError(`Invalid extension for "${input.name}".`, 400);
  }

  const mode = input.mode ?? "propose";
  const onConflict = input.onConflict === "error" ? "error" : "rename";
  const contentBase64 = await prepareContentBase64(
    schema,
    ctx.config,
    input.content,
    input.sha,
    ctx.owner,
    ctx.repo,
    ctx.branch,
    normalizedPath,
    ctx.token,
  );

  const committer = resolveCommitter(ctx.user, ctx.config.object, schema.commit?.identity);
  const { branch: targetBranch, proposeBranch } = await resolveWriteBranch(
    mode,
    ctx.token,
    ctx.owner,
    ctx.repo,
    ctx.branch,
  );

  const response = await githubSaveFile(
    ctx.token,
    ctx.owner,
    ctx.repo,
    targetBranch,
    normalizedPath,
    contentBase64,
    input.sha,
    {
      configObject: ctx.config.object,
      templatesOverride: schema.commit?.templates,
      contentName: input.name,
      user: ctx.user.email || ctx.user.name || String(ctx.user.id),
      onConflict,
      committer,
    },
  );

  const savedPath = response.data.content?.path ?? normalizedPath;
  const commitSha = response.data.commit?.sha ?? "";

  await updateFileCache("collection", ctx.owner, ctx.repo, ctx.branch, {
    type: input.sha ? "modify" : "add",
    path: savedPath,
    sha: response.data.content?.sha ?? "",
    content: decodeBase64Utf8(contentBase64),
    size: response.data.content?.size,
    downloadUrl: response.data.content?.download_url ?? undefined,
    commit: {
      sha: commitSha,
      timestamp: new Date(response.data.commit?.committer?.date ?? Date.now()).getTime(),
    },
  }).catch(() => {});

  let pullRequestUrl: string | undefined;
  if (proposeBranch) {
    const pr = await openPullRequest(
      ctx.token,
      ctx.owner,
      ctx.repo,
      proposeBranch,
      ctx.branch,
      resolveCommitMessage({
        configObject: ctx.config.object,
        templatesOverride: schema.commit?.templates,
        action: input.sha ? "update" : "create",
        tokens: buildCommitTokens({
          action: input.sha ? "update" : "create",
          owner: ctx.owner,
          repo: ctx.repo,
          branch: ctx.branch,
          path: savedPath,
          contentName: input.name,
          user: ctx.user.email || ctx.user.name || String(ctx.user.id),
        }),
      }),
      "Via: gitcms-mcp",
    );
    pullRequestUrl = pr.html_url;
  }

  return {
    path: savedPath,
    sha: response.data.content?.sha ?? "",
    commitSha,
    pullRequestUrl,
  };
};

const deleteContentEntry = async (
  ctx: {
    user: User;
    token: string;
    config: Config;
    owner: string;
    repo: string;
    branch: string;
  },
  input: DeleteEntryInput,
): Promise<{ commitSha: string; pullRequestUrl?: string }> => {
  const schema = getSchemaByName(ctx.config.object, input.name);
  if (!schema) throw createHttpError(`Content schema not found for ${input.name}.`, 404);
  if (!isContentOperationAllowed("delete", { schema })) {
    throw createHttpError(`Deleting entries isn't allowed for "${input.name}".`, 403);
  }

  const normalizedPath = normalizePath(input.path);
  const committer = resolveCommitter(ctx.user, ctx.config.object, schema.commit?.identity);
  const mode = input.mode ?? "propose";
  const { branch: targetBranch, proposeBranch } = await resolveWriteBranch(
    mode,
    ctx.token,
    ctx.owner,
    ctx.repo,
    ctx.branch,
  );

  const message = resolveCommitMessage({
    configObject: ctx.config.object,
    templatesOverride: schema.commit?.templates,
    action: "delete",
    tokens: buildCommitTokens({
      action: "delete",
      owner: ctx.owner,
      repo: ctx.repo,
      branch: ctx.branch,
      path: normalizedPath,
      contentName: input.name,
      user: ctx.user.email || ctx.user.name || String(ctx.user.id),
      userName: committer?.name,
      userEmail: committer?.email,
    }),
  });

  const response = await githubDeleteFile(
    ctx.token,
    ctx.owner,
    ctx.repo,
    targetBranch,
    normalizedPath,
    input.sha,
    message,
    committer,
  );

  await updateFileCache("collection", ctx.owner, ctx.repo, ctx.branch, {
    type: "delete",
    path: normalizedPath,
    commit: response.data.commit?.sha
      ? {
          sha: response.data.commit.sha,
          timestamp: new Date(response.data.commit.committer?.date ?? Date.now()).getTime(),
        }
      : undefined,
  }).catch(() => {});

  let pullRequestUrl: string | undefined;
  if (proposeBranch) {
    const pr = await openPullRequest(
      ctx.token,
      ctx.owner,
      ctx.repo,
      proposeBranch,
      ctx.branch,
      message,
      "Via: gitcms-mcp",
    );
    pullRequestUrl = pr.html_url;
  }

  return { commitSha: response.data.commit?.sha ?? "", pullRequestUrl };
};

export { deleteContentEntry, writeContentEntry };
export type { DeleteEntryInput, WriteEntryInput, WriteEntryResult, WriteMode };
