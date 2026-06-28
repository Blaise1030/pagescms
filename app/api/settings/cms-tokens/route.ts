import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createCmsToken, listCmsTokens } from "@/lib/cms-token";
import { toErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tokens = await listCmsTokens(session.user.id);
    return Response.json({ status: "success", data: tokens });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      name?: string;
      scopes?: { read?: boolean; write?: boolean };
    };
    if (!body.name?.trim()) {
      return Response.json({ error: "Token name is required." }, { status: 400 });
    }

    const created = await createCmsToken(session.user.id, body.name.trim(), {
      read: body.scopes?.read ?? true,
      write: body.scopes?.write ?? true,
    });

    return Response.json({
      status: "success",
      data: {
        id: created.id,
        name: created.name,
        token: created.token,
        tokenPrefix: created.tokenPrefix,
        scopes: created.scopes,
        createdAt: created.createdAt,
      },
      message: "Copy this token now. It will not be shown again.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
