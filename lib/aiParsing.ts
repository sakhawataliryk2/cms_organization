import { cookies } from "next/headers";

/**
 * Shared types and helpers for AI-powered document parsing
 * (resumes, job orders, organizations, etc.).
 *
 * These utilities are intentionally entity-agnostic so they can be reused
 * across multiple parse-* API routes.
 */

export type CustomFieldDef = {
  field_name: string;
  field_label?: string | null;
  field_type?: string | null;
  is_hidden?: boolean;
  options?: string[] | string | Record<string, unknown> | null;
};

export type FieldMeta = {
  name: string;
  type: string;
  options: string[];
};

/**
 * Normalize the various option encodings used in Field Management
 * (arrays, newline-delimited strings, JSON-encoded arrays, objects)
 * into a clean string[] of trimmed option labels.
 */
export function normalizeOptions(opts: unknown): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts
      .filter((o) => typeof o === "string")
      .map((o) => String(o).trim())
      .filter(Boolean);
  }

  if (typeof opts === "string") {
    const trimmed = opts.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeOptions(parsed);
    } catch {
      // fall through to newline-split
    }
    return trimmed
      .split(/\r?\n/)
      .map((o) => o.trim())
      .filter(Boolean);
  }

  if (typeof opts === "object") {
    return Object.values(opts)
      .filter((o) => typeof o === "string")
      .map((o) => String(o).trim())
      .filter(Boolean);
  }

  return [];
}

/** Normalize strings for loose semantic comparison (case/spacing/punctuation). */
export function normalizeStr(v: string): string {
  return v.toLowerCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
}

function semanticIncludes(a: string, b: string): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  return na.includes(nb) || nb.includes(na);
}

/**
 * Find the closest matching option for a free-text value using simple semantic
 * heuristics (exact match, inclusion, reversed inclusion).
 */
export function findClosestOption(value: string, options: string[]): string | null {
  if (!value || options.length === 0) return null;
  const normalizedValue = normalizeStr(value);

  // Exact match
  for (const opt of options) {
    if (normalizeStr(opt) === normalizedValue) return opt;
  }

  // Inclusion match (either side)
  for (const opt of options) {
    if (semanticIncludes(normalizedValue, opt)) return opt;
  }

  // Option contains the full value (e.g. "full" → "Full-Time")
  for (const opt of options) {
    if (normalizeStr(opt).includes(normalizedValue)) return opt;
  }

  return null;
}

/**
 * Build the SELECTABLE FIELDS explanation block and the `"custom_fields"` JSON
 * snippet used inside entity-specific system prompts.
 *
 * The returned strings are meant to be interpolated into a larger prompt and
 * JSON schema that is specific to each entity type.
 */
export function buildCustomFieldPromptInfo(customFields: CustomFieldDef[]): {
  selectBlock: string;
  customBlock: string;
} {
  const visible = customFields.filter((f) => !f.is_hidden && f.field_name);

  const selectFields: Array<{ name: string; label: string; options: string[] }> = [];

  for (const f of visible) {
    const opts = normalizeOptions(f.options);
    const label = (f.field_label || f.field_name).replace(/"/g, "'");
    const type = (f.field_type || "text").toLowerCase();
    if ((type === "select" || type === "radio") && opts.length > 0) {
      selectFields.push({ name: f.field_name, label, options: opts });
    }
  }

  let customFieldEntries = "";
  if (visible.length > 0) {
    const lines: string[] = [];
    for (const f of visible) {
      const sf = selectFields.find((s) => s.name === f.field_name);
      if (sf) {
        lines.push(
          `    "${f.field_name}": ""  // SELECT: ${sf.label}. MUST be exactly one of: [${sf.options
            .map((o) => `"${o}"`)
            .join(", ")}]. Choose closest match or "" if none.`
        );
      } else {
        lines.push(
          `    "${f.field_name}": ""  // value for: ${(f.field_label || f.field_name).replace(
            /"/g,
            "'"
          )}`
        );
      }
    }
    customFieldEntries = lines.join(",\n");
  }

  const selectBlock =
    selectFields.length > 0
      ? `

SELECTABLE FIELDS — MUST return only allowed values:
${selectFields
  .map(
    (s) =>
      `- "${s.name}" (${s.label}): allowed options = [${s.options
        .map((o) => `"${o}"`)
        .join(", ")}]. Return exactly one option or "".`
  )
  .join("\n")}

Examples:
- Resume says "Senior Software Engineer" and options include "Senior Level" → return "Senior Level"
- Resume says "full time" and options include "Full-Time" → return "Full-Time"
- Resume says "Freelancer" and options include "Freelance" → return "Freelance"
- No reasonable match → return ""`
      : "";

  const customBlock =
    customFieldEntries.length > 0
      ? `,
  "custom_fields": {
${customFieldEntries}
  }`
      : "";

  return { selectBlock, customBlock };
}

/**
 * Build metadata about visible custom fields for post-processing:
 * - `customFieldNames`: list of field_name values that should be returned.
 * - `selectFieldMeta`: select/radio fields with their allowed options.
 */
export function buildCustomFieldMeta(customFields: CustomFieldDef[]): {
  customFieldNames: string[];
  selectFieldMeta: FieldMeta[];
} {
  const visible = customFields.filter((f) => !f.is_hidden && f.field_name);
  const customFieldNames = visible.map((f) => f.field_name);

  const selectFieldMeta: FieldMeta[] = visible
    .filter((f) => {
      const t = (f.field_type || "text").toLowerCase();
      return (t === "select" || t === "radio") && normalizeOptions(f.options).length > 0;
    })
    .map((f) => ({
      name: f.field_name,
      type: (f.field_type || "text").toLowerCase(),
      options: normalizeOptions(f.options),
    }));

  return { customFieldNames, selectFieldMeta };
}

/**
 * Generic helper to fetch Field Management custom fields for a given entity type
 * from the backend REST API.
 *
 * The entity string should match the backend's `entity_type`:
 *  - "job-seekers"
 *  - "jobs"
 *  - "organizations"
 *  - "hiring-managers"
 *  - "leads"
 *  - etc.
 */
export async function fetchEntityCustomFields(
  entity: string,
  token: string
): Promise<CustomFieldDef[]> {
  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const res = await fetch(`${apiUrl}/api/custom-fields/entity/${entity}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const list = (data as any)?.customFields ?? (data as any)?.data ?? [];

  return Array.isArray(list)
    ? list.filter(
        (f: unknown) =>
          f &&
          typeof f === "object" &&
          typeof (f as CustomFieldDef).field_name === "string"
      )
    : [];
}

