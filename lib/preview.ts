export function getPreviewUrl(
  siteUrl: string | undefined,
  previewPath: string | undefined,
): string | undefined {
  if (!siteUrl || !previewPath) return undefined;
  return `${siteUrl.replace(/\/$/, "")}${previewPath}`;
}
