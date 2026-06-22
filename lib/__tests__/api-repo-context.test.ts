import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session-server", () => ({
  requireApiUserSession: vi.fn(),
}));
vi.mock("@/lib/token", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/github-account", () => ({ getGithubId: vi.fn() }));
vi.mock("@/lib/github-cache-permissions", () => ({ checkRepoAccess: vi.fn() }));
vi.mock("@/lib/config-store", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/utils/octokit", () => ({ createOctokitInstance: vi.fn(() => ({ id: "octokit" })) }));

import { requireApiUserSession } from "@/lib/session-server";
import { getToken } from "@/lib/token";
import { getGithubId } from "@/lib/github-account";
import { checkRepoAccess } from "@/lib/github-cache-permissions";
import { getConfig } from "@/lib/config-store";
import { withRepoContext } from "@/lib/api-repo-context";

const mockUser = { id: "u1", name: "Test", email: "t@t.com" };
const mockConfig = { owner: "acme", repo: "site", branch: "main" };
const params = { owner: "acme", repo: "site", branch: "main" };

beforeEach(() => {
  vi.mocked(requireApiUserSession).mockResolvedValue({ user: mockUser } as any);
  vi.mocked(getToken).mockResolvedValue({ token: "tok", source: "user" } as any);
  vi.mocked(getGithubId).mockResolvedValue("gh123");
  vi.mocked(checkRepoAccess).mockResolvedValue(true);
  vi.mocked(getConfig).mockResolvedValue(mockConfig as any);
});

describe("withRepoContext", () => {
  it("passes resolved context to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const req = new Request("https://example.com");
    await withRepoContext(params, (r, ctx) => handler(r, ctx), req);
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: mockUser, token: "tok", config: mockConfig, octokit: expect.anything() }),
    );
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(requireApiUserSession).mockResolvedValue({ response: new Response(null, { status: 401 }) } as any);
    const req = new Request("https://example.com");
    const res = await withRepoContext(params, async () => Response.json({ ok: true }), req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when access is denied", async () => {
    vi.mocked(checkRepoAccess).mockResolvedValue(false);
    const req = new Request("https://example.com");
    const res = await withRepoContext(params, async () => Response.json({ ok: true }), req);
    expect(res.status).toBe(403);
  });
});
