/**
 * Build a browser-safe URL for opening stored documents.
 * Private S3 (and legacy Blob) URLs must go through the authenticated proxy —
 * never open the raw object URL in the browser (CORS / AccessDenied).
 */
export function getDocumentOpenUrl(filePath: string | null | undefined): string {
  const path = String(filePath || "").trim();
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return `/api/documents/proxy?url=${encodeURIComponent(path)}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function getDocumentDownloadUrl(
  filePath: string | null | undefined,
  filename?: string | null
): string {
  const path = String(filePath || "").trim();
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const params = new URLSearchParams({
      url: path,
      disposition: "attachment",
    });
    const safeName = sanitizeDownloadFilename(filename);
    if (safeName) params.set("filename", safeName);
    return `/api/documents/proxy?${params.toString()}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function isAbsoluteDocumentUrl(filePath: string | null | undefined): boolean {
  const path = String(filePath || "").trim();
  return path.startsWith("http://") || path.startsWith("https://");
}

function sanitizeDownloadFilename(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return "document";
  return raw.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180) || "document";
}

function guessDownloadFilename(doc: {
  document_name?: string | null;
  name?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
}): string {
  const base = sanitizeDownloadFilename(doc.document_name || doc.name || "document");
  if (/\.[a-z0-9]{2,8}$/i.test(base)) return base;

  const path = String(doc.file_path || "");
  const pathExt = path.match(/\.([a-z0-9]{2,8})(?:\?|$)/i)?.[1];
  if (pathExt) return `${base}.${pathExt}`;

  const mime = String(doc.mime_type || "").toLowerCase();
  if (mime.includes("pdf")) return `${base}.pdf`;
  if (mime.includes("wordprocessingml") || mime === "application/msword") {
    return `${base}.docx`;
  }
  if (mime === "text/plain") return `${base}.txt`;
  if (mime.startsWith("image/")) {
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";
    return `${base}.${ext}`;
  }
  return base;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Download a stored document via the authenticated backend proxy (never hits S3 from the browser).
 */
export async function downloadStoredDocument(doc: {
  file_path?: string | null;
  document_name?: string | null;
  name?: string | null;
  mime_type?: string | null;
  content?: string | null;
}): Promise<"ok" | "empty" | "error"> {
  const filename = guessDownloadFilename(doc);

  if (doc.file_path) {
    const url = getDocumentDownloadUrl(doc.file_path, filename);
    try {
      const response = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Document is empty");
      triggerBlobDownload(blob, filename);
      return "ok";
    } catch (error) {
      console.error("Error downloading document:", error);
      return "error";
    }
  }

  if (doc.content) {
    const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
    triggerBlobDownload(blob, filename.endsWith(".txt") ? filename : `${filename}.txt`);
    return "ok";
  }

  return "empty";
}
