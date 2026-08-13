import { getCustomFieldLabel } from "./getCustomFieldLabel";

/**
 * Organization lookup on jobs — field_names from Admin Center (see AGENTS.md).
 * Contract uses Field_2; Direct Hire and Executive Search use Field_6.
 */
export const JOB_ORGANIZATION_CUSTOM_FIELDS = [
  { entityType: "jobs", fieldName: "Field_2" },
  { entityType: "jobs-direct-hire", fieldName: "Field_6" },
  { entityType: "jobs-executive-search", fieldName: "Field_6" },
] as const;

export type JobOrganizationFieldDef = {
  entityType: string;
  fieldName: string;
  label: string | null;
};

export function parseCustomFieldsObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function getCustomFieldValueByLabel(
  customFields: Record<string, unknown>,
  label: string | null | undefined,
  fieldName?: string | null
): unknown {
  if (!customFields || typeof customFields !== "object") return null;

  if (label) {
    const exact = customFields[label];
    if (exact != null && String(exact).trim() !== "") return exact;
    const lowered = label.trim().toLowerCase();
    for (const [key, value] of Object.entries(customFields)) {
      if (key.trim().toLowerCase() === lowered && value != null && String(value).trim() !== "") {
        return value;
      }
    }
  }

  if (fieldName && customFields[fieldName] != null && String(customFields[fieldName]).trim() !== "") {
    return customFields[fieldName];
  }

  return null;
}

function collectComparableStrings(raw: unknown, into: Set<string>): void {
  if (raw == null || raw === "") return;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    into.add(String(raw));
    return;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) into.add(trimmed);
    return;
  }
  if (Array.isArray(raw)) {
    raw.forEach((item) => collectComparableStrings(item, into));
    return;
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    collectComparableStrings(obj.id, into);
    collectComparableStrings(obj.value, into);
    collectComparableStrings(obj.record_id, into);
    collectComparableStrings(obj.recordId, into);
    collectComparableStrings(obj.name, into);
    collectComparableStrings(obj.label, into);
  }
}

export function normalizeOrganizationName(name?: string | null): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed || /^no name provided$/i.test(trimmed)) return "";
  return trimmed;
}

export function customFieldValueMatchesOrganization(
  raw: unknown,
  organizationId: string,
  organizationName?: string | null
): boolean {
  const id = String(organizationId ?? "").trim();
  const name = normalizeOrganizationName(organizationName);
  if (!id && !name) return false;

  const values = new Set<string>();
  collectComparableStrings(raw, values);

  for (const value of values) {
    if (id && value === id) return true;
    if (name && value.toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
}

export async function resolveJobOrganizationFieldDefs(): Promise<JobOrganizationFieldDef[]> {
  return Promise.all(
    JOB_ORGANIZATION_CUSTOM_FIELDS.map(async ({ entityType, fieldName }) => ({
      entityType,
      fieldName,
      label: await getCustomFieldLabel(entityType, fieldName),
    }))
  );
}

export function jobBelongsToOrganization(
  job: unknown,
  organizationId: string,
  fieldDefs: JobOrganizationFieldDef[],
  organizationName?: string | null
): boolean {
  const record = job && typeof job === "object" ? (job as Record<string, unknown>) : {};
  const customFields = parseCustomFieldsObject(record.custom_fields ?? record.customFields);

  return fieldDefs.some((def) =>
    customFieldValueMatchesOrganization(
      getCustomFieldValueByLabel(customFields, def.label, def.fieldName),
      organizationId,
      organizationName
    )
  );
}
