const DEV_BASE_URL = "http://localhost:3000";

const normalizeUrl = (url: string) => url.replace(/\/$/, "");

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
  return getBaseUrl();
};
