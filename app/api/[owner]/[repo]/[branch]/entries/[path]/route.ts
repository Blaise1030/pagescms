import { type NextRequest } from "next/server";
import { assertGithubIdentity } from "@/lib/authz-shared";
import { createHttpError } from "@/lib/api-error";
import { withRepoContext } from "@/lib/api-repo-context";
import { getEntry } from "@/lib/content-service";
import { decodeBase64Utf8 } from "@/lib/encoding";
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

  return withRepoContext(
    { owner: params.owner, repo: params.repo, branch: params.branch },
    async (req, ctx) => {
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

      const serviceCtx = {
        ...ctx,
        owner: params.owner,
        repo: params.repo,
        branch: params.branch,
      };

      if (name) {
        const data = await getEntry(serviceCtx, name, params.path);
        return Response.json({ status: "success", data });
      }

      let response;
      try {
        response = await ctx.octokit.rest.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: normalizedPath,
          ref: params.branch,
        });
      } catch (error: unknown) {
        if ((error as { status?: number })?.status === 404) {
          throw createHttpError("Not found", 404);
        }
        throw error;
      }

      if (Array.isArray(response.data)) {
        throw createHttpError("Expected a file but found a directory", 400);
      }
      if (response.data.type !== "file") {
        throw createHttpError("Invalid response type", 500);
      }

      const content = decodeBase64Utf8(response.data.content);

      return Response.json({
        status: "success",
        data: {
          sha: response.data.sha,
          name: response.data.name,
          path: response.data.path,
          contentObject: { body: content },
        },
      });
    },
    request,
  );
}
