/**
 * Normalize messy date strings (CSV/Excel exports, manual entry) to ISO date YYYY-MM-DD
 * and consistent mm/dd/yyyy display. Avoids `new Date(string)` which is invalid for values
 * like "1/6/69" and causes UI fallbacks to "today".
 */

/** Excel-style 2-digit year: 00–29 → 2000–2029, 30–99 → 1930–1999 */
export function expandTwoDigitYear(yy: number): number {
  if (yy >= 0 && yy <= 99) {
    if (yy <= 29) return 2000 + yy;
    return 1900 + yy;
  }
  return yy;
}

export type DateParts = { y: number; m: number; d: number };

export function parseFlexibleDateStringToParts(value: string): DateParts | null {
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === mo - 1 &&
      dt.getDate() === d
    ) {
      return { y, m: mo, d };
    }
    return null;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const mo = parseInt(m[1], 10);
    const d = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) y = expandTwoDigitYear(y);
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === mo - 1 &&
      dt.getDate() === d
    ) {
      return { y, m: mo, d };
    }
  }

  return null;
}

export function formatPartsToIso(parts: DateParts): string {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

/** mm/dd/yyyy for display (matches date input mask in CustomFieldRenderer) */
export function formatPartsToDisplayMMDDYYYY(parts: DateParts): string {
  return `${String(parts.m).padStart(2, "0")}/${String(parts.d).padStart(2, "0")}/${parts.y}`;
}

export function normalizeDateInputToIso(value: string): string | null {
  const parts = parseFlexibleDateStringToParts(value);
  return parts ? formatPartsToIso(parts) : null;
}

export function normalizeDateInputToDisplay(value: string): string | null {
  const parts = parseFlexibleDateStringToParts(value);
  return parts ? formatPartsToDisplayMMDDYYYY(parts) : null;
}
