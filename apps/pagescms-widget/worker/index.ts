interface Env {
  ASSETS: Fetcher;
}

const WIDGET_PATH = "/pagescms-widget.js";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function withWidgetHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/javascript; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=3600");
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const assetPath = url.pathname === "/" ? WIDGET_PATH : url.pathname;
    const assetRequest = new Request(new URL(assetPath, request.url), {
      method: request.method,
      headers: request.headers,
    });
    const response = await env.ASSETS.fetch(assetRequest);

    if (response.status === 404) {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders(),
      });
    }

    return withWidgetHeaders(response);
  },
};
