import { parseConfig, normalizeConfig } from "@/lib/config";
import { ConfigSchema } from "@/lib/config-schema";

type ValidatePagesConfigResult =
  | { success: true; config: Record<string, unknown> }
  | { success: false; errors: string[] };

const validatePagesConfig = (yamlContent: string): ValidatePagesConfigResult => {
  const { document, errors: parseErrors } = parseConfig(yamlContent);
  if (parseErrors.length > 0) {
    return { success: false, errors: parseErrors };
  }

  const rawObject = document.toJSON() as Record<string, unknown>;
  if (Array.isArray(rawObject.content)) {
    rawObject.content = rawObject.content.map((item: Record<string, unknown>) => {
      if (typeof item.path === "string") {
        return { ...item, path: item.path.replace(/^\/|\/$/g, "") };
      }
      return item;
    });
  }
  const result = ConfigSchema.safeParse(rawObject);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
        return `${issue.message}${path}`;
      }),
    };
  }

  return { success: true, config: normalizeConfig(rawObject) };
};

export { validatePagesConfig };
export type { ValidatePagesConfigResult };
