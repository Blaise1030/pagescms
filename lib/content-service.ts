import type { RepoContext } from "@/lib/api-repo-context";
import { createHttpError } from "@/lib/api-error";
import {
  filterEntriesForView,
  matchesSearchQuery,
  parseCollectionContents,
  parseEntryContent,
} from "@/lib/content-parsing";
import { decodeBase64Utf8 } from "@/lib/encoding";
import {
  getCachedEntryContent,
  getCollectionCache,
  setCachedEntryContent,
} from "@/lib/github-cache-file";
import { generateZodSchema, getSchemaByName } from "@/lib/schema";
import { getFileExtension, normalizePath } from "@/lib/utils/file";
import type { Config } from "@/types/config";
import type { User } from "@/types/user";
import type { Field } from "@/types/field";
import { z } from "zod";

type RepoRef = {
  owner: string;
  repo: string;
  branch: string;
};

type ContentServiceContext = RepoRef & {
  user: User;
  token: string;
  config: Config;
};

type ContentServiceReadContext = ContentServiceContext & Pick<RepoContext, "octokit">;

type CollectionSummary = {
  name: string;
  label?: string;
  type: string;
  path: string;
  format?: string;
  extension?: string;
  operations?: Record<string, boolean>;
};

type EntrySchemaResult = {
  jsonSchema: Record<string, unknown>;
  fields: Field[];
  format: string;
  extension?: string;
  list?: boolean;
};

type EntrySummary = Record<string, unknown>;

type ListEntriesResult = {
  contents: EntrySummary[];
  errors: string[];
};

type GetEntryResult = {
  sha: string;
  name: string;
  path: string;
  contentObject: Record<string, unknown>;
};

type ListEntriesOptions = {
  path?: string;
  query?: string;
  searchFields?: string[];
  type?: "search";
};

const toContentServiceContext = (
  ref: RepoRef,
  ctx: Pick<RepoContext, "user" | "token" | "config">,
): ContentServiceContext => ({
  ...ref,
  user: ctx.user,
  token: ctx.token,
  config: ctx.config,
});

const toContentServiceReadContext = (
  ref: RepoRef,
  ctx: RepoContext,
): ContentServiceReadContext => ({
  ...toContentServiceContext(ref, ctx),
  octokit: ctx.octokit,
});

const assertValidCollectionPath = (schema: Record<string, unknown>, path: string, name: string) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath.startsWith(schema.path as string)) {
    throw createHttpError(`Invalid path "${path}" for collection "${name}".`, 400);
  }

  if (schema.subfolders === false && normalizedPath !== schema.path) {
    throw createHttpError(`Invalid path "${path}" for collection "${name}".`, 400);
  }

  return normalizedPath;
};

const assertValidEntryPath = (schema: Record<string, unknown>, path: string, name: string) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath.startsWith(schema.path as string)) {
    throw createHttpError(`Invalid path "${path}" for ${schema.type} "${name}".`, 400);
  }

  const extension = (schema.extension as string) ?? "";
  if (getFileExtension(normalizedPath) !== extension) {
    throw createHttpError(
      `Invalid extension "${getFileExtension(normalizedPath)}" for ${schema.type} "${name}".`,
      400,
    );
  }

  return normalizedPath;
};

const listCollections = (ctx: ContentServiceContext): CollectionSummary[] => {
  const content = ctx.config.object?.content ?? [];
  return content.map((item: Record<string, unknown>) => ({
    name: String(item.name),
    label: item.label as string | undefined,
    type: (item.type as string) ?? "collection",
    path: String(item.path ?? ""),
    format: item.format as string | undefined,
    extension: item.extension as string | undefined,
    operations: item.operations as Record<string, boolean> | undefined,
  }));
};

const getEntrySchema = (ctx: ContentServiceContext, name: string): EntrySchemaResult => {
  const schema = getSchemaByName(ctx.config.object, name);
  if (!schema) throw createHttpError(`Schema not found for ${name}.`, 404);

  const fields = (schema.fields ?? []) as Field[];
  let zodSchema = generateZodSchema(fields);

  if (schema.list) {
    zodSchema = z.object({
      listWrapper: z.array(zodSchema),
    });
  }

  return {
    jsonSchema: z.toJSONSchema(zodSchema) as Record<string, unknown>,
    fields,
    format: schema.format ?? "yaml-frontmatter",
    extension: schema.extension,
    list: Boolean(schema.list),
  };
};

const listEntries = async (
  ctx: ContentServiceContext,
  name: string,
  options: ListEntriesOptions = {},
): Promise<ListEntriesResult> => {
  const schema = getSchemaByName(ctx.config.object, name);
  if (!schema) throw createHttpError(`Schema not found for ${name}.`, 404);

  const normalizedPath = assertValidCollectionPath(schema, options.path ?? "", name);

  let entries = await getCollectionCache(
    ctx.owner,
    ctx.repo,
    ctx.branch,
    normalizedPath,
    ctx.token,
    schema.view?.node?.filename,
  );

  entries = filterEntriesForView(entries, schema);

  const searchFields = options.searchFields ?? ["name"];
  let result = parseCollectionContents(entries, schema, ctx.config.object, searchFields);

  if (options.type === "search" && options.query) {
    const searchQuery = options.query.toLowerCase();
    result.contents = result.contents.filter((item) =>
      matchesSearchQuery(item, searchQuery, searchFields),
    );
  }

  return result;
};

const fetchGithubFile = async (
  ctx: ContentServiceReadContext,
  normalizedPath: string,
): Promise<{ sha: string; name: string; path: string; content: string; size: number }> => {
  let response;
  try {
    response = await ctx.octokit.rest.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: normalizedPath,
      ref: ctx.branch,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 404) throw createHttpError("Not found", 404);
    throw error;
  }

  if (Array.isArray(response.data)) {
    throw createHttpError("Expected a file but found a directory", 400);
  }
  if (response.data.type !== "file") {
    throw createHttpError("Invalid response type", 500);
  }

  return {
    sha: response.data.sha,
    name: response.data.name,
    path: response.data.path,
    content: decodeBase64Utf8(response.data.content),
    size: response.data.size ?? 0,
  };
};

const getRawEntry = async (
  ctx: ContentServiceReadContext,
  path: string,
): Promise<GetEntryResult> => {
  const normalizedPath = normalizePath(path);
  const file = await fetchGithubFile(ctx, normalizedPath);

  return {
    sha: file.sha,
    name: file.name,
    path: file.path,
    contentObject: { body: file.content },
  };
};

const getEntry = async (
  ctx: ContentServiceReadContext,
  name: string,
  path: string,
): Promise<GetEntryResult> => {
  const schema = getSchemaByName(ctx.config.object, name);
  if (!schema) throw createHttpError(`Schema not found for ${name}.`, 404);

  const normalizedPath = assertValidEntryPath(schema, path, name);

  const cached = await getCachedEntryContent(ctx.owner, ctx.repo, ctx.branch, normalizedPath);
  if (cached) {
    return {
      sha: cached.sha,
      name: normalizedPath.includes("/")
        ? normalizedPath.substring(normalizedPath.lastIndexOf("/") + 1)
        : normalizedPath,
      path: normalizedPath,
      contentObject: parseEntryContent(cached.content, schema, ctx.config.object),
    };
  }

  const file = await fetchGithubFile(ctx, normalizedPath);

  await setCachedEntryContent(
    ctx.owner,
    ctx.repo,
    ctx.branch,
    normalizedPath,
    file.content,
    file.sha,
    file.size,
  ).catch(() => {});

  return {
    sha: file.sha,
    name: file.name,
    path: file.path,
    contentObject: parseEntryContent(file.content, schema, ctx.config.object),
  };
};

export {
  getEntry,
  getEntrySchema,
  getRawEntry,
  listCollections,
  listEntries,
  toContentServiceContext,
  toContentServiceReadContext,
};
export type {
  CollectionSummary,
  ContentServiceContext,
  ContentServiceReadContext,
  EntrySchemaResult,
  EntrySummary,
  GetEntryResult,
  ListEntriesOptions,
  ListEntriesResult,
};
