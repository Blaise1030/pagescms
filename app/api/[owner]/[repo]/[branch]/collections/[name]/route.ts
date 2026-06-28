export const maxDuration = 30;

import { type NextRequest } from "next/server";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { listEntries, toContentServiceContext } from "@/lib/content-service";
import { toErrorResponse } from "@/lib/api-error";

/**
 * Fetches and parses collection contents from GitHub repositories
 * (for collection views and searches)
 *
 * GET /api/[owner]/[repo]/[branch]/collections/[name]
 *
 * Requires authentication. If type is set to "search", we filter the contents
 * based on the query and fields parameters.
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; branch: string; name: string }> },
) {
  try {
    const params = await context.params;
    const { user, token, config } = await getRepoReadContext(params);

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path") || "";
    const type = searchParams.get("type");
    const query = searchParams.get("query") || "";
    const fields = searchParams.get("fields")?.split(",") || ["name"];

    const data = await listEntries(
      toContentServiceContext(params, { user, token, config }),
      params.name,
      {
        path,
        query,
        searchFields: fields,
        type: type === "search" ? "search" : undefined,
      },
    );

    return Response.json({
      status: "success",
      data,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
