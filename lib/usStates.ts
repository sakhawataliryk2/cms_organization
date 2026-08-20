/** 50 US states + DC. Codes are ISO-style two-letter abbreviations. */

export type UsState = {
  code: string;
  name: string;
};

export const US_STATES: UsState[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

function normalizeStateToken(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve a free-text state (code, name, or mixed) to a US_STATES entry. */
export function resolveUsState(value: string | null | undefined): UsState | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (raw.length === 2) {
    const byCode = US_STATES.find((s) => s.code === upper);
    if (byCode) return byCode;
  }

  const normalized = normalizeStateToken(raw);
  const byName = US_STATES.find((s) => normalizeStateToken(s.name) === normalized);
  if (byName) return byName;

  // "MA - Massachusetts", "Massachusetts (MA)", "MA, Massachusetts"
  const codeMatch = raw.match(/\b([A-Za-z]{2})\b/);
  if (codeMatch) {
    const byEmbeddedCode = US_STATES.find((s) => s.code === codeMatch[1].toUpperCase());
    if (byEmbeddedCode) {
      const hasName = normalized.includes(normalizeStateToken(byEmbeddedCode.name));
      if (hasName || raw.length <= 4) return byEmbeddedCode;
    }
  }

  return null;
}

/**
 * Pull a US state out of an address / location string.
 * Prefers ZIP-adjacent codes ("Dracut, MA 01826") so short tokens like "MA"
 * are not confused with words that merely contain those letters.
 */
export function extractUsStateFromText(text: string | null | undefined): UsState | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const zipAdjacent = raw.match(/\b([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipAdjacent) {
    const byCode = US_STATES.find((s) => s.code === zipAdjacent[1].toUpperCase());
    if (byCode) return byCode;
  }

  const commaCode = raw.match(/,\s*([A-Za-z]{2})\b/);
  if (commaCode) {
    const byCode = US_STATES.find((s) => s.code === commaCode[1].toUpperCase());
    if (byCode) return byCode;
  }

  const resolved = resolveUsState(raw);
  if (resolved) return resolved;

  for (const state of US_STATES) {
    const nameRe = new RegExp(`\\b${state.name.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (nameRe.test(raw)) return state;
  }

  return null;
}

/**
 * Map a parsed state value onto a select field's allowed options
 * (full name, code, or "MA - Massachusetts"). Never uses substring matching
 * like "ma" inside "Alabama".
 */
export function matchStateToOption(
  value: string | null | undefined,
  options: string[],
  fallbackText?: string | null
): string {
  const resolved =
    resolveUsState(value) ||
    extractUsStateFromText(value) ||
    extractUsStateFromText(fallbackText);

  if (!resolved) return "";

  const opts = (options || []).map((o) => String(o).trim()).filter(Boolean);
  if (opts.length === 0) return resolved.name;

  const nameNorm = normalizeStateToken(resolved.name);
  const codeNorm = resolved.code.toLowerCase();

  const exactName = opts.find((o) => normalizeStateToken(o) === nameNorm);
  if (exactName) return exactName;

  const exactCode = opts.find((o) => normalizeStateToken(o) === codeNorm);
  if (exactCode) return exactCode;

  const combined = opts.find((o) => {
    const n = normalizeStateToken(o);
    return n.includes(nameNorm) && n.includes(codeNorm);
  });
  if (combined) return combined;

  return "";
}
