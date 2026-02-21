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
    const mod = await import("pdf-parse");
    const PDFParse = (mod as { PDFParse?: new (opts: { data: Buffer }) => { getText(): Promise<{ text?: string }> } }).PDFParse;
    if (PDFParse && typeof PDFParse === "function") {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result?.text || "";
    }
    const legacyPdfParse = (mod as { default?: (buf: Buffer) => Promise<{ text?: string }> }).default;
    if (typeof legacyPdfParse === "function") {
      const data = await legacyPdfParse(buffer);
      return data?.text || "";
    }
    throw new Error("pdf-parse: could not find PDFParse class or default function.");
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
