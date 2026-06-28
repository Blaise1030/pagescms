import { describe, it, expect } from "vitest";
import { validatePagesConfig } from "@/lib/validate-pages-config";

describe("validatePagesConfig", () => {
  it("accepts a minimal valid blog config", () => {
    const yaml = `content:
  - name: posts
    label: Posts
    type: collection
    path: content/posts
    format: yaml-frontmatter
    filename: "{year}-{month}-{day}.md"
    fields:
      - name: title
        type: string
        required: true
      - name: date
        type: date
`;
    const result = validatePagesConfig(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.content).toHaveLength(1);
    }
  });

  it("rejects invalid field types", () => {
    const yaml = `
content:
  - name: posts
    type: collection
    path: content/posts
    fields:
      - name: title
        type: not-a-type
`;
    const result = validatePagesConfig(yaml);
    expect(result.success).toBe(false);
  });
});
