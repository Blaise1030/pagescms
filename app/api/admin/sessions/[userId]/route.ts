import { requireAdminSession } from "@/lib/admin";
import { toErrorResponse } from "@/lib/api-error";
import { logoutUserSessions } from "@/lib/admin-mutations";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { user } = await requireAdminSession();
    const { userId } = await context.params;
    await logoutUserSessions(userId);

    return Response.json({
      status: "success",
      success: true,
      redirectTo: user.id === userId ? "/sign-in" : null,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
