import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { collaboratorTable } from "@/db/schema";
import { requireGithubRepoWriteAccess } from "@/lib/authz-server";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import {
  addCollaborators,
  removeCollaborator,
  resendCollaboratorInvite,
} from "@/lib/collaborator-mutations";
import { requireApiUserSession } from "@/lib/session-server";

/**
 * Collaborator management for a repository.
 *
 * GET    /api/collaborators/[owner]/[repo]
 * POST   /api/collaborators/[owner]/[repo]
 * DELETE /api/collaborators/[owner]/[repo]/[id]
 * POST   /api/collaborators/[owner]/[repo]/[id]/resend
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const params = await context.params;
    const sessionResult = await requireApiUserSession();
    if ("response" in sessionResult) return sessionResult.response;

    if (!params.slug || params.slug.length !== 2) {
      throw createHttpError("Invalid slug: owner and repo are mandatory", 400);
    }

    const owner = params.slug[0];
    const repo = params.slug[1];

    const { repoAccess } = await requireGithubRepoWriteAccess(
      sessionResult.user,
      owner,
      repo,
      "Only GitHub users can manage collaborators.",
    );

    const collaborators = await db.query.collaboratorTable.findMany({
      where: and(
        eq(collaboratorTable.ownerId, repoAccess.ownerId),
        eq(collaboratorTable.repoId, repoAccess.repoId)
      )
    });

    return Response.json({
      status: "success",
      data: collaborators,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const params = await context.params;
    const sessionResult = await requireApiUserSession();
    if ("response" in sessionResult) return sessionResult.response;

    if (!params.slug || params.slug.length < 2) {
      throw createHttpError("Invalid slug: owner and repo are mandatory", 400);
    }

    const owner = params.slug[0];
    const repo = params.slug[1];

    if (params.slug.length === 4 && params.slug[3] === "resend") {
      const collaboratorId = Number(params.slug[2]);
      if (!Number.isInteger(collaboratorId)) {
        throw createHttpError("Invalid collaborator id", 400);
      }

      const result = await resendCollaboratorInvite(sessionResult.user, {
        owner,
        repo,
        collaboratorId,
      });

      return Response.json({
        status: "success",
        ...result,
      });
    }

    if (params.slug.length !== 2) {
      throw createHttpError("Invalid collaborator route", 400);
    }

    const body = await request.json();
    const emailsValidation = z.object({
      emails: z.array(z.string().email()).min(1),
    }).safeParse(body);

    if (!emailsValidation.success) {
      throw createHttpError("Invalid email list", 400);
    }

    const result = await addCollaborators(sessionResult.user, {
      owner,
      repo,
      emails: emailsValidation.data.emails,
    });

    return Response.json({
      status: "success",
      ...result,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const params = await context.params;
    const sessionResult = await requireApiUserSession();
    if ("response" in sessionResult) return sessionResult.response;

    if (!params.slug || params.slug.length !== 3) {
      throw createHttpError("Invalid slug: owner, repo, and collaborator id are mandatory", 400);
    }

    const owner = params.slug[0];
    const repo = params.slug[1];
    const collaboratorId = Number(params.slug[2]);
    if (!Number.isInteger(collaboratorId)) {
      throw createHttpError("Invalid collaborator id", 400);
    }

    const result = await removeCollaborator(sessionResult.user, {
      owner,
      repo,
      collaboratorId,
    });

    return Response.json({
      status: "success",
      ...result,
    });
  } catch (error: unknown) {
    console.error(error);
    return toErrorResponse(error);
  }
}
