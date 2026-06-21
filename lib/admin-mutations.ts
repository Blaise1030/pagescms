import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cacheFileMetaTable,
  cacheFileTable,
  cachePermissionTable,
  configTable,
  sessionTable,
} from "@/db/schema";

const resetGlobalCache = async () => {
  await db.transaction(async (tx) => {
    await tx.delete(cacheFileTable);
    await tx.delete(cachePermissionTable);
    await tx.delete(configTable);
    await tx.delete(cacheFileMetaTable);
  });

  return { success: true };
};

const logoutUserSessions = async (userId: string) => {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  return { success: true };
};

const logoutAllUsers = async () => {
  await db.delete(sessionTable);
  return { success: true };
};

export { logoutAllUsers, logoutUserSessions, resetGlobalCache };
