import { getCodec } from "@/app/(main)/[owner]/[repo]/[branch]/_fields/registry";
import { createHttpError } from "@/lib/api-error";
import {
  deepMap,
  getDateFromFilename,
  getFieldByPath,
  safeAccess,
} from "@/lib/schema";
import { parse } from "@/lib/serialization";
import { serializedTypes } from "@/lib/utils/file";
import type { Field } from "@/types/field";

type SchemaLike = Record<string, unknown>;

const isSerializedSchema = (schema: SchemaLike): boolean => {
  const format = schema.format as string | undefined;
  const fields = schema.fields as Field[] | undefined;
  return Boolean(format && serializedTypes.includes(format) && fields?.length);
};

const wrapListFields = (fields: Field[]): Field[] => [
  {
    name: "listWrapper",
    type: "object",
    list: true,
    fields,
  },
];

const applyReadCodecs = (
  contentObject: Record<string, unknown>,
  fields: Field[],
  config: Record<string, unknown>,
  list?: boolean,
): Record<string, unknown> => {
  let object = contentObject;
  let entryFields = fields;

  if (list) {
    object = { listWrapper: contentObject };
    entryFields = wrapListFields(fields);
  }

  const mapped = deepMap(object, entryFields, (value, field) => {
    const read = typeof field.type === "string" ? getCodec(field.type)?.read : undefined;
    return read ? read(value, field, config) : value;
  });

  return list ? ((mapped as Record<string, unknown>).listWrapper as Record<string, unknown>) : mapped;
};

const normalizeRequestedFieldPaths = (fieldPaths: string[]) =>
  fieldPaths
    .filter((fieldPath) => fieldPath !== "path")
    .map((fieldPath) => (fieldPath.startsWith("fields.") ? fieldPath.replace(/^fields\./, "") : fieldPath));

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

const pickAndTransformFields = (
  parsedObject: Record<string, unknown>,
  schemaFields: Field[],
  fieldPaths: string[],
  config: Record<string, unknown>,
) => {
  const output: Record<string, unknown> = {};
  const dedupedPaths = Array.from(new Set(fieldPaths));

  dedupedPaths.forEach((fieldPath) => {
    if (fieldPath === "name" || fieldPath === "path") return;

    const normalizedFieldPath = fieldPath.startsWith("fields.")
      ? fieldPath.replace(/^fields\./, "")
      : fieldPath;
    const field = getFieldByPath(schemaFields, normalizedFieldPath);
    if (!field) return;

    let value = safeAccess(parsedObject, normalizedFieldPath);
    const read = typeof field.type === "string" ? getCodec(field.type)?.read : undefined;
    if (read) {
      const transformedValue = read(value, field, config);
      if (transformedValue !== undefined) value = transformedValue;
    }
    setByPath(output, normalizedFieldPath, value);
  });

  return output;
};

const parseSerializedObject = (
  content: string,
  schema: SchemaLike,
  config: Record<string, unknown>,
  selectedFields?: string[],
): Record<string, unknown> => {
  const fields = schema.fields as Field[];
  const parsedObject = parse(content, {
    format: schema.format as string,
    delimiters: schema.delimiters as string | undefined,
  });

  if (selectedFields?.length) {
    return pickAndTransformFields(parsedObject, fields, normalizeRequestedFieldPaths(selectedFields), config);
  }

  return applyReadCodecs(parsedObject, fields, config, Boolean(schema.list));
};

const parseEntryContent = (
  content: string,
  schema: SchemaLike,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  if (!isSerializedSchema(schema)) return { body: content };

  try {
    return parseSerializedObject(content, schema, config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw createHttpError(`Error parsing frontmatter: ${message}`, 400);
  }
};

const enrichParsedFileFields = (
  contentObject: Record<string, unknown>,
  item: Record<string, unknown>,
  schema: SchemaLike,
) => {
  const fields = schema.fields as Field[] | undefined;
  if (!fields?.length) {
    contentObject.name = item.name;
  }

  const filenamePattern = (schema.filename as string | undefined) ?? "";
  if (!contentObject.date && filenamePattern.startsWith("{year}-{month}-{day}")) {
    const filenameDate = getDateFromFilename(String(item.name));
    if (filenameDate) contentObject.date = filenameDate.string;
  }

  return contentObject;
};

type ParsedCollectionItem = Record<string, unknown>;

const parseCollectionItem = (
  item: Record<string, unknown>,
  schema: SchemaLike,
  config: Record<string, unknown>,
  selectedFields?: string[],
): { entry?: ParsedCollectionItem; error?: string } => {
  const excludedFiles = (schema.exclude as string[]) ?? [];
  const extension = (schema.extension as string) ?? "";

  if (
    item.type === "file" &&
    (extension === "" || String(item.path).endsWith(`.${extension}`)) &&
    !excludedFiles.includes(String(item.name))
  ) {
    let contentObject: Record<string, unknown> = {};

    if (isSerializedSchema(schema)) {
      try {
        contentObject = parseSerializedObject(String(item.content), schema, config, selectedFields);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error parsing frontmatter for file "${item.path}": ${message}`);
        return { error: `Error parsing frontmatter for file "${item.path}": ${message}` };
      }
    }

    enrichParsedFileFields(contentObject, item, schema);

    return {
      entry: {
        sha: item.sha,
        name: item.name,
        parentPath: item.parentPath,
        path: item.path,
        fields: contentObject,
        type: "file",
        isNode: item.isNode,
      },
    };
  }

  if (item.type === "dir" && !excludedFiles.includes(String(item.name)) && schema.subfolders !== false) {
    return {
      entry: {
        name: item.name,
        parentPath: item.parentPath,
        path: item.path,
        type: "dir",
      },
    };
  }

  return {};
};

const parseCollectionContents = (
  contents: Record<string, unknown>[],
  schema: SchemaLike,
  config: Record<string, unknown>,
  selectedFields?: string[],
): { contents: ParsedCollectionItem[]; errors: string[] } => {
  const parsedErrors: string[] = [];
  const parsedContents: ParsedCollectionItem[] = [];

  contents.forEach((item) => {
    const { entry, error } = parseCollectionItem(item, schema, config, selectedFields);
    if (error) parsedErrors.push(error);
    if (entry) parsedContents.push(entry);
  });

  return { contents: parsedContents, errors: parsedErrors };
};

const filterEntriesForView = (
  entries: Record<string, unknown>[],
  schema: SchemaLike,
): Record<string, unknown>[] => {
  let filtered = entries;
  const view = schema.view as Record<string, Record<string, string>> | undefined;

  if (view?.node?.filename) {
    filtered = filtered.filter(
      (item) =>
        item.isNode || item.parentPath === schema.path || item.name !== view.node.filename,
    );
  }

  const hideDirs = view?.node?.hideDirs;
  if (hideDirs && ["all", "nodes", "others"].includes(hideDirs)) {
    if (hideDirs === "all") {
      filtered = filtered.filter((item) => item.type !== "dir");
    } else {
      filtered = filtered.filter(
        (item) =>
          item.type !== "dir" ||
          (hideDirs === "others"
            ? filtered.some(
                (subItem) => subItem.parentPath === item.path && subItem.isNode,
              )
            : !filtered.some(
                (subItem) => subItem.parentPath === item.path && subItem.isNode,
              )),
      );
    }
  }

  return filtered;
};

const matchesSearchQuery = (
  item: ParsedCollectionItem,
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
  applyReadCodecs,
  filterEntriesForView,
  isSerializedSchema,
  matchesSearchQuery,
  normalizeRequestedFieldPaths,
  parseCollectionContents,
  parseEntryContent,
  parseSerializedObject,
  pickAndTransformFields,
};
