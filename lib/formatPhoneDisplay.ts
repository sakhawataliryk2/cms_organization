/**
 * Consistent display formatting for phone numbers (US/NANP + international).
 * Used by FieldValueRenderer, Zoom/call notes, and inline note text.
 */

/** Matches common date-only strings so we don't treat them as phones */
const DATE_ONLY_VALUE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;

const DATE_LIKE_IN_PHONE_CHUNK = /^\d{1,2}[/.-]\d{1,2}/;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function groupNationalTen(n: string): string {
  if (n.length !== 10) return n;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

function groupNationalFlexible(n: string): string {
  const L = n.length;
  if (L === 10) return groupNationalTen(n);
  if (L === 9) return groupFromRightThrees(n);
  if (L === 8) return `${n.slice(0, 4)} ${n.slice(4)}`;
  return groupFromRightThrees(n);
}

function groupFromRightThrees(s: string): string {
  const parts: string[] = [];
  let rest = s;
  while (rest.length > 3) {
    parts.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest) parts.unshift(rest);
  return parts.join(" ");
}

function formatInternationalDigits(digits: string): string {
  if (digits.length < 8) {
    return digits.length ? `+${digits}` : "";
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length >= 11 && digits.length <= 12) {
    const cc2 = digits.slice(0, 2);
    if (/^[2-9]\d$/.test(cc2)) {
      const nat = digits.slice(2);
      if (nat.length >= 8 && nat.length <= 10) {
        return `+${cc2} ${groupNationalFlexible(nat)}`;
      }
    }
  }

  if (digits.length >= 10 && digits.length <= 15) {
    for (const ccLen of [3, 2] as const) {
      if (digits.length - ccLen < 4) continue;
      const cc = digits.slice(0, ccLen);
      const nat = digits.slice(ccLen);
      if (nat.length < 4 || nat.length > 12) continue;
      if (ccLen === 2 && cc === "1") continue;
      return `+${cc} ${groupNationalFlexible(nat)}`;
    }
  }

  if (digits.length > 15) {
    return `+${groupFromRightThrees(digits)}`;
  }

  return `+${groupNationalFlexible(digits)}`;
}

/**
 * Format a phone string for display. Handles NANP (10/11 digits) and common international lengths.
 * Optional "ext. 123" suffix is preserved.
 */
export function formatPhoneForDisplay(input: string | null | undefined): string {
  if (input == null) return "";
  const trimmed = String(input).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower === "unknown" || lower === "n/a" || lower === "—") return trimmed;

  const extMatch = trimmed.match(/\s*(?:ext\.?|extension|x)\s*(\d+)\s*$/i);
  let base = trimmed;
  let extSuffix = "";
  if (extMatch && extMatch.index != null) {
    extSuffix = ` ext. ${extMatch[1]}`;
    base = trimmed.slice(0, extMatch.index).trim();
  }

  const digits = digitsOnly(base);
  if (digits.length === 0) return trimmed;

  if (DATE_LIKE_IN_PHONE_CHUNK.test(base) && digits.length <= 8) {
    return trimmed;
  }

  let formatted: string;

  if (digits.length === 10) {
    formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length >= 8 && digits.length <= 15) {
    formatted = formatInternationalDigits(digits);
  } else if (digits.length < 10) {
    formatted = base.startsWith("+") ? `+${digits}` : digits;
  } else {
    formatted = `+${groupFromRightThrees(digits)}`;
  }

  return formatted + extSuffix;
}

/** Digits only for tel: / SMS links */
export function phoneDigitsForTel(input: string | null | undefined): string {
  return digitsOnly(String(input ?? ""));
}

/**
 * True when the string is likely a phone (not a date, not an email) for auto-formatting in grids.
 */
export function isPhoneLikeValue(
  str: string,
  opts: {
    fieldType?: string;
    label?: string;
    key?: string;
  } = {}
): boolean {
  const { fieldType = "", label = "", key = "" } = opts;
  const ft = fieldType.toLowerCase();
  const meta = `${label} ${key}`.toLowerCase();

  const d = digitsOnly(str);
  if (d.length < 10 || d.length > 15) return false;

  const t = str.trim();
  if (DATE_ONLY_VALUE_PATTERN.test(t)) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;

  if (ft === "phone" || ft === "tel") return true;
  if (/(phone|mobile|cell|cellphone|telephone|fax|whatsapp|sms|zoom.*line)/i.test(meta)) return true;

  if (/^[\d\s+().\-]+$/i.test(t.replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, ""))) {
    return true;
  }

  return false;
}
