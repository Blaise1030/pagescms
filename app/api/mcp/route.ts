import { authenticateCmsToken } from "@/lib/cms-token";

const handleMcpRequest = async (request: Request): Promise<Response> => {
  const auth = await authenticateCmsToken(request.headers.get("authorization"));
  if (!auth) {
    return Response.json(
      { error: "Unauthorized. Provide Authorization: Bearer cms_pat_…" },
      { status: 401 },
    );
  }

  const [{ WebStandardStreamableHTTPServerTransport }, { createPagesCmsMcpServer }] =
    await Promise.all([
      import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"),
      import("@/lib/mcp/create-server"),
    ]);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createPagesCmsMcpServer(auth);
  await server.connect(transport);
  return transport.handleRequest(request);
};

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
    },
  });
}
