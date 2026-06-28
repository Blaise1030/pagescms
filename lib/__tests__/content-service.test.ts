import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/github-cache-file", () => ({
  getCachedEntryContent: vi.fn(),
  getCollectionCache: vi.fn(),
  setCachedEntryContent: vi.fn(),
}));

import { getCollectionCache } from "@/lib/github-cache-file";
import {
  getEntrySchema,
  listCollections,
  listEntries,
  parseEntryContent,
} from "@/lib/content-service";

const mockConfig = {
  owner: "acme",
  repo: "site",
  branch: "main",
  sha: "abc",
  version: "1.0",
  object: {
    content: [
      {
        name: "posts",
        label: "Posts",
        type: "collection",
        path: "content/posts",
        format: "yaml-frontmatter",
        extension: "md",
        fields: [
          { name: "title", type: "string", required: true },
          { name: "date", type: "date" },
        ],
      },
      {
        name: "about",
        label: "About",
        type: "file",
        path: "content/about.md",
        format: "yaml-frontmatter",
        extension: "md",
        fields: [{ name: "title", type: "string" }],
      },
    ],
  },
};

const ctx = {
  user: { id: "u1", name: "Test", email: "t@t.com" },
  token: "tok",
  config: mockConfig as any,
  octokit: { rest: { repos: { getContent: vi.fn() } } },
  owner: "acme",
  repo: "site",
  branch: "main",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCollections", () => {
  it("returns summaries from config content entries", () => {
    const collections = listCollections(ctx);
    expect(collections).toHaveLength(2);
    expect(collections[0]).toMatchObject({
      name: "posts",
      label: "Posts",
      type: "collection",
      path: "content/posts",
    });
  });
});

describe("getEntrySchema", () => {
  it("returns JSON Schema and fields for a collection", () => {
    const schema = getEntrySchema(ctx, "posts");
    expect(schema.fields).toHaveLength(2);
    expect(schema.format).toBe("yaml-frontmatter");
    expect(schema.jsonSchema).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        title: expect.any(Object),
        date: expect.any(Object),
      }),
    });
  });

  it("throws when schema is missing", () => {
    expect(() => getEntrySchema(ctx, "missing")).toThrow("Schema not found");
  });
});

describe("parseEntryContent", () => {
  it("parses yaml frontmatter into a content object", () => {
    const content = `---
title: Hello
date: 2026-01-01
---
Body text`;

    const result = parseEntryContent(
      content,
      mockConfig.object.content[0],
      mockConfig.object,
    );

    expect(result).toMatchObject({
      title: "Hello",
      date: "2026-01-01",
    });
  });
});

describe("listEntries", () => {
  it("returns parsed collection entries", async () => {
    vi.mocked(getCollectionCache).mockResolvedValue([
      {
        type: "file",
        name: "hello.md",
        path: "content/posts/hello.md",
        parentPath: "content/posts",
        sha: "sha1",
        content: "---\ntitle: Hello\n---\n",
      },
    ] as any);

    const result = await listEntries(ctx, "posts", {
      path: "content/posts",
      searchFields: ["fields.title"],
    });
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toMatchObject({
      name: "hello.md",
      fields: { title: "Hello" },
    });
  });

  it("filters entries when search type is requested", async () => {
    vi.mocked(getCollectionCache).mockResolvedValue([
      {
        type: "file",
        name: "hello.md",
        path: "content/posts/hello.md",
        parentPath: "content/posts",
        sha: "sha1",
        content: "---\ntitle: Hello\n---\n",
      },
      {
        type: "file",
        name: "world.md",
        path: "content/posts/world.md",
        parentPath: "content/posts",
        sha: "sha2",
        content: "---\ntitle: Goodbye\n---\n",
      },
    ] as any);

    const result = await listEntries(ctx, "posts", {
      path: "content/posts",
      type: "search",
      query: "hello",
      searchFields: ["fields.title"],
    });

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].name).toBe("hello.md");
  });
});
