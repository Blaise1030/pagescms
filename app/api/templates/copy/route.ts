import { z } from "zod";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireApiUserSession } from "@/lib/session-server";
import { copyTemplate } from "@/lib/template-copy";

export async function POST(request: Request) {
  try {
    const sessionResult = await requireApiUserSession();
    if ("response" in sessionResult) return sessionResult.response;

    const body = await request.json();
    const validation = z.object({
      template: z.string().trim().min(1),
      owner: z.string().trim().min(1),
      name: z.string().trim().min(1),
    }).safeParse(body);

    if (!validation.success) {
      throw createHttpError("Invalid template copy request", 400);
    }

    const result = await copyTemplate(sessionResult.user, validation.data);

    return Response.json({
      status: "success",
      ...result,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
