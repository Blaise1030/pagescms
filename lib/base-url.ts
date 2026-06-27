const DEV_BASE_URL = "http://localhost:3000";

export const normalizeUrl = (url: string) => url.replace(/\/$/, "");

export const getBaseUrl = () => {
  const baseUrl = process.env.BASE_URL?.trim();

  if (baseUrl) {
    return normalizeUrl(baseUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_BASE_URL;
  }

  throw new Error("Missing BASE_URL. Set BASE_URL in production.");
};

/** Canonical production URL used for OAuth callbacks (preview/local proxy through this). */
export const getProductionUrl = () => {
  const productionUrl = process.env.AUTH_PRODUCTION_URL?.trim();
  if (productionUrl) {
    return normalizeUrl(productionUrl);
  }

  const baseUrl = getBaseUrl();
  const isPreviewHost = /-pagescms-staging\./.test(baseUrl);

  if (process.env.NODE_ENV === "production" && isPreviewHost) {
    throw new Error(
      "AUTH_PRODUCTION_URL is required on preview deployments. Set it to the production CMS URL.",
    );
  }

  return baseUrl;
};

/** Production OAuth callback host — never inferred from the incoming request host. */
export const getOAuthProductionUrl = () => {
  const fromEnv = process.env.AUTH_PRODUCTION_URL?.trim();
  if (fromEnv) {
    return normalizeUrl(fromEnv);
  }

  const baseUrl = process.env.BASE_URL?.trim();
  if (baseUrl && !/-pagescms-staging\./.test(baseUrl)) {
    return normalizeUrl(baseUrl);
  }

  throw new Error(
    "AUTH_PRODUCTION_URL is required when deploying preview/staging workers.",
  );
};

/** Host patterns allowed for per-request base URL resolution on Workers. */
export function getAuthBaseUrlConfig() {
  const fallback =
    process.env.AUTH_PRODUCTION_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    DEV_BASE_URL;

  return {
    allowedHosts: [
      "localhost:3000",
      "pagescms.nocodemonkeys1.workers.dev",
      "pagescms-staging.nocodemonkeys1.workers.dev",
      "pr-*-pagescms-staging.nocodemonkeys1.workers.dev",
      "*-pagescms-staging.nocodemonkeys1.workers.dev",
    ],
    fallback,
    protocol: "auto" as const,
  };
}

/** GitHub OAuth redirect URI — always the production callback, never the preview host. */
export const getGithubOAuthRedirectUri = () =>
  `${getOAuthProductionUrl()}/api/auth/callback/github`;
