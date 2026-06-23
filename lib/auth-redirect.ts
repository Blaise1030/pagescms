import { DASHBOARD_PATH } from "@/lib/routes";

const getSafeRedirect = (redirectTo?: string) => {
  if (!redirectTo) return DASHBOARD_PATH;
  return redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    ? redirectTo
    : DASHBOARD_PATH;
};

const getAuthCallbackURL = (redirectTo?: string) => {
  const safeRedirect = getSafeRedirect(redirectTo);
  return safeRedirect === DASHBOARD_PATH
    ? DASHBOARD_PATH
    : `/auth/redirect?to=${encodeURIComponent(safeRedirect)}`;
};

export { getAuthCallbackURL, getSafeRedirect };
