import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cmsTokenTable, userTable } from "@/db/schema";
import type { User } from "@/types/user";

const CMS_TOKEN_PREFIX = "cms_pat_";

const hashToken = async (token: string): Promise<string> => {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const generateTokenValue = () => `${CMS_TOKEN_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;

type CmsTokenScopes = { read: boolean; write: boolean };

const createCmsToken = async (
  userId: string,
  name: string,
  scopes: CmsTokenScopes = { read: true, write: true },
) => {
  const token = generateTokenValue();
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const tokenPrefix = token.slice(-8);

  await db.insert(cmsTokenTable).values({
    id,
    userId,
    name,
    tokenHash,
    tokenPrefix,
    scopes,
    createdAt: new Date(),
  });

  return { id, token, tokenPrefix, name, scopes, createdAt: new Date() };
};

const listCmsTokens = async (userId: string) => {
  return db.query.cmsTokenTable.findMany({
    where: eq(cmsTokenTable.userId, userId),
    columns: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
};

const revokeCmsToken = async (userId: string, tokenId: string) => {
  const existing = await db.query.cmsTokenTable.findFirst({
    where: eq(cmsTokenTable.id, tokenId),
  });
  if (!existing || existing.userId !== userId) return false;
  await db.delete(cmsTokenTable).where(eq(cmsTokenTable.id, tokenId));
  return true;
};

const authenticateCmsToken = async (authorizationHeader: string | null) => {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token.startsWith(CMS_TOKEN_PREFIX)) return null;

  const tokenHash = await hashToken(token);
  const record = await db.query.cmsTokenTable.findFirst({
    where: eq(cmsTokenTable.tokenHash, tokenHash),
  });
  if (!record) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(cmsTokenTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(cmsTokenTable.id, record.id));

  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, record.userId),
  });
  if (!user) return null;

  const mappedUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    githubUsername: user.githubUsername ?? undefined,
  };

  return {
    user: mappedUser,
    tokenId: record.id,
    scopes: record.scopes,
  };
};

export {
  authenticateCmsToken,
  createCmsToken,
  hashToken,
  listCmsTokens,
  revokeCmsToken,
};
export type { CmsTokenScopes };
