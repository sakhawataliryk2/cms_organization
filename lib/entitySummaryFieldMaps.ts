import {
  getHiringManagerLookupFieldName,
  getOrganizationLookupFieldName,
  getOwnerFieldName,
  getStatusFieldName,
  normalizeAdminEntityType,
} from "./fieldDefinitionCatalog";

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

function catalogStatus(entityType: string, fallback = ""): string {
  return getStatusFieldName(entityType) || fallback;
}

function catalogOrg(entityType: string, fallback: string): string {
  return getOrganizationLookupFieldName(entityType) || fallback;
}

function catalogOwner(entityType: string): string {
  return getOwnerFieldName(entityType) || "Field_69";
}

function catalogHm(entityType: string, fallback: string): string {
  return getHiringManagerLookupFieldName(entityType) || fallback;
}

/**
 * Maps Admin Center entity_type → status field_name from the dumped catalog.
 * Empty string = no mapped status field for that entity.
 */
export const statusMappings: Record<string, string> = {
  "job-seekers": catalogStatus("job-seekers", "Field_4"),
  "hiring-managers": catalogStatus("hiring-managers", "Field_4"),
  organizations: catalogStatus("organizations", "Field_2"),
  jobs: catalogStatus("jobs", "Field_4"),
  "jobs-direct-hire": catalogStatus("jobs-direct-hire", "Field_2"),
  "jobs-executive-search": catalogStatus("jobs-executive-search", "Field_2"),
  placements: catalogStatus("placements", "Field_1"),
  "placements-direct-hire": catalogStatus("placements-direct-hire", "Field_1"),
  "placements-executive-search": catalogStatus("placements-executive-search", "Field_1"),
  tasks: catalogStatus("tasks", "Field_3"),
  planner: "",
  leads: catalogStatus("leads", "Field_4"),
  tearsheets: "",
  "goals-quotas": "",
};

/** HM custom field (field_name) whose value is the related organization id (stored under field_label in custom_fields). */
export const HM_ORGANIZATION_ID_FIELD_NAME = catalogOrg("hiring-managers", "Field_3");

/** Stable organization lookup field_name per Admin Center entity (from dump JSON). */
export const ORGANIZATION_LOOKUP_FIELD_BY_ENTITY: Record<string, string> = {
  "hiring-managers": HM_ORGANIZATION_ID_FIELD_NAME,
  jobs: catalogOrg("jobs", "Field_2"),
  "jobs-direct-hire": catalogOrg("jobs-direct-hire", "Field_6"),
  "jobs-executive-search": catalogOrg("jobs-executive-search", "Field_6"),
  "job-seekers": catalogOrg("job-seekers", "Field_5"),
  leads: catalogOrg("leads", "Field_6"),
  placements: catalogOrg("placements", "Field_22"),
  "placements-direct-hire": catalogOrg("placements-direct-hire", "Field_22"),
  "placements-executive-search": catalogOrg("placements-executive-search", "Field_22"),
};

/**
 * Lookup fields identified by stable field_name → top-level API column for import/create.
 * Independent of admin field_label renames.
 */
export const LOOKUP_FIELD_BACKEND_COLUMN: Record<string, Record<string, string>> = {
  organizations: {
    [catalogOwner("organizations")]: "owner",
  },
  "hiring-managers": {
    [HM_ORGANIZATION_ID_FIELD_NAME]: "organizationId",
    [catalogOwner("hiring-managers")]: "owner",
  },
  jobs: {
    [catalogOrg("jobs", "Field_2")]: "organizationId",
    [catalogHm("jobs", "Field_22")]: "hiringManager",
    [catalogOwner("jobs")]: "owner",
  },
  "jobs-direct-hire": {
    [catalogOrg("jobs-direct-hire", "Field_6")]: "organizationId",
    [catalogHm("jobs-direct-hire", "Field_7")]: "hiringManager",
    [catalogOwner("jobs-direct-hire")]: "owner",
  },
  "jobs-executive-search": {
    [catalogOrg("jobs-executive-search", "Field_6")]: "organizationId",
    [catalogHm("jobs-executive-search", "Field_7")]: "hiringManager",
    [catalogOwner("jobs-executive-search")]: "owner",
  },
  "job-seekers": {
    [catalogOrg("job-seekers", "Field_5")]: "currentOrganization",
    [catalogOwner("job-seekers")]: "owner",
  },
  leads: {
    [catalogOrg("leads", "Field_6")]: "organizationId",
    [catalogOwner("leads")]: "owner",
  },
  placements: {
    [catalogOrg("placements", "Field_22")]: "organization_id",
    Field_21: "jobId",
    Field_2: "job_seeker_id",
  },
  "placements-direct-hire": {
    [catalogOrg("placements-direct-hire", "Field_22")]: "organization_id",
    Field_21: "jobId",
    Field_2: "job_seeker_id",
  },
  "placements-executive-search": {
    [catalogOrg("placements-executive-search", "Field_22")]: "organization_id",
    Field_21: "jobId",
    Field_2: "job_seeker_id",
  },
};

/** Extract stable Field_N (or bare key) from fieldInfo name/key. */
export function getStableCustomFieldName(fieldInfo?: {
  name?: string;
  key?: string;
} | null): string {
  const rawName = String(fieldInfo?.name ?? "").trim();
  if (rawName) {
    return rawName.startsWith("custom:") ? rawName.slice("custom:".length) : rawName;
  }
  const rawKey = String(fieldInfo?.key ?? "").trim();
  if (rawKey.startsWith("custom:")) return rawKey.slice("custom:".length);
  return rawKey;
}

/**
 * Normalize fieldType / lookupType for rendering.
 * Uses admin-provided values when present; otherwise infers from stable field_name maps
 * (e.g. Field_69 → owner lookup) so callers need not hardcode.
 */
export function resolveFieldRenderMeta(
  fieldInfo?: {
    name?: string;
    key?: string;
    label?: string;
    fieldType?: string;
    lookupType?: string;
    multiSelectLookupType?: string;
  } | null,
  entityType?: string
): {
  fieldType: string;
  lookupType: string;
  multiSelectLookupType: string;
} {
  let fieldType = String(fieldInfo?.fieldType ?? "").trim();
  let lookupType = String(fieldInfo?.lookupType ?? "").trim();
  let multiSelectLookupType = String(fieldInfo?.multiSelectLookupType ?? "").trim();

  const stableName = getStableCustomFieldName(fieldInfo);
  const label = String(fieldInfo?.label ?? "").trim().toLowerCase();
  const slug = entityType ? normalizeAdminEntityType(entityType) : "";
  const crmSlug = entityType ? normalizeCrmEntityTypeSlug(entityType) : "";

  const ensureLookup = (type: string) => {
    if (!fieldType || fieldType.toLowerCase() === "text") {
      fieldType = "lookup";
    }
    if (!lookupType && !multiSelectLookupType) {
      lookupType = type;
    }
  };

  // Cross-entity Owner field
  if (stableName === "Field_69" || label === "owner") {
    ensureLookup("owner");
  }

  if (slug) {
    const backendCol =
      LOOKUP_FIELD_BACKEND_COLUMN[slug]?.[stableName] ||
      LOOKUP_FIELD_BACKEND_COLUMN[crmSlug]?.[stableName];
    if (backendCol === "owner") {
      ensureLookup("owner");
    } else if (
      backendCol === "organizationId" ||
      backendCol === "currentOrganization" ||
      backendCol === "organization_id"
    ) {
      ensureLookup("organizations");
    } else if (backendCol === "hiringManager") {
      ensureLookup("hiring-managers");
    } else if (backendCol === "jobId") {
      ensureLookup("jobs");
    } else if (backendCol === "job_seeker_id") {
      ensureLookup("job-seekers");
    }

    const orgField = ORGANIZATION_LOOKUP_FIELD_BY_ENTITY[slug];
    if (orgField && stableName === orgField) {
      ensureLookup("organizations");
    }
  }

  return {
    fieldType,
    lookupType,
    multiSelectLookupType,
  };
}

/** Resolve top-level API column for a lookup custom field (label-independent). */
export function getLookupBackendColumn(
  entityType: string,
  fieldName: string,
  lookupType?: string | null
): string | null {
  const admin = normalizeAdminEntityType(entityType);
  const slug = normalizeCrmEntityTypeSlug(entityType);
  const byFieldName =
    LOOKUP_FIELD_BACKEND_COLUMN[admin]?.[fieldName] ||
    LOOKUP_FIELD_BACKEND_COLUMN[slug]?.[fieldName];
  if (byFieldName) return byFieldName;

  const normalizedLookup = String(lookupType ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (normalizedLookup === "organizations") {
    const orgField =
      ORGANIZATION_LOOKUP_FIELD_BY_ENTITY[admin] ||
      ORGANIZATION_LOOKUP_FIELD_BY_ENTITY[slug];
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
  const admin = normalizeAdminEntityType(entityType);
  const fromAdmin = (statusMappings[admin] ?? "").trim();
  if (fromAdmin) return fromAdmin;
  const slug = normalizeCrmEntityTypeSlug(entityType);
  return (statusMappings[slug] ?? "").trim();
}
