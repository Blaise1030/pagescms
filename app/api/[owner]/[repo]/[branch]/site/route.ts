export const maxDuration = 30;

import { getConfig } from "@/lib/config-store";
import {
  buildSiteBootstrapData,
  getAllowedSiteOrigins,
  isSiteOriginAllowed,
  resolveSiteCorsHeaders,
} from "@/lib/site-api";
import { toErrorResponse } from "@/lib/api-error";

type RouteParams = { owner: string; repo: string; branch: string };

const buildCorsResponse = (
  request: Request,
  allowedOrigins: string[],
  init?: ResponseInit,
) => {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(
    resolveSiteCorsHeaders(request, allowedOrigins),
  )) {
    headers.set(key, value);
  }

  return new Response(init?.body ?? null, {
    ...init,
    headers,
  });
};

export async function OPTIONS(
  request: Request,
  context: { params: Promise<RouteParams> },
) {
  try {
    const params = await context.params;
    const config = await getConfig(params.owner, params.repo, params.branch, {
      bootstrapOnMiss: false,
    });
    const allowedOrigins = getAllowedSiteOrigins(config?.object);

    if (!isSiteOriginAllowed(request, allowedOrigins)) {
      return buildCorsResponse(request, allowedOrigins, { status: 403 });
    }

    return buildCorsResponse(request, allowedOrigins, { status: 204 });
  } catch (error) {
    console.error(error);
    return toErrorResponse(error);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<RouteParams> },
) {
  try {
    const params = await context.params;
    const config = await getConfig(params.owner, params.repo, params.branch, {
      bootstrapOnMiss: false,
    });
    const allowedOrigins = getAllowedSiteOrigins(config?.object);

    if (!isSiteOriginAllowed(request, allowedOrigins)) {
      return buildCorsResponse(request, allowedOrigins, {
        status: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "error",
          error: "Origin not allowed.",
        }),
      });
    }

    const data = buildSiteBootstrapData(config, params);

    return buildCorsResponse(request, allowedOrigins, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({
        status: "success",
        data,
      }),
    });
  } catch (error) {
    console.error(error);
    return toErrorResponse(error);
  }
}
