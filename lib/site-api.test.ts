import { describe, expect, it } from "vitest";
import {
  buildSiteBootstrapData,
  getAllowedSiteOrigins,
  isSiteOriginAllowed,
  resolveSiteCorsHeaders,
  toWidgetSitePath,
} from "./site-api";
import type { Config } from "@/types/config";

describe("getAllowedSiteOrigins", () => {
  it("collects origins from site url and origins list", () => {
    expect(
      getAllowedSiteOrigins({
        settings: {
          site: {
            url: "https://astrosample.nocodemonkeys1.workers.dev",
            origins: [
              "https://staging.example.com",
              "https://preview.example.com/path",
            ],
          },
        },
      }),
    ).toEqual([
      "https://astrosample.nocodemonkeys1.workers.dev",
      "https://staging.example.com",
      "https://preview.example.com",
    ]);
  });
});

describe("resolveSiteCorsHeaders", () => {
  it("returns allow-origin only for whitelisted request origins", () => {
    const request = new Request("https://cms.example/api/o/r/b/site", {
      headers: { Origin: "https://astrosample.nocodemonkeys1.workers.dev" },
    });

    expect(
      resolveSiteCorsHeaders(request, [
        "https://astrosample.nocodemonkeys1.workers.dev",
      ]),
    ).toMatchObject({
      "Access-Control-Allow-Origin":
        "https://astrosample.nocodemonkeys1.workers.dev",
    });
  });

  it("omits allow-origin for unknown origins", () => {
    const request = new Request("https://cms.example/api/o/r/b/site", {
      headers: { Origin: "https://evil.example" },
    });

    expect(
      resolveSiteCorsHeaders(request, [
        "https://astrosample.nocodemonkeys1.workers.dev",
      ]),
    ).not.toHaveProperty("Access-Control-Allow-Origin");
  });
});

describe("isSiteOriginAllowed", () => {
  it("allows requests without an origin header", () => {
    const request = new Request("https://cms.example/api/o/r/b/site");
    expect(isSiteOriginAllowed(request, [])).toBe(true);
  });
});

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
