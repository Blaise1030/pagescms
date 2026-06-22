import { getInstallationRepos, getInstallations } from "@/lib/github-app";
import { requireGithubRepoWriteAccess } from "@/lib/authz-server";
import { InviteEmailTemplate } from "@/components/email/invite";
import { CollaboratorAddedEmailTemplate } from "@/components/email/collaborator-added";
import { sendEmail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/base-url";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { collaboratorInviteTable, collaboratorTable } from "@/db/schema";
import { findVerifiedUserByEmail, normalizeEmail } from "@/lib/collaborator-access";
import { generateInviteToken } from "@/lib/random";
import type { User } from "@/types/user";

const assertRepoInInstallation = async (
  user: Pick<User, "id" | "githubUsername">,
  owner: string,
  repo: string,
) => {
  const { token, repoAccess } = await requireGithubRepoWriteAccess(
    user,
    owner,
    repo,
    "You must be signed in with GitHub to manage collaborators.",
  );
  const installations = await getInstallations(token, [owner]);
  if (installations.length !== 1) {
    throw new Error(`"${owner}" is not part of your GitHub App installations`);
  }

  const installationRepos = await getInstallationRepos(token, installations[0].id);
  const isInstalledForRepo = installationRepos.some((installationRepo) =>
    installationRepo.id === repoAccess.repoId
    || (
      installationRepo.owner?.login?.toLowerCase() === owner.toLowerCase()
      && installationRepo.name?.toLowerCase() === repo.toLowerCase()
    ),
  );
  if (!isInstalledForRepo) {
    throw new Error(`"${owner}/${repo}" is not part of your ${APP_NAME} installation.`);
  }

  return {
    repoAccess,
    installation: installations[0],
  };
};

const createCollaboratorInviteUrl = async ({
  email,
  owner,
  repo,
  baseUrl,
}: {
  email: string;
  owner: string;
  repo: string;
  baseUrl: string;
}) => {
  const token = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + ((Number(process.env.COLLABORATOR_INVITE_LINK_EXPIRES_IN) || 86400) * 1000),
  );

  await db
    .delete(collaboratorInviteTable)
    .where(
      and(
        sql`lower(${collaboratorInviteTable.email}) = lower(${email})`,
        sql`lower(${collaboratorInviteTable.owner}) = lower(${owner})`,
        sql`lower(${collaboratorInviteTable.repo}) = lower(${repo})`,
      ),
    );

  await db.insert(collaboratorInviteTable).values({
    token,
    email,
    owner,
    repo,
    expiresAt,
  });

  const inviteUrl = new URL("/sign-in/collaborator", baseUrl);
  inviteUrl.searchParams.set("token", token);

  return inviteUrl.toString();
};

const addCollaborators = async (
  user: User,
  {
    owner,
    repo,
    emails,
  }: {
    owner: string;
    repo: string;
    emails: string[];
  },
) => {
  const { repoAccess, installation } = await assertRepoInInstallation(user, owner, repo);

  const baseUrl = getBaseUrl();
  const repoUrl = new URL(`/${owner}/${repo}`, baseUrl).toString();
  const createdCollaborators: (typeof collaboratorTable.$inferSelect)[] = [];
  const errors: string[] = [];
  let immediateAccessCount = 0;
  let pendingInviteCount = 0;

  for (const email of emails) {
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await findVerifiedUserByEmail(normalizedEmail);
    const collaborator = await db.query.collaboratorTable.findFirst({
      where: and(
        eq(collaboratorTable.ownerId, repoAccess.ownerId),
        eq(collaboratorTable.repoId, repoAccess.repoId),
        sql`lower(${collaboratorTable.email}) = lower(${normalizedEmail})`,
      ),
    });

    if (collaborator) {
      if (existingUser && collaborator.userId !== existingUser.id) {
        const updated = await db.update(collaboratorTable)
          .set({ userId: existingUser.id })
          .where(eq(collaboratorTable.id, collaborator.id))
          .returning();
        if (updated.length > 0) {
          createdCollaborators.push(...updated);
          immediateAccessCount += 1;
        }
      }
      errors.push(`${normalizedEmail} is already invited to "${owner}/${repo}".`);
      continue;
    }

    if (!existingUser) {
      const inviteUrl = await createCollaboratorInviteUrl({
        email: normalizedEmail,
        owner,
        repo,
        baseUrl,
      });
      try {
        const { render } = await import("@react-email/render");
        const html = await render(
          InviteEmailTemplate({
            inviteUrl,
            repoName: `${owner}/${repo}`,
            email: normalizedEmail,
            invitedByName: user.name || user.githubUsername || user.email,
            invitedByUrl: `https://github.com/${user.githubUsername}`,
          }),
        );
        await sendEmail({
          to: normalizedEmail,
          subject: `Join "${owner}/${repo}" on ${APP_NAME}`,
          html,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to send invitation email to ${normalizedEmail}:`, message);
        errors.push(`${normalizedEmail}: ${message}`);
        continue;
      }
    } else {
      try {
        const { render } = await import("@react-email/render");
        const html = await render(
          CollaboratorAddedEmailTemplate({
            email: normalizedEmail,
            repoName: `${owner}/${repo}`,
            repoUrl,
            invitedByName: user.name || user.githubUsername || user.email,
            invitedByUrl: `https://github.com/${user.githubUsername}`,
          }),
        );
        await sendEmail({
          to: normalizedEmail,
          subject: `You were added to "${owner}/${repo}" on ${APP_NAME}`,
          html,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to send collaborator notification email to ${normalizedEmail}:`, message);
        errors.push(`${normalizedEmail}: ${message}`);
      }
    }

    const inserted = await db.insert(collaboratorTable).values({
      type: repoAccess.ownerType,
      installationId: installation.id,
      ownerId: repoAccess.ownerId,
      repoId: repoAccess.repoId,
      owner: repoAccess.ownerLogin,
      repo: repoAccess.repoName,
      email: normalizedEmail,
      userId: existingUser?.id ?? null,
      invitedBy: user.id,
    }).returning();

    if (inserted.length > 0) {
      createdCollaborators.push(...inserted);
      if (existingUser) {
        immediateAccessCount += 1;
      } else {
        pendingInviteCount += 1;
      }
    }
  }

  if (createdCollaborators.length === 0) {
    throw new Error(errors.join(" "));
  }

  return {
    message:
      immediateAccessCount > 0 && pendingInviteCount > 0
        ? `${immediateAccessCount} collaborator${immediateAccessCount === 1 ? "" : "s"} added immediately and ${pendingInviteCount} invite${pendingInviteCount === 1 ? "" : "s"} sent for "${owner}/${repo}".`
        : immediateAccessCount > 0
          ? `${immediateAccessCount} collaborator${immediateAccessCount === 1 ? "" : "s"} added to "${owner}/${repo}".`
          : pendingInviteCount === 1
            ? `${createdCollaborators[0].email} invited to "${owner}/${repo}".`
            : `${pendingInviteCount} collaborators invited to "${owner}/${repo}".`,
    data: createdCollaborators,
    errors,
  };
};

const removeCollaborator = async (
  user: User,
  {
    owner,
    repo,
    collaboratorId,
  }: {
    owner: string;
    repo: string;
    collaboratorId: number;
  },
) => {
  const collaborator = await db.query.collaboratorTable.findFirst({
    where: eq(collaboratorTable.id, collaboratorId),
  });
  if (!collaborator) throw new Error("Collaborator not found");

  const { repoAccess } = await assertRepoInInstallation(user, owner, repo);

  const deletedCollaborator = await db.delete(collaboratorTable).where(
    and(
      eq(collaboratorTable.id, collaboratorId),
      eq(collaboratorTable.repoId, repoAccess.repoId),
    ),
  ).returning();

  if (!deletedCollaborator || deletedCollaborator.length === 0) {
    throw new Error("Failed to delete collaborator");
  }

  await db
    .delete(collaboratorInviteTable)
    .where(
      and(
        sql`lower(${collaboratorInviteTable.email}) = lower(${collaborator.email})`,
        sql`lower(${collaboratorInviteTable.owner}) = lower(${owner})`,
        sql`lower(${collaboratorInviteTable.repo}) = lower(${repo})`,
      ),
    );

  return {
    message: `Invitation to ${collaborator.email} for "${owner}/${repo}" successfully removed.`,
  };
};

const resendCollaboratorInvite = async (
  user: User,
  {
    owner,
    repo,
    collaboratorId,
  }: {
    owner: string;
    repo: string;
    collaboratorId: number;
  },
) => {
  await assertRepoInInstallation(user, owner, repo);

  const collaborator = await db.query.collaboratorTable.findFirst({
    where: eq(collaboratorTable.id, collaboratorId),
  });
  if (!collaborator) throw new Error("Collaborator not found");

  if (
    collaborator.owner.toLowerCase() !== owner.toLowerCase()
    || collaborator.repo.toLowerCase() !== repo.toLowerCase()
  ) {
    throw new Error("Collaborator does not belong to this repository.");
  }

  const baseUrl = getBaseUrl();
  const inviteUrl = await createCollaboratorInviteUrl({
    email: collaborator.email,
    owner,
    repo,
    baseUrl,
  });

  const { render } = await import("@react-email/render");
  const html = await render(
    InviteEmailTemplate({
      inviteUrl,
      repoName: `${owner}/${repo}`,
      email: collaborator.email,
      invitedByName: user.name || user.githubUsername || user.email,
      invitedByUrl: `https://github.com/${user.githubUsername}`,
    }),
  );

  await sendEmail({
    to: collaborator.email,
    subject: `Join "${owner}/${repo}" on ${APP_NAME}`,
    html,
  });

  return { message: `Invitation email resent to ${collaborator.email}.` };
};

export { addCollaborators, removeCollaborator, resendCollaboratorInvite };
