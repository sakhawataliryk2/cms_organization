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
