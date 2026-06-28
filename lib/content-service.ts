import { getCodec } from "@/app/(main)/[owner]/[repo]/[branch]/_fields/registry";
import type { RepoContext } from "@/lib/api-repo-context";
import { createHttpError } from "@/lib/api-error";
import { decodeBase64Utf8 } from "@/lib/encoding";
import {
  getCachedEntryContent,
  getCollectionCache,
  setCachedEntryContent,
} from "@/lib/github-cache-file";
import {
  deepMap,
  generateZodSchema,
  getDateFromFilename,
  getFieldByPath,
  getSchemaByName,
  safeAccess,
} from "@/lib/schema";
import { parse } from "@/lib/serialization";
import { getFileExtension, normalizePath } from "@/lib/utils/file";
import type { Config } from "@/types/config";
import type { User } from "@/types/user";
import type { Field } from "@/types/field";
import { z } from "zod";

const SERIALIZED_FORMATS = [
  "yaml-frontmatter",
  "json-frontmatter",
  "toml-frontmatter",
  "yaml",
  "json",
  "toml",
] as const;

type ContentServiceContext = {
  user: User;
  token: string;
  config: Config;
  owner: string;
  repo: string;
  branch: string;
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

  const normalizedPath = normalizePath(options.path ?? "");
  if (!normalizedPath.startsWith(schema.path)) {
    throw createHttpError(`Invalid path "${options.path ?? ""}" for collection "${name}".`, 400);
  }

  if (schema.subfolders === false && normalizedPath !== schema.path) {
    throw createHttpError(`Invalid path "${options.path ?? ""}" for collection "${name}".`, 400);
  }

  let entries = await getCollectionCache(
    ctx.owner,
    ctx.repo,
    ctx.branch,
    normalizedPath,
    ctx.token,
    schema.view?.node?.filename,
  );

  if (schema.view?.node?.filename) {
    entries = entries.filter(
      (item: Record<string, unknown>) =>
        item.isNode ||
        item.parentPath === schema.path ||
        item.name !== schema.view.node.filename,
    );
  }

  const hideDirs = schema.view?.node?.hideDirs;
  if (hideDirs && ["all", "nodes", "others"].includes(hideDirs)) {
    if (hideDirs === "all") {
      entries = entries.filter((item: Record<string, unknown>) => item.type !== "dir");
    } else {
      entries = entries.filter(
        (item: Record<string, unknown>) =>
          item.type !== "dir" ||
          (hideDirs === "others"
            ? entries.some(
                (subItem: Record<string, unknown>) =>
                  subItem.parentPath === item.path && subItem.isNode,
              )
            : !entries.some(
                (subItem: Record<string, unknown>) =>
                  subItem.parentPath === item.path && subItem.isNode,
              )),
      );
    }
  }

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

const getEntry = async (
  ctx: ContentServiceReadContext,
  name: string,
  path: string,
): Promise<GetEntryResult> => {
  const schema = getSchemaByName(ctx.config.object, name);
  if (!schema) throw createHttpError(`Schema not found for ${name}.`, 404);

  const normalizedPath = normalizePath(path);
  if (!normalizedPath.startsWith(schema.path)) {
    throw createHttpError(`Invalid path "${path}" for ${schema.type} "${name}".`, 400);
  }

  const extension = schema.extension ?? "";
  if (getFileExtension(normalizedPath) !== extension) {
    throw createHttpError(
      `Invalid extension "${getFileExtension(normalizedPath)}" for ${schema.type} "${name}".`,
      400,
    );
  }

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

  const content = decodeBase64Utf8(response.data.content);

  await setCachedEntryContent(
    ctx.owner,
    ctx.repo,
    ctx.branch,
    normalizedPath,
    content,
    response.data.sha,
    response.data.size ?? 0,
  ).catch(() => {});

  return {
    sha: response.data.sha,
    name: response.data.name,
    path: response.data.path,
    contentObject: parseEntryContent(content, schema, ctx.config.object),
  };
};

const parseEntryContent = (
  content: string,
  schema: Record<string, unknown>,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const format = schema.format as string | undefined;
  const fields = schema.fields as Field[] | undefined;

  if (format && SERIALIZED_FORMATS.includes(format as (typeof SERIALIZED_FORMATS)[number]) && fields?.length) {
    try {
      let contentObject = parse(content, {
        format,
        delimiters: schema.delimiters as string | undefined,
      });

      let entryFields: Field[];
      if (schema.list) {
        contentObject = { listWrapper: contentObject };
        entryFields = [
          {
            name: "listWrapper",
            type: "object",
            list: true,
            fields,
          },
        ];
      } else {
        entryFields = fields;
      }

      contentObject = deepMap(contentObject, entryFields, (value, field) => {
        const type = field.type;
        const read = typeof type === "string" ? getCodec(type)?.read : undefined;
        return read ? read(value, field, config) : value;
      });

      if (schema.list) return (contentObject as Record<string, unknown>).listWrapper as Record<string, unknown>;
      return contentObject;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw createHttpError(`Error parsing frontmatter: ${message}`, 400);
    }
  }

  return { body: content };
};

const parseCollectionContents = (
  contents: Record<string, unknown>[],
  schema: Record<string, unknown>,
  config: Record<string, unknown>,
  selectedFields?: string[],
): ListEntriesResult => {
  const format = schema.format as string | undefined;
  const fields = schema.fields as Field[] | undefined;
  const excludedFiles = (schema.exclude as string[]) ?? [];
  const extension = (schema.extension as string) ?? "";

  const parsedErrors: string[] = [];
  const parsedContents = contents
    .map((item) => {
      if (
        item.type === "file" &&
        (extension === "" || String(item.path).endsWith(`.${extension}`)) &&
        !excludedFiles.includes(String(item.name))
      ) {
        let contentObject: Record<string, unknown> = {};

        if (format && SERIALIZED_FORMATS.includes(format as (typeof SERIALIZED_FORMATS)[number]) && fields) {
          try {
            const parsedObject = parse(String(item.content), {
              format,
              delimiters: schema.delimiters as string | undefined,
            });

            if (selectedFields?.length) {
              const requestedFieldPaths = selectedFields
                .filter((fieldPath) => fieldPath !== "path")
                .map((fieldPath) =>
                  fieldPath.startsWith("fields.") ? fieldPath.replace(/^fields\./, "") : fieldPath,
                );
              contentObject = pickAndTransformFields(parsedObject, fields, requestedFieldPaths, config);
            } else {
              contentObject = deepMap(parsedObject, fields, (value, field) => {
                const read = typeof field.type === "string" ? getCodec(field.type)?.read : undefined;
                return read ? read(value, field, config) : value;
              });
            }
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error parsing frontmatter for file "${item.path}": ${message}`);
            parsedErrors.push(`Error parsing frontmatter for file "${item.path}": ${message}`);
          }
        }

        if (!fields?.length) {
          contentObject.name = item.name;
        }

        const filenamePattern = (schema.filename as string | undefined) ?? "";
        if (!contentObject.date && filenamePattern.startsWith("{year}-{month}-{day}")) {
          const filenameDate = getDateFromFilename(String(item.name));
          if (filenameDate) contentObject.date = filenameDate.string;
        }

        return {
          sha: item.sha,
          name: item.name,
          parentPath: item.parentPath,
          path: item.path,
          fields: contentObject,
          type: "file",
          isNode: item.isNode,
        };
      }

      if (item.type === "dir" && !excludedFiles.includes(String(item.name)) && schema.subfolders !== false) {
        return {
          name: item.name,
          parentPath: item.parentPath,
          path: item.path,
          type: "dir",
        };
      }

      return undefined;
    })
    .filter((item): item is EntrySummary => item !== undefined);

  return { contents: parsedContents, errors: parsedErrors };
};

const pickAndTransformFields = (
  parsedObject: Record<string, unknown>,
  schemaFields: Field[],
  fieldPaths: string[],
  config: Record<string, unknown>,
) => {
  const output: Record<string, unknown> = {};
  const dedupedPaths = Array.from(new Set(fieldPaths));

  dedupedPaths.forEach((fieldPath) => {
    const field = getFieldByPath(schemaFields, fieldPath);
    if (!field) return;

    let value = safeAccess(parsedObject, fieldPath);
    const read = typeof field.type === "string" ? getCodec(field.type)?.read : undefined;
    if (read) {
      const transformedValue = read(value, field, config);
      if (transformedValue !== undefined) value = transformedValue;
    }
    setByPath(output, fieldPath, value);
  });

  return output;
};

const setByPath = (target: Record<string, unknown>, path: string, value: unknown) => {
  if (!path) return;
  const segments = path.split(".");
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (cursor[key] == null || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = value;
};

const matchesSearchQuery = (
  item: EntrySummary,
  searchQuery: string,
  searchFields: string[],
): boolean => {
  if (searchFields.length === 0) {
    const name = item.name as string | undefined;
    const path = item.path as string | undefined;
    const content = item.content as string | undefined;
    if (name?.toLowerCase().includes(searchQuery)) return true;
    if (path?.toLowerCase().includes(searchQuery)) return true;
    return Boolean(content && content.toLowerCase().includes(searchQuery));
  }

  return searchFields.some((field) => {
    if (field === "name" || field === "path") {
      const value = item[field];
      return value && String(value).toLowerCase().includes(searchQuery);
    }

    if (field.startsWith("fields.")) {
      const fieldPath = field.replace("fields.", "");
      const fields = item.fields as Record<string, unknown> | undefined;
      const value = fields ? safeAccess(fields, fieldPath) : undefined;
      return value && String(value).toLowerCase().includes(searchQuery);
    }

    return false;
  });
};

export {
  getEntry,
  getEntrySchema,
  listCollections,
  listEntries,
  parseEntryContent,
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
