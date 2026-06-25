/**
 * Admin field-management entity slugs (keep in sync with
 * app/api/admin/field-management/[entityType]/route.ts validEntityTypes).
 */
export const FIELD_MANAGEMENT_ENTITY_TYPES = [
  "job-seekers",
  "hiring-managers",
  "organizations",
  "jobs",
  "jobs-direct-hire",
  "jobs-executive-search",
  "placements",
  "placements-direct-hire",
  "placements-executive-search",
  "tasks",
  "planner",
  "leads",
  "tearsheets",
  "goals-quotas",
] as const;

export type FieldManagementEntityType = (typeof FIELD_MANAGEMENT_ENTITY_TYPES)[number];

/**
 * Maps entity_type → field_name of the field that should render as an editable status
 * (options + PUT customFields using that definition's field_label as JSON key).
 * Empty string = no mapped status field for that entity.
 */
export const statusMappings: Record<string, string> = {
  "job-seekers": "Field_4",
  "hiring-managers": "Field_4",
  organizations: "Field_2",
  /** Custom job status (admin Field_4); list/detail use FieldValueRenderer mapped status */
  jobs: "Field_4",
  "jobs-direct-hire": "Field_4",
  "jobs-executive-search": "Field_4",
  placements: "",
  "placements-direct-hire": "",
  "placements-executive-search": "",
  tasks: "Field_3",
  planner: "",
  leads: "Field_4",
  tearsheets: "",
  "goals-quotas": "",
};

/** HM custom field (field_name) whose value is the related organization id (stored under field_label in custom_fields). */
export const HM_ORGANIZATION_ID_FIELD_NAME = "Field_3";

/** Stable organization lookup field_name per entity (admin labels may differ). */
export const ORGANIZATION_LOOKUP_FIELD_BY_ENTITY: Record<string, string> = {
  "hiring-managers": HM_ORGANIZATION_ID_FIELD_NAME,
  jobs: "Field_2",
  "job-seekers": "Field_5",
  leads: "Field_6",
  placements: "Field_22",
};

/**
 * Lookup fields identified by stable field_name → top-level API column for import/create.
 * Independent of admin field_label renames.
 */
export const LOOKUP_FIELD_BACKEND_COLUMN: Record<string, Record<string, string>> = {
  "hiring-managers": {
    [HM_ORGANIZATION_ID_FIELD_NAME]: "organizationId",
    Field_69: "owner",
  },
  jobs: {
    Field_2: "organizationId",
    Field_22: "hiringManager",
    Field_69: "owner",
  },
  "job-seekers": {
    Field_5: "currentOrganization",
    Field_69: "owner",
  },
  leads: {
    Field_6: "organizationId",
    Field_69: "owner",
  },
  placements: {
    Field_22: "organization_id",
    Field_21: "jobId",
    Field_2: "job_seeker_id",
  },
};

/** Resolve top-level API column for a lookup custom field (label-independent). */
export function getLookupBackendColumn(
  entityType: string,
  fieldName: string,
  lookupType?: string | null
): string | null {
  const slug = normalizeCrmEntityTypeSlug(entityType);
  const byFieldName = LOOKUP_FIELD_BACKEND_COLUMN[slug]?.[fieldName];
  if (byFieldName) return byFieldName;

  const normalizedLookup = String(lookupType ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (normalizedLookup === "organizations") {
    const orgField = ORGANIZATION_LOOKUP_FIELD_BY_ENTITY[slug];
    if (orgField && fieldName === orgField) {
      return slug === "job-seekers" ? "currentOrganization" : "organizationId";
    }
  }
  if (normalizedLookup === "owner") {
    return "owner";
  }
  return null;
}

/**
 * Next.js app-relative PUT URL for updating a record's custom_fields (and other fields).
 * Returns null when this entity has no standard CRM PUT route in the app.
 */
export function getEntityUpdatePutPath(
  entityType: string,
  recordId: string | number
): string | null {
  const id = encodeURIComponent(String(recordId));
  const slug = normalizeCrmEntityTypeSlug(entityType);
  const map: Record<string, string> = {
    "job-seekers": `/api/job-seekers/${id}`,
    "hiring-managers": `/api/hiring-managers/${id}`,
    organizations: `/api/organizations/${id}`,
    jobs: `/api/jobs/${id}`,
    "jobs-direct-hire": `/api/jobs/${id}`,
    "jobs-executive-search": `/api/jobs/${id}`,
    placements: `/api/placements/${id}`,
    "placements-direct-hire": `/api/placements/${id}`,
    "placements-executive-search": `/api/placements/${id}`,
    tasks: `/api/tasks/${id}`,
    leads: `/api/leads/${id}`,
  };
  return map[slug] ?? null;
}

/**
 * Canonical CRM slug for custom-fields PATCH, field-management API, and statusMappings lookup.
 * Must match cms_organization_backend/controllers/entityCustomFieldsController.js SUPPORTED + normalizeEntityType
 */
export function normalizeCrmEntityTypeSlug(raw: string | undefined): string {
  if (!raw) return "";
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  const aliases: Record<string, string> = {
    job: "jobs",
    task: "tasks",
    "jobs-direct-hire": "jobs",
    "jobs-executive-search": "jobs",
    "placements-direct-hire": "placements",
    "placements-executive-search": "placements",
  };
  return aliases[s] || s;
}

const ENTITY_CUSTOM_FIELD_PATCH_SUPPORTED = new Set([
  "job-seekers",
  "hiring-managers",
  "organizations",
  "jobs",
  "placements",
  "tasks",
  "leads",
]);

/**
 * Single Next.js → Node route for merging custom_fields (e.g. mapped status in FieldValueRenderer).
 * Returns null when this entity is not handled by the unified backend patch (use getEntityUpdatePutPath fallback).
 */
export function getEntityCustomFieldsPatchPath(
  entityType: string | undefined,
  recordId: string | number | null | undefined
): string | null {
  if (!entityType || recordId == null || String(recordId).trim() === "") {
    return null;
  }
  const normalized = normalizeCrmEntityTypeSlug(entityType);
  if (!ENTITY_CUSTOM_FIELD_PATCH_SUPPORTED.has(normalized)) {
    return null;
  }
  const id = encodeURIComponent(String(recordId));
  return `/api/entity-records/${encodeURIComponent(normalized)}/${id}/custom-fields`;
}

export function getMappedStatusFieldName(entityType: string | undefined): string {
  if (!entityType) return "";
  const slug = normalizeCrmEntityTypeSlug(entityType);
  const v = (statusMappings[slug] ?? "").trim();
  return v;
}
