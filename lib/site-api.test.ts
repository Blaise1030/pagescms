import { describe, expect, it } from "vitest";
import { buildSiteBootstrapData, toWidgetSitePath } from "./site-api";
import type { Config } from "@/types/config";

describe("toWidgetSitePath", () => {
  it("converts cms path templates to widget route tokens", () => {
    expect(toWidgetSitePath("/blog/{{slug}}")).toBe("/blog/{slug}");
  });
});

describe("buildSiteBootstrapData", () => {
  it("builds create links and preview routes from config content", () => {
    const config = {
      owner: "blaise1030",
      repo: "astrosample",
      branch: "main",
      sha: "abc",
      version: "3.0",
      object: {
        content: [
          {
            name: "posts",
            label: "Posts",
            type: "collection",
            path: "content/posts",
            filename: "{slug}.md",
            site: { path: "/blog/{{slug}}" },
          },
          {
            name: "site",
            type: "file",
            path: "src/data/site.json",
            site: { path: "/" },
          },
        ],
      },
      lastCheckedAt: new Date(),
    } satisfies Config;

    expect(
      buildSiteBootstrapData(config, {
        owner: "Blaise1030",
        repo: "astrosample",
        branch: "main",
      }),
    ).toEqual({
      create: [
        {
          label: "Posts",
          href: "/blaise1030/astrosample/main/collection/posts/new",
        },
      ],
      routes: [
        {
          name: "posts",
          type: "collection",
          label: "Posts",
          contentPath: "content/posts",
          filename: "{slug}.md",
          extension: "",
          sitePath: "/blog/{slug}",
        },
        {
          name: "site",
          type: "file",
          label: "site",
          contentPath: "src/data/site.json",
          filename: null,
          extension: "",
          sitePath: "/",
        },
      ],
    });
  });
});
