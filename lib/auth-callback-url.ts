/** Build an absolute callback URL so OAuth can return to the current preview host. */
export function getAbsoluteAuthCallbackURL(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}
