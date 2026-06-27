import { format as formatDate } from "date-fns";
import { marked } from "marked";
import type {
  Field,
  PreviewBind,
  PreviewRule,
  PreviewTextTransform,
} from "@/types/field";
import { resolveSchemaTemplate, safeAccess } from "@/lib/schema";
import { getFileExtension, getFileName, normalizePath } from "@/lib/utils/file";

type PreviewBindingPayload = {
  target: string;
  bind: PreviewBind;
  value: string | boolean | Array<string | boolean>;
};

const normalizeSiteUrl = (url: string) => url.replace(/\/+$/, "");

const normalizeSitePath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
};

const getSiteSettings = (configObject?: Record<string, any>) => {
  if (!configObject || typeof configObject !== "object") return {};
  const settings = configObject.settings;
  if (!settings || typeof settings !== "object") return {};
  const site = settings.site;
  return site && typeof site === "object" ? site : {};
};

const getPreviewDefaultOpen = (configObject?: Record<string, any>) => {
  const site = getSiteSettings(configObject);
  return Boolean(site?.preview?.defaultOpen);
};

const resolveSchemaSitePath = (
  schema?: Record<string, any> | null,
  values?: Record<string, any>,
  entryPath?: string | null,
) => {
  if (!schema?.site?.path || typeof schema.site.path !== "string") return null;

  const normalizedValues = values || {};
  const filename = entryPath ? getFileName(normalizePath(entryPath)) : "";
  const extension = filename ? getFileExtension(filename) : "";
  const basename =
    filename && extension
      ? filename.slice(0, -(extension.length + 1))
      : filename;
  const aliases: Record<string, unknown> = {};

  const slug = safeAccess(normalizedValues, "slug");
  if (slug != null && slug !== "") aliases.slug = slug;
  else if (basename) aliases.slug = basename;

  if (filename) aliases.filename = filename;
  if (basename) aliases.basename = basename;

  return normalizeSitePath(
    resolveSchemaTemplate(schema.site.path, schema, normalizedValues, {
      aliases,
      slugifyValues: true,
    }),
  );
};

const buildSiteUrl = (
  configObject?: Record<string, any>,
  schema?: Record<string, any> | null,
  values?: Record<string, any>,
  entryPath?: string | null,
) => {
  const site = getSiteSettings(configObject);
  if (!site?.url || typeof site.url !== "string") return null;

  const resolvedPath = resolveSchemaSitePath(schema, values, entryPath);
  if (!resolvedPath) return null;

  try {
    return new URL(resolvedPath, `${normalizeSiteUrl(site.url)}/`).toString();
  } catch {
    return null;
  }
};

const normalizePreviewRules = (preview: Field["preview"]): PreviewRule[] => {
  if (!preview) return [];
  return Array.isArray(preview) ? preview : [preview];
};

const isEmptyPreviewValue = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const applyTextTransform = (value: string, transform: PreviewTextTransform) => {
  if (transform === "uppercase") return value.toUpperCase();
  if (transform === "lowercase") return value.toLowerCase();
  if (transform === "capitalize")
    return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
};

const applyPreviewTransforms = (
  input: unknown,
  transforms: PreviewRule["transform"],
): unknown => {
  if (!transforms?.length) return input;

  let currentValue = input;

  for (const transform of transforms) {
    if ("join" in transform) {
      currentValue = Array.isArray(currentValue)
        ? currentValue.join(transform.join)
        : currentValue;
    } else if ("date" in transform) {
      const applyDateTransform = (value: unknown) => {
        if (isEmptyPreviewValue(value)) return value;
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) return value;
        try {
          return formatDate(date, transform.date);
        } catch {
          return value;
        }
      };
      currentValue = Array.isArray(currentValue)
        ? currentValue.map(applyDateTransform)
        : applyDateTransform(currentValue);
    } else if ("text" in transform) {
      if (typeof currentValue === "string") {
        currentValue = applyTextTransform(currentValue, transform.text);
      } else if (Array.isArray(currentValue)) {
        currentValue = currentValue.map((v) =>
          typeof v === "string" ? applyTextTransform(v, transform.text) : v,
        );
      }
    } else if ("fallback" in transform) {
      if (isEmptyPreviewValue(currentValue)) currentValue = transform.fallback;
    } else if ("prefix" in transform) {
      if (!isEmptyPreviewValue(currentValue))
        currentValue = `${transform.prefix}${currentValue}`;
    } else if ("suffix" in transform) {
      if (!isEmptyPreviewValue(currentValue))
        currentValue = `${currentValue}${transform.suffix}`;
    }
  }

  return currentValue;
};

const coerceBindingValue = (
  field: Field,
  bind: PreviewBind,
  value: unknown,
): string | boolean | Array<string | boolean> => {
  if (bind === "checked") return Boolean(value);

  if (bind === "html" && typeof value === "string") {
    return String(marked(value));
  }

  if (Array.isArray(value)) {
    return value.map((v) => (v == null ? "" : String(v)));
  }

  if (value == null) return "";
  return String(value);
};

const buildPreviewBinding = (
  field: Field,
  rule: PreviewRule,
  value: unknown,
): PreviewBindingPayload => ({
  target: rule.target,
  bind: rule.bind,
  value: coerceBindingValue(
    field,
    rule.bind,
    applyPreviewTransforms(value, rule.transform),
  ),
});

const collectPreviewBindings = (
  fields: Field[],
  values: Record<string, any>,
) => {
  const bindings: PreviewBindingPayload[] = [];

  for (const field of fields) {
    if (!field.preview) continue;
    const value = safeAccess(values, field.name);
    normalizePreviewRules(field.preview).forEach((rule) => {
      bindings.push(buildPreviewBinding(field, rule, value));
    });
  }

  return bindings;
};

export type { PreviewBindingPayload };
export {
  buildSiteUrl,
  collectPreviewBindings,
  getPreviewDefaultOpen,
  getSiteSettings,
  normalizeSitePath,
  normalizeSiteUrl,
  resolveSchemaSitePath,
};
