import { getCustomFieldLabel } from "./getCustomFieldLabel";
import { jobOrganizationCatalogEntries, getOrganizationLookupFieldName } from "./fieldDefinitionCatalog";

/**
 * Organization lookup on jobs — field_names from the dumped Admin Center catalog.
 */
export const JOB_ORGANIZATION_CUSTOM_FIELDS = jobOrganizationCatalogEntries();

/** Current Admin Center labels often used for the job → organization lookup. */
export const JOB_ORGANIZATION_LABEL_FALLBACKS = [
  "Organization",
  "Company",
  "Organization / Company",
  "Company / Organization",
  "Client Company",
  "Organisation",
] as const;

export function jobOrganizationFieldNameForEntityType(entityType: string): string {
  return getOrganizationLookupFieldName(entityType) || "Field_2";
}

export function extractOrganizationRecordId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return String(Math.trunc(raw));
  }
  if (Array.isArray(raw)) return extractOrganizationRecordId(raw[0]);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return extractOrganizationRecordId(
      obj.id ?? obj.value ?? obj.record_id ?? obj.recordId ?? obj.organization_id
    );
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  const prefixed = s.match(/^O\s*(\d+)/i);
  if (prefixed?.[1]) return prefixed[1];
  return null;
}

export function readJobOrganizationLookupRaw(
  customFields: Record<string, unknown>,
  resolvedLabel: string | null | undefined,
  fieldName: string
): unknown {
  const labels = [
    resolvedLabel,
    ...JOB_ORGANIZATION_LABEL_FALLBACKS,
  ].filter((label, index, all): label is string => {
    if (!label || !String(label).trim()) return false;
    const lower = String(label).trim().toLowerCase();
    return all.findIndex((x) => String(x || "").trim().toLowerCase() === lower) === index;
  });

  for (const label of labels) {
    const value = getCustomFieldValueByLabel(customFields, label, undefined);
    if (value != null && String(value).trim() !== "") return value;
  }

  const byFieldName = getCustomFieldValueByLabel(customFields, null, fieldName);
  if (byFieldName != null && String(byFieldName).trim() !== "") return byFieldName;

  for (const [key, value] of Object.entries(customFields || {})) {
    const n = key.trim().toLowerCase();
    if (
      (n === "organization" || n === "company" || n.includes("organization") || n.includes("company")) &&
      value != null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }
  return null;
}

export async function resolveJobLinkedOrganizationId(
  job: unknown,
  entityType: string
): Promise<string | null> {
  const fieldName = jobOrganizationFieldNameForEntityType(entityType);
  const label = await getCustomFieldLabel(entityType, fieldName);
  const record = job && typeof job === "object" ? (job as Record<string, unknown>) : {};
  const customFields = parseCustomFieldsObject(record.custom_fields ?? record.customFields);
  return extractOrganizationRecordId(
    readJobOrganizationLookupRaw(customFields, label, fieldName)
  );
}

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
