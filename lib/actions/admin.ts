"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cacheFileMetaTable,
  cacheFileTable,
  cachePermissionTable,
  configTable,
  sessionTable,
} from "@/db/schema";
import { requireAdminSession } from "@/lib/admin";

const resetGlobalCache = async () => {
  await requireAdminSession();

  await db.transaction(async (tx) => {
    await tx.delete(cacheFileTable);
    await tx.delete(cachePermissionTable);
    await tx.delete(configTable);
    await tx.delete(cacheFileMetaTable);
  });

  revalidatePath("/admin");

  return { success: true };
};

const logoutUserSessions = async (userId: string) => {
  const { user } = await requireAdminSession();

  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  revalidatePath("/admin");

  if (user.id === userId) {
    redirect("/sign-in");
  }

  return { success: true };
};

const logoutAllUsers = async () => {
  await requireAdminSession();

  await db.delete(sessionTable);
  redirect("/sign-in");
};

export { logoutAllUsers, logoutUserSessions, resetGlobalCache };
