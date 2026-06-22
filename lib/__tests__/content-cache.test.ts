import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/github-cache-file", () => ({
  clearFileCache: vi.fn().mockResolvedValue(undefined),
  updateMultipleFilesCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/github-cache-meta", () => ({
  deleteCacheFileMeta: vi.fn().mockResolvedValue(undefined),
  upsertCacheFileMeta: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/github-webhook-installation", () => ({
  clearScopedFileCache: vi.fn().mockResolvedValue(undefined),
}));

import { clearScopedFileCache } from "@/lib/github-webhook-installation";
import { updateMultipleFilesCache } from "@/lib/github-cache-file";
import { ContentCache } from "@/lib/content-cache";

describe("ContentCache.invalidate", () => {
  it("calls clearScopedFileCache with the given path", async () => {
    await ContentCache.invalidate("acme", "site", "main", "content/post.md");
    expect(clearScopedFileCache).toHaveBeenCalledWith(
      "acme",
      "site",
      "main",
      ["content/post.md"],
    );
  });
});

describe("ContentCache.invalidateByWebhook", () => {
  it("calls updateMultipleFilesCache for removed files", async () => {
    await ContentCache.invalidateByWebhook(
      "acme",
      "site",
      "main",
      { added: [], modified: [], removed: ["content/old.md"] },
      { token: "tok" },
    );
    expect(updateMultipleFilesCache).toHaveBeenCalled();
  });
});
