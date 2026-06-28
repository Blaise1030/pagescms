import { createHttpError } from "@/lib/api-error";
import { getConfig } from "@/lib/config-store";
import {
  toContentServiceContext,
  toContentServiceReadContext,
  type ContentServiceContext,
  type ContentServiceReadContext,
} from "@/lib/content-service";
import type { CmsTokenScopes } from "@/lib/cms-token";
import { getToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";
import type { User } from "@/types/user";

type McpAuth = {
  user: User;
  scopes: CmsTokenScopes;
};

const assertScope = (scopes: CmsTokenScopes, operation: "read" | "write") => {
  if (operation === "read" && !scopes.read) {
    throw createHttpError("Token does not have read scope.", 403);
  }
  if (operation === "write" && !scopes.write) {
    throw createHttpError("Token does not have write scope.", 403);
  }
};

const resolveMcpRepoContext = async (
  auth: McpAuth,
  args: { owner: string; repo: string; branch: string },
  operation: "read" | "write" = "read",
): Promise<ContentServiceContext> => {
  assertScope(auth.scopes, operation);

  const { token } = await getToken(auth.user, args.owner, args.repo, operation === "write");
  if (!token) throw createHttpError("GitHub token not found for repository.", 401);

  const config = await getConfig(args.owner, args.repo, args.branch, {
    getToken: async () => token,
  });
  if (!config) {
    throw createHttpError(
      `Configuration not found for ${args.owner}/${args.repo}/${args.branch}.`,
      404,
    );
  }

  return toContentServiceContext(args, { user: auth.user, token, config });
};

const resolveMcpReadContext = async (
  auth: McpAuth,
  args: { owner: string; repo: string; branch: string },
  operation: "read" | "write" = "read",
): Promise<ContentServiceReadContext> => {
  const base = await resolveMcpRepoContext(auth, args, operation);
  const octokit = createOctokitInstance(base.token);
  return toContentServiceReadContext(args, {
    user: base.user,
    token: base.token,
    config: base.config,
    octokit,
  });
};

export { resolveMcpReadContext, resolveMcpRepoContext };
export type { McpAuth };
