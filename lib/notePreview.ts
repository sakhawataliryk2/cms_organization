/** Plain one-line preview for collapsed notes (strip HTML / extra whitespace). */
export function noteCommentPreview(text: unknown, maxChars = 90): string {
  const raw = String(text ?? "");
  if (!raw.trim()) return "";
  const plain = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars).trimEnd()}...`;
}
