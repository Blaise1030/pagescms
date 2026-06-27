import { describe, it, expect } from "vitest";
import {
  buildSiteUrl,
  collectPreviewBindings,
  getPreviewDefaultOpen,
  resolveSchemaSitePath,
} from "./site";
import type { Field } from "@/types/field";

describe("buildSiteUrl", () => {
  const config = {
    settings: {
      site: {
        url: "https://mysite.com",
      },
    },
  };

  it("builds a URL from site settings and schema path template", () => {
    const schema = { site: { path: "/blog/{{slug}}" } };
    const values = { slug: "hello-world" };

    expect(buildSiteUrl(config, schema, values)).toBe(
      "https://mysite.com/blog/hello-world",
    );
  });

  it("returns null when site url is missing", () => {
    expect(buildSiteUrl({}, { site: { path: "/blog/{{slug}}" } }, {})).toBeNull();
  });

  it("returns null when schema path is missing", () => {
    expect(buildSiteUrl(config, {}, {})).toBeNull();
  });
});

describe("resolveSchemaSitePath", () => {
  it("uses basename as slug fallback from entry path", () => {
    const schema = { site: { path: "/posts/{{slug}}" } };

    expect(resolveSchemaSitePath(schema, {}, "posts/my-post.md")).toBe(
      "/posts/my-post",
    );
  });
});

describe("getPreviewDefaultOpen", () => {
  it("reads defaultOpen from site preview settings", () => {
    expect(
      getPreviewDefaultOpen({
        settings: { site: { preview: { defaultOpen: true } } },
      }),
    ).toBe(true);
  });
});

describe("collectPreviewBindings", () => {
  const fields: Field[] = [
    {
      name: "title",
      type: "string",
      preview: { target: "#title", bind: "text" },
    },
  ];

  it("collects field preview bindings", () => {
    expect(collectPreviewBindings(fields, { title: "Hello" })).toEqual([
      { target: "#title", bind: "text", value: "Hello" },
    ]);
  });
});
