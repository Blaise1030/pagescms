export function getPreviewUrl(
  siteUrl: string | undefined,
  previewPath: string | undefined,
): string | null {
  if (!siteUrl || !previewPath) return null;
  return `${siteUrl.replace(/\/$/, "")}${previewPath}`;
}
