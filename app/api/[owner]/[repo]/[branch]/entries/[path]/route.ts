import { type NextRequest } from "next/server";
import { assertGithubIdentity } from "@/lib/authz-shared";
import { createHttpError } from "@/lib/api-error";
import { withRepoContext } from "@/lib/api-repo-context";
import { getEntry, getRawEntry, toContentServiceReadContext } from "@/lib/content-service";
import { normalizePath } from "@/lib/utils/file";

/**
 * Fetches and parses individual file contents from GitHub repositories
 * (usually for editing).
 *
 * GET /api/[owner]/[repo]/[branch]/entries/[path]?name=[schemaName]
 *
 * Requires authentication. If no schema name is provided, we return the raw
 * contents.
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; branch: string; path: string }> },
) {
  const params = await context.params;
  const ref = { owner: params.owner, repo: params.repo, branch: params.branch };

  return withRepoContext(ref, async (req, ctx) => {
    const { user, config: repoConfig } = ctx;

    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get("name");
    const metaOnly = searchParams.get("meta") === "true" || searchParams.get("meta") === "1";

    const normalizedPath = normalizePath(params.path);
    if (normalizedPath === ".pages.yml") {
      assertGithubIdentity(user, "Only GitHub users can access settings.");
    }

    if (!name && normalizedPath !== ".pages.yml") {
      throw createHttpError(
        'If no content entry name is provided, the path must be ".pages.yml".',
        400,
      );
    }

    if (!name && normalizedPath === ".pages.yml" && metaOnly) {
      return Response.json({
        status: "success",
        data: {
          sha: repoConfig?.sha ?? null,
          version: repoConfig?.version ?? null,
          lastCheckedAt: repoConfig?.lastCheckedAt ?? null,
        },
      });
    }

    const serviceCtx = toContentServiceReadContext(ref, ctx);

    if (name) {
      const data = await getEntry(serviceCtx, name, params.path);
      return Response.json({ status: "success", data });
    }

    const data = await getRawEntry(serviceCtx, params.path);
    return Response.json({ status: "success", data });
  }, request);
}
