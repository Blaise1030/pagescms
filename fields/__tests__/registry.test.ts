import { describe, it, expect } from "vitest";
import { getCodec } from "@/fields/registry";

describe("getCodec", () => {
  it("returns a codec for a registered field type", () => {
    const codec = getCodec("boolean");
    expect(codec).toBeDefined();
  });

  it("codec has schema, defaultValue, read, write, EditComponent", () => {
    const codec = getCodec("boolean");
    expect(codec?.schema).toBeTypeOf("function");
    expect(codec?.defaultValue).toBeDefined();
    expect(codec?.EditComponent).toBeDefined();
  });

  it("returns undefined for an unknown type", () => {
    expect(getCodec("nonexistent-type-xyz")).toBeUndefined();
  });
});
