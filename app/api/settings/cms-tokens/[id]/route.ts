import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { revokeCmsToken } from "@/lib/cms-token";
import { toErrorResponse } from "@/lib/api-error";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const revoked = await revokeCmsToken(session.user.id, id);
    if (!revoked) return Response.json({ error: "Token not found." }, { status: 404 });

    return Response.json({ status: "success" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
