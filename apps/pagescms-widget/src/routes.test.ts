import { describe, expect, it } from "vitest";
import {
  matchRoutePath,
  resolveFilenameFromRoute,
} from "./routes";
import type { BootstrapRoute } from "./types";
import { getTokenValue, normalizePathname } from "./utils";

describe("normalizePathname", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizePathname("/blog/post/")).toBe("/blog/post");
    expect(normalizePathname("/")).toBe("/");
  });
});

describe("getTokenValue", () => {
  it("falls back to slug for primary token", () => {
    expect(getTokenValue({ slug: "hello" }, "primary")).toBe("hello");
  });
});

describe("matchRoutePath", () => {
  it("extracts route params from the current pathname", () => {
    const route: BootstrapRoute = {
      name: "posts",
      type: "collection",
      sitePath: "/blog/{slug}",
      contentPath: "content/posts",
    };

    expect(matchRoutePath(route, "/blog/hello-world")).toEqual({
      slug: "hello-world",
    });
  });
});

describe("resolveFilenameFromRoute", () => {
  it("resolves filename templates from route params", () => {
    const route: BootstrapRoute = {
      name: "posts",
      type: "collection",
      filename: "{slug}.md",
      extension: "md",
    };

    expect(resolveFilenameFromRoute(route, { slug: "hello-world" })).toBe(
      "hello-world.md",
    );
  });
});
