/**
 * Normalize raw import / Postgres / API error strings into short user-facing causes
 * so the import summary can group thousands of identical failures.
 */
export function humanizeImportError(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "Unknown error";

  const lower = s.toLowerCase();

  if (
    /skipped as per import option/i.test(s) ||
    /already exists in the system/i.test(s) ||
    /already exists/i.test(lower) ||
    /duplicate key/i.test(lower) ||
    /duplicate_?\w*idx/i.test(lower) ||
    /unique constraint/i.test(lower) ||
    /\b23505\b/.test(lower) ||
    /violates unique/i.test(lower)
  ) {
    return "Duplicate record — already exists (skipped or rejected)";
  }

  if (
    /not null/i.test(lower) ||
    /null value/i.test(lower) ||
    /required/i.test(lower) ||
    /missing/i.test(lower)
  ) {
    return "Missing required field";
  }

  if (
    /foreign key/i.test(lower) ||
    /violates foreign key/i.test(lower) ||
    /\b23503\b/.test(lower) ||
    /invalid.*(reference|lookup|organization|job seeker|hiring manager)/i.test(
      lower,
    )
  ) {
    return "Invalid related record / lookup reference";
  }

  if (/timeout|timed out|etimedout|abort/i.test(lower)) {
    return "Request timed out";
  }

  if (/network|fetch failed|econnrefused|enotfound/i.test(lower)) {
    return "Network / server connection error";
  }

  if (/permission|forbidden|unauthorized|401|403/i.test(lower)) {
    return "Permission denied";
  }

  // Strip verbose Postgres prefixes while keeping the useful part.
  const constraintMatch = s.match(
    /unique constraint ["']?([^"'\s]+)["']?/i,
  );
  if (constraintMatch) {
    return `Duplicate value (constraint: ${constraintMatch[1]})`;
  }

  // Keep messages readable; avoid dumping huge SQL snippets.
  if (s.length > 180) return `${s.slice(0, 177)}...`;
  return s;
}

export type GroupedImportError = {
  cause: string;
  count: number;
  rows: number[];
};

/** Group per-row import errors by humanized cause. */
export function groupImportErrorsByCause(
  errors: Array<{ row: number; errors: string[] }>,
): GroupedImportError[] {
  const map = new Map<string, GroupedImportError>();

  for (const entry of errors) {
    const messages =
      entry.errors?.length > 0 ? entry.errors : ["Unknown error"];
    for (const msg of messages) {
      const cause = humanizeImportError(msg);
      let group = map.get(cause);
      if (!group) {
        group = { cause, count: 0, rows: [] };
        map.set(cause, group);
      }
      group.count += 1;
      group.rows.push(entry.row);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Normalize Resume DOCX backfill / Blob / packer errors into short causes.
 */
export function humanizeResumeDocxError(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "Unknown error while creating Resume DOCX";

  const lower = s.toLowerCase();

  if (
    /blob_read_write_token|no token|missing.*token|blob.*not configured|unauthorized.*blob|access denied.*blob/i.test(
      lower,
    )
  ) {
    return "Blob storage not configured or unauthorized (check BLOB_READ_WRITE_TOKEN)";
  }

  if (/\b429\b|rate limit|too many requests|throttl/i.test(lower)) {
    return "Blob storage rate limited — too many parallel uploads";
  }

  if (
    /\b413\b|entity too large|payload too large|file too large|request entity|max 500,000|too large to convert/i.test(
      lower,
    )
  ) {
    return "Resume text / DOCX file too large for upload";
  }

  if (/timeout|timed out|etimedout|abort|econnreset|socket hang up/i.test(lower)) {
    return "Upload timed out or connection dropped";
  }

  if (/network|fetch failed|econnrefused|enotfound|dns/i.test(lower)) {
    return "Network error talking to blob storage";
  }

  if (
    /out of memory|heap|maximum call stack|invalid string length|string length|failed to convert resume text/i.test(
      lower,
    )
  ) {
    return "Resume text too large or malformed to convert to DOCX";
  }

  if (/permission|forbidden|unauthorized|\b401\b|\b403\b/i.test(lower)) {
    return "Permission denied while saving Resume document";
  }

  if (
    /foreign key|violates|duplicate key|unique constraint|\b23505\b|\b23503\b|database insert failed/i.test(
      lower,
    )
  ) {
    return "Database rejected the Resume document row";
  }

  if (/resumetext is empty|resume text is empty|empty resume/i.test(lower)) {
    return "Resume text was empty after import";
  }

  if (/blob upload failed/i.test(lower)) {
    return s.length > 180 ? `${s.slice(0, 177)}...` : s;
  }

  if (s.length > 180) return `${s.slice(0, 177)}...`;
  return s;
}

export type GroupedResumeDocxError = {
  cause: string;
  count: number;
  recordNumbers: string[];
};

/** Group Resume DOCX backfill item failures by humanized cause. */
export function groupResumeDocxErrorsByCause(
  errors: Array<{
    id?: number | string;
    recordNumber?: string | number | null;
    message?: string;
    cause?: string;
  }>,
): GroupedResumeDocxError[] {
  const map = new Map<string, GroupedResumeDocxError>();

  for (const entry of errors || []) {
    const cause =
      (entry.cause && String(entry.cause).trim()) ||
      humanizeResumeDocxError(entry.message || "");
    let group = map.get(cause);
    if (!group) {
      group = { cause, count: 0, recordNumbers: [] };
      map.set(cause, group);
    }
    group.count += 1;
    const rn =
      entry.recordNumber != null && String(entry.recordNumber).trim()
        ? String(entry.recordNumber)
        : entry.id != null
          ? `id:${entry.id}`
          : null;
    if (rn && group.recordNumbers.length < 50) {
      group.recordNumbers.push(rn);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
