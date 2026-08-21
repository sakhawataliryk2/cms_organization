/**
 * Click-to-call (Zoom) phone fields are detected by label, not a hardcoded
 * field_name. Admin Center labels can change; these phrases stay stable enough
 * to match Main Phone, Mobile Phone, and similar.
 */
export const CLICK_TO_CALL_PHONE_LABELS = [
  "main phone",
  "mobile phone",
  "direct line",
  "phone line",
  "work phone",
] as const;

function normalizeNeedle(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isClickToCallPhoneField(parts: {
  label?: unknown;
  key?: unknown;
  fieldName?: unknown;
  fieldType?: unknown;
}): boolean {
  const type = normalizeNeedle(parts.fieldType);
  if (type === "phone" || type === "tel") return true;

  const haystacks = [parts.label, parts.key, parts.fieldName]
    .map(normalizeNeedle)
    .filter(Boolean);

  return haystacks.some((text) =>
    CLICK_TO_CALL_PHONE_LABELS.some((needle) => text.includes(needle)),
  );
}

export function shouldShowClickToCallButton(
  value: unknown,
  parts: {
    label?: unknown;
    key?: unknown;
    fieldName?: unknown;
    fieldType?: unknown;
  },
): boolean {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw === "No phone provided") return false;
  return isClickToCallPhoneField(parts);
}
