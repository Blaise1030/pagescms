import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/idb", () => ({
  idbCacheKey: vi.fn((o, r, b, p) => `${o}/${r}/${b}/${p}`),
  getFileDraft: vi.fn().mockResolvedValue(undefined),
  setFileDraft: vi.fn().mockResolvedValue(undefined),
  deleteFileDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-client", () => ({
  requireApiSuccess: vi.fn().mockResolvedValue({ data: { sha: "abc123", path: "content/post.md" } }),
}));

global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { sha: "sha1", path: "content/post.md", contentObject: { title: "Hello" } } })));

import { useEntryStore } from "@/app/(main)/[owner]/[repo]/[branch]/_hooks/use-entry-store";
import { setFileDraft, deleteFileDraft } from "@/lib/idb";

const mockConfig = { owner: "acme", repo: "site", branch: "main", object: null } as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useEntryStore", () => {
  it("returns isLoading=true initially when path is defined", () => {
    const { result } = renderHook(
      () => useEntryStore("content/post.md", { config: mockConfig, name: "posts" }),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("saveDraft writes to idb", async () => {
    const { result } = renderHook(
      () => useEntryStore("content/post.md", { config: mockConfig, name: "posts" }),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      result.current.saveDraft({ title: "Draft" });
    });
    expect(setFileDraft).toHaveBeenCalledWith(
      "acme/site/main/content/post.md",
      { title: "Draft" },
    );
  });

  it("discard deletes draft and clears hasDraft", async () => {
    const { result } = renderHook(
      () => useEntryStore("content/post.md", { config: mockConfig, name: "posts" }),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      result.current.saveDraft({ title: "Draft" });
    });
    await act(async () => {
      await result.current.discard();
    });
    expect(deleteFileDraft).toHaveBeenCalledWith("acme/site/main/content/post.md");
  });
});
