import { requireAdminSession } from "@/lib/admin";
import { toErrorResponse } from "@/lib/api-error";
import { logoutAllUsers } from "@/lib/admin-mutations";

export async function DELETE() {
  try {
    await requireAdminSession();
    await logoutAllUsers();

    return Response.json({
      status: "success",
      success: true,
      redirectTo: "/sign-in",
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
