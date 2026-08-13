/**
 * Build a browser-safe URL for opening stored documents.
 * Private S3 (and legacy Blob) URLs must go through the authenticated proxy —
 * never open the raw object URL in the browser (CORS / 403).
 */
export function getDocumentOpenUrl(filePath: string | null | undefined): string {
  const path = String(filePath || "").trim();
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return `/api/documents/proxy?url=${encodeURIComponent(path)}`;
  }
  return path;
}

export function isAbsoluteDocumentUrl(filePath: string | null | undefined): boolean {
  const path = String(filePath || "").trim();
  return path.startsWith("http://") || path.startsWith("https://");
}
