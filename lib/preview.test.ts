import { describe, it, expect } from "vitest";
import { getPreviewUrl } from "./preview";

describe("getPreviewUrl", () => {
  it("returns full URL when both siteUrl and previewPath are present", () => {
    expect(getPreviewUrl("https://mysite.com", "/preview/products")).toBe(
      "https://mysite.com/preview/products"
    );
  });

  it("returns null when siteUrl is missing", () => {
    expect(getPreviewUrl(undefined, "/preview/products")).toBeNull();
  });

  it("returns null when previewPath is missing", () => {
    expect(getPreviewUrl("https://mysite.com", undefined)).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(getPreviewUrl(undefined, undefined)).toBeNull();
  });

  it("trims trailing slash from siteUrl", () => {
    expect(getPreviewUrl("https://mysite.com/", "/preview/products")).toBe(
      "https://mysite.com/preview/products"
    );
  });
});
