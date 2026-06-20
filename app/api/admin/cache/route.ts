import { requireAdminSession } from "@/lib/admin";
import { toErrorResponse } from "@/lib/api-error";
import { resetGlobalCache } from "@/lib/admin-mutations";

export async function POST() {
  try {
    await requireAdminSession();
    await resetGlobalCache();

    return Response.json({
      status: "success",
      success: true,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
