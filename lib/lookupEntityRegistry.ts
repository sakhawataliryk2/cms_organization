/**
 * Registry for LookupEntityDetailsGrid: map lookup_type / entity slugs →
 * field-management defs slug, GET URL, and response extraction.
 */

export type LookupRegistryEntry = {
  fieldManagementEntityType: string;
  getByIdUrl: (id: string | number) => string;
  extractRecord: (json: unknown) => Record<string, unknown> | null;
  supportsDetailsGrid: boolean;
  resolveValue?: (
    record: Record<string, unknown>,
    catalogKey: string,
    fieldDef: Record<string, unknown> | undefined,
    catalogLabel: string
  ) => string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function organizationResolveValue(
  o: Record<string, unknown>,
  key: string,
  fieldDef: Record<string, unknown> | undefined,
  catalogLabel: string
): string {
  const customFields = asRecord(o.customFields) ?? {};
  const standard: Record<string, string> = {
    name: String(o.name ?? o.Name ?? ""),
    website: String(o.website ?? o.Website ?? ""),
    contact_phone: String(o.contact_phone ?? o.contactPhone ?? o.phone ?? ""),
    address: String(o.address ?? o.Address ?? ""),
    overview: String(o.overview ?? o.Overview ?? o.about ?? ""),
    status: String(o.status ?? o.Status ?? ""),
    nicknames: String(o.nicknames ?? o.Nicknames ?? ""),
    parent_organization: String(o.parent_organization ?? o.parentOrganization ?? ""),
    contract_on_file: String(o.contract_on_file ?? o.contractOnFile ?? ""),
    date_contract_signed: String(o.date_contract_signed ?? o.dateContractSigned ?? ""),
    year_founded: String(o.year_founded ?? o.yearFounded ?? ""),
    perm_fee: String(o.perm_fee ?? o.permFee ?? ""),
    num_employees:
      o.num_employees != null
        ? String(o.num_employees)
        : o.numEmployees != null
          ? String(o.numEmployees)
          : "",
    num_offices:
      o.num_offices != null
        ? String(o.num_offices)
        : o.numOffices != null
          ? String(o.numOffices)
          : "",
  };
  if (standard[key] !== undefined && standard[key] !== null && String(standard[key]).trim() !== "") {
    return String(standard[key]);
  }
  const direct = o[key];
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    return String(direct);
  }
  const label = String(fieldDef?.field_label ?? fieldDef?.field_name ?? catalogLabel);
  const customVal = customFields[catalogLabel] ?? customFields[label] ?? customFields[key];
  if (customVal !== undefined && customVal !== null) return String(customVal);
  return "-";
}

function genericResolveValue(
  o: Record<string, unknown>,
  key: string,
  fieldDef: Record<string, unknown> | undefined,
  catalogLabel: string
): string {
  const customFields = asRecord(o.customFields) ?? {};
  const direct = o[key];
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    return String(direct);
  }
  const label = String(fieldDef?.field_label ?? fieldDef?.field_name ?? catalogLabel);
  const customVal = customFields[catalogLabel] ?? customFields[label] ?? customFields[key];
  if (customVal !== undefined && customVal !== null) return String(customVal);
  return "-";
}

function extractOrganization(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const org = j.organization ?? j.data;
  return asRecord(org);
}

function extractHiringManager(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const hm = j.hiringManager ?? j.hiring_manager;
  return asRecord(hm);
}

function extractJob(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const job = j.job ?? j.data;
  return asRecord(job);
}

function extractJobSeeker(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const js = j.jobSeeker ?? j.job_seeker ?? j.data;
  return asRecord(js);
}

function extractLead(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const lead = j.lead ?? j.data;
  return asRecord(lead);
}

function extractPlacement(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const p = j.placement ?? j.data;
  return asRecord(p);
}

function extractTask(json: unknown): Record<string, unknown> | null {
  const j = asRecord(json);
  if (!j) return null;
  const t = j.task ?? j.data;
  return asRecord(t);
}

const idEnc = (id: string | number) => encodeURIComponent(String(id));

const CRM_ORGANIZATIONS: LookupRegistryEntry = {
  fieldManagementEntityType: "organizations",
  getByIdUrl: (id) => `/api/organizations/${idEnc(id)}`,
  extractRecord: extractOrganization,
  supportsDetailsGrid: true,
  resolveValue: organizationResolveValue,
};

const CRM_HIRING_MANAGERS: LookupRegistryEntry = {
  fieldManagementEntityType: "hiring-managers",
  getByIdUrl: (id) => `/api/hiring-managers/${idEnc(id)}`,
  extractRecord: extractHiringManager,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const CRM_JOBS: LookupRegistryEntry = {
  fieldManagementEntityType: "jobs",
  getByIdUrl: (id) => `/api/jobs/${idEnc(id)}`,
  extractRecord: extractJob,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const CRM_JOB_SEEKERS: LookupRegistryEntry = {
  fieldManagementEntityType: "job-seekers",
  getByIdUrl: (id) => `/api/job-seekers/${idEnc(id)}`,
  extractRecord: extractJobSeeker,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const CRM_LEADS: LookupRegistryEntry = {
  fieldManagementEntityType: "leads",
  getByIdUrl: (id) => `/api/leads/${idEnc(id)}`,
  extractRecord: extractLead,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const CRM_PLACEMENTS: LookupRegistryEntry = {
  fieldManagementEntityType: "placements",
  getByIdUrl: (id) => `/api/placements/${idEnc(id)}`,
  extractRecord: extractPlacement,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const CRM_TASKS: LookupRegistryEntry = {
  fieldManagementEntityType: "tasks",
  getByIdUrl: (id) => `/api/tasks/${idEnc(id)}`,
  extractRecord: extractTask,
  supportsDetailsGrid: true,
  resolveValue: genericResolveValue,
};

const NO_GRID: LookupRegistryEntry = {
  fieldManagementEntityType: "planner",
  getByIdUrl: () => "",
  extractRecord: () => null,
  supportsDetailsGrid: false,
};

/** Canonical lookup keys after normalization */
const CANONICAL_REGISTRY: Record<string, LookupRegistryEntry> = {
  organizations: CRM_ORGANIZATIONS,
  organization: CRM_ORGANIZATIONS,
  "hiring-managers": CRM_HIRING_MANAGERS,
  "hiring-manager": CRM_HIRING_MANAGERS,
  hiringmanager: CRM_HIRING_MANAGERS,
  hiringmanagers: CRM_HIRING_MANAGERS,
  jobs: CRM_JOBS,
  job: CRM_JOBS,
  "job-seekers": CRM_JOB_SEEKERS,
  "job-seeker": CRM_JOB_SEEKERS,
  jobseeker: CRM_JOB_SEEKERS,
  jobseekers: CRM_JOB_SEEKERS,
  leads: CRM_LEADS,
  lead: CRM_LEADS,
  placements: CRM_PLACEMENTS,
  placement: CRM_PLACEMENTS,
  tasks: CRM_TASKS,
  task: CRM_TASKS,
  owner: NO_GRID,
  planner: NO_GRID,
  tearsheets: NO_GRID,
  tearsheet: NO_GRID,
  "goals-quotas": NO_GRID,
};

/** Job/placement field-management variants: same GET as base type, defs from variant slug */
function variant(
  base: LookupRegistryEntry,
  fieldManagementEntityType: string
): LookupRegistryEntry {
  return {
    ...base,
    fieldManagementEntityType,
  };
}

const VARIANT_KEYS: Record<string, LookupRegistryEntry> = {
  "jobs-direct-hire": variant(CRM_JOBS, "jobs-direct-hire"),
  "jobs-executive-search": variant(CRM_JOBS, "jobs-executive-search"),
  "jobsdirecthire": variant(CRM_JOBS, "jobs-direct-hire"),
  "jobsexecutivesearch": variant(CRM_JOBS, "jobs-executive-search"),
  "placements-direct-hire": variant(CRM_PLACEMENTS, "placements-direct-hire"),
  "placements-executive-search": variant(CRM_PLACEMENTS, "placements-executive-search"),
  "placementsdirecthire": variant(CRM_PLACEMENTS, "placements-direct-hire"),
  "placementsexecutivesearch": variant(CRM_PLACEMENTS, "placements-executive-search"),
};

const FULL_REGISTRY: Record<string, LookupRegistryEntry> = {
  ...CANONICAL_REGISTRY,
  ...VARIANT_KEYS,
};

export function normalizeLookupType(lookupType: string): string {
  return lookupType.toLowerCase().replace(/\s+/g, "-").trim();
}

export function getLookupRegistryEntry(lookupType: string): LookupRegistryEntry | null {
  const n = normalizeLookupType(lookupType);
  return FULL_REGISTRY[n] ?? null;
}
