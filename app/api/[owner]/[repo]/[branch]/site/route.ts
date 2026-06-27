export const maxDuration = 30;

import { getConfig } from "@/lib/config-store";
import { buildSiteBootstrapData } from "@/lib/site-api";
import { toErrorResponse } from "@/lib/api-error";
import { PUBLIC_CORS_HEADERS } from "@/lib/public-cors";

type RouteParams = { owner: string; repo: string; branch: string };

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: PUBLIC_CORS_HEADERS,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> },
) {
  try {
    const params = await context.params;
    const config = await getConfig(params.owner, params.repo, params.branch, {
      bootstrapOnMiss: false,
    });
    const data = buildSiteBootstrapData(config, params);

    return Response.json(
      {
        status: "success",
        data,
      },
      {
        headers: {
          ...PUBLIC_CORS_HEADERS,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to load site actions.",
      },
      {
        status: 500,
        headers: PUBLIC_CORS_HEADERS,
      },
    );
  }
}
