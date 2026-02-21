/**
 * Extract raw text from resume files (PDF, DOCX, TXT, etc.) for parsing.
 * Used by both admin/parse-resume and public parse-resume (AI) flows.
 */

export const RESUME_EXT = new Set(["pdf", "doc", "docx", "txt", "rtf"]);

export function isResumeFile(name: string, type: string): boolean {
  const ext = name.toLowerCase().split(".").pop() || "";
  return (
    RESUME_EXT.has(ext) ||
    type.includes("pdf") ||
    type.includes("word") ||
    type.includes("document") ||
    type === "text/plain" ||
    type.includes("rtf")
  );
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.toLowerCase().split(".").pop() || "").toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === "txt" || file.type === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text ?? "";
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result?.value || "";
  }

  if (ext === "doc" || ext === "rtf") {
    return buffer.toString("utf-8", 0, Math.min(buffer.length, 100000));
  }

  return buffer.toString("utf-8");
}
