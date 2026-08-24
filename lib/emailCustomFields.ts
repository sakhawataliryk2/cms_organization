/**
 * Job seekers and hiring managers store emails in custom_fields.
 * Admin Center labels can change; field_name is stable.
 */
export const CONTACT_EMAIL_FIELDS: Record<
  string,
  { fieldName: string; role: "primary" | "secondary" }[]
> = {
  "job-seekers": [
    { fieldName: "Field_8", role: "primary" },
    { fieldName: "Field_9", role: "secondary" },
  ],
  "hiring-managers": [
    { fieldName: "Field_7", role: "primary" },
    { fieldName: "Field_8", role: "secondary" },
  ],
};

export function normalizeContactEntityType(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

export function isContactEmailEntity(entityType: unknown): boolean {
  const key = normalizeContactEntityType(entityType);
  return Boolean(CONTACT_EMAIL_FIELDS[key]?.length);
}

export function isContactEmailField(parts: {
  entityType?: unknown;
  fieldName?: unknown;
  fieldType?: unknown;
}): boolean {
  const entityType = normalizeContactEntityType(parts.entityType);
  if (!isContactEmailEntity(entityType)) return false;

  const type = String(parts.fieldType || "").trim().toLowerCase();
  if (type === "email") return true;

  const fieldName = String(parts.fieldName || "").trim();
  if (!fieldName) return false;
  return (CONTACT_EMAIL_FIELDS[entityType] || []).some(
    (d) => d.fieldName.toLowerCase() === fieldName.toLowerCase()
  );
}
