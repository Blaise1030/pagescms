import { createAuthMiddleware } from "better-auth/api";
import { getBaseUrl, getProductionUrl } from "@/lib/base-url";

/**
 * Ensures GitHub OAuth always uses the production callback URL on preview/staging
 * hosts. better-auth builds redirect_uri from ctx.context.baseURL, which would
 * otherwise point at the preview hostname and be rejected by GitHub.
 */
export function oauthProductionRedirect() {
  return {
    id: "pagescms-oauth-production-redirect",
    hooks: {
      before: [
        {
          matcher(context: { path?: string }) {
            return !!(
              context.path?.startsWith("/sign-in/social") ||
              context.path?.startsWith("/sign-in/oauth2") ||
              context.path === "/callback/:id"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const productionUrl = getProductionUrl();
            const requestOrigin = new URL(ctx.request.url).origin;
            const appOrigin = new URL(getBaseUrl()).origin;

            if (
              requestOrigin !== productionUrl &&
              appOrigin !== productionUrl
            ) {
              const basePath = ctx.context.options.basePath || "/api/auth";
              ctx.context.baseURL = `${productionUrl}${basePath}`;
            }
          }),
        },
      ],
    },
  };
}
