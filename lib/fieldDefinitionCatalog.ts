import mappingBundle from "./data/custom_field_definitions.mapping.json";

type FieldDef = {
  field_name?: string;
  field_label?: string;
  field_type?: string;
  lookup_type?: string | null;
  is_hidden?: boolean;
  sort_order?: number;
};

type MappingFile = {
  mapping?: Record<string, FieldDef[]>;
};

const bundle = mappingBundle as MappingFile;

const ENTITY_ALIASES: Record<string, string> = {
  job: "jobs",
  "job-seeker": "job-seekers",
  "hiring-manager": "hiring-managers",
  organization: "organizations",
  lead: "leads",
  placement: "placements",
  task: "tasks",
};

export function normalizeAdminEntityType(raw: unknown): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return ENTITY_ALIASES[s] || s;
}

export function jobAdminEntityTypeFromJob(job: {
  job_type?: string | null;
  jobType?: string | null;
  employment_type?: string | null;
  employmentType?: string | null;
} | null | undefined): string {
  const raw = String(
    job?.job_type || job?.jobType || job?.employment_type || job?.employmentType || ""
  )
    .toLowerCase()
    .trim()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  if (raw.includes("direct")) return "jobs-direct-hire";
  if (raw.includes("executive")) return "jobs-executive-search";
  return "jobs";
}

export function listFields(entityType: string): FieldDef[] {
  const et = normalizeAdminEntityType(entityType);
  const raw = bundle.mapping?.[et];
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => ({
    ...f,
    field_name: f.field_name != null ? String(f.field_name) : undefined,
    field_label: f.field_label != null ? String(f.field_label) : undefined,
    field_type: f.field_type != null ? String(f.field_type) : undefined,
    lookup_type: f.lookup_type == null ? null : String(f.lookup_type),
    is_hidden: Boolean(f.is_hidden),
    sort_order: Number(f.sort_order) || 0,
  }));
}

export function getFieldDef(entityType: string, fieldName: string): FieldDef | null {
  const wanted = String(fieldName || "").trim();
  if (!wanted) return null;
  return (
    listFields(entityType).find(
      (f) => String(f.field_name || "").toLowerCase() === wanted.toLowerCase()
    ) || null
  );
}

export function getDumpFieldLabel(entityType: string, fieldName: string): string | null {
  const label = String(getFieldDef(entityType, fieldName)?.field_label || "").trim();
  return label || null;
}

export function getFieldNameByLabel(entityType: string, label: string): string | null {
  const wanted = String(label || "").trim().toLowerCase();
  if (!wanted) return null;
  const hit = listFields(entityType).find(
    (f) => String(f.field_label || "").trim().toLowerCase() === wanted
  );
  return hit?.field_name ? String(hit.field_name) : null;
}

function findFirst(entityType: string, predicate: (f: FieldDef) => boolean): FieldDef | null {
  return listFields(entityType).find(predicate) || null;
}

export function getStatusFieldName(entityType: string): string | null {
  return (
    findFirst(
      entityType,
      (f) => !f.is_hidden && /^status$/i.test(String(f.field_label || "").trim())
    )?.field_name || null
  );
}

export function getOrganizationLookupFieldName(entityType: string): string | null {
  const fields = listFields(entityType).filter((f) =>
    String(f.lookup_type || "").toLowerCase().includes("organization") && !f.is_hidden
  );
  if (!fields.length) return null;
  const ranked = [
    /client company/i,
    /company\s*\/\s*organization/i,
    /^organization$/i,
    /^company$/i,
    /current organization/i,
  ];
  for (const re of ranked) {
    const hit = fields.find((f) => re.test(String(f.field_label || "")));
    if (hit?.field_name) return hit.field_name;
  }
  return [...fields].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]
    ?.field_name || null;
}

export function getHiringManagerLookupFieldName(entityType: string): string | null {
  const fields = listFields(entityType).filter((f) =>
    String(f.lookup_type || "").toLowerCase().includes("hiring-manager") && !f.is_hidden
  );
  if (!fields.length) return null;
  const exact = fields.find((f) =>
    /^(hiring manager|contact)$/i.test(String(f.field_label || "").trim())
  );
  if (exact?.field_name) return exact.field_name;
  const named = fields.find((f) => /hiring manager/i.test(String(f.field_label || "")));
  return named?.field_name || fields[0]?.field_name || null;
}

export function getOwnerFieldName(entityType: string): string | null {
  const hit = findFirst(
    entityType,
    (f) =>
      !f.is_hidden &&
      String(f.lookup_type || "").toLowerCase() === "owner" &&
      /^owner$/i.test(String(f.field_label || "").trim())
  );
  return hit?.field_name || getFieldDef(entityType, "Field_69")?.field_name || null;
}

function pickAddressPart(entityType: string, matchers: RegExp[]): string | null {
  const fields = listFields(entityType);
  for (const re of matchers) {
    const visible = fields.find(
      (f) => !f.is_hidden && re.test(String(f.field_label || ""))
    );
    if (visible?.field_name) return visible.field_name;
  }
  for (const re of matchers) {
    const any = fields.find((f) => re.test(String(f.field_label || "")));
    if (any?.field_name) return any.field_name;
  }
  return null;
}

export function getAddressFieldNames(entityType: string): {
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  return {
    address: pickAddressPart(entityType, [
      /address line 1/i,
      /^address$/i,
      /^full address$/i,
    ]),
    address2: pickAddressPart(entityType, [/address line 2/i, /^address 2$/i]),
    city: pickAddressPart(entityType, [/^city$/i]),
    state: pickAddressPart(entityType, [/^state$/i, /state or province/i]),
    zip: pickAddressPart(entityType, [/zip/i, /postal code/i]),
  };
}

export function getJobDescriptionFieldName(entityType: string): string | null {
  return (
    getFieldNameByLabel(entityType, "Job Description") ||
    getFieldNameByLabel(entityType, "Description")
  );
}

export function getPublishingStatusFieldNames(entityType: string): string[] {
  return listFields(entityType)
    .filter((f) => /^publishing status$/i.test(String(f.field_label || "").trim()))
    .map((f) => f.field_name)
    .filter((n): n is string => Boolean(n));
}

export function getPrimaryEmailFieldName(entityType: string): string | null {
  return (
    getFieldNameByLabel(entityType, "Primary Email") ||
    getFieldNameByLabel(entityType, "Email")
  );
}

export function getSecondaryEmailFieldName(entityType: string): string | null {
  return getFieldNameByLabel(entityType, "Secondary Email");
}

export function jobDetailFieldNames(entityType: string): string[] {
  const et = normalizeAdminEntityType(entityType);
  const names = [
    getFieldNameByLabel(et, "Title") || getFieldNameByLabel(et, "Job Title") || "Field_1",
    getOrganizationLookupFieldName(et),
    getHiringManagerLookupFieldName(et),
    getStatusFieldName(et),
    getJobDescriptionFieldName(et),
    getAddressFieldNames(et).address,
    getAddressFieldNames(et).address2,
    getAddressFieldNames(et).city,
    getAddressFieldNames(et).state,
    getAddressFieldNames(et).zip,
    getOwnerFieldName(et),
    getFieldNameByLabel(et, "Date Added"),
  ].filter((n): n is string => Boolean(n));
  return [...new Set(names)];
}

export function jobOrganizationCatalogEntries(): { entityType: string; fieldName: string }[] {
  const types = ["jobs", "jobs-direct-hire", "jobs-executive-search"];
  const out: { entityType: string; fieldName: string }[] = [];
  for (const entityType of types) {
    const preferred = getOrganizationLookupFieldName(entityType);
    const fields = listFields(entityType).filter((f) =>
      String(f.lookup_type || "")
        .toLowerCase()
        .includes("organization") && !f.is_hidden
    );
    const sorted = [...fields].sort((a, b) => {
      if (a.field_name === preferred) return -1;
      if (b.field_name === preferred) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    for (const f of sorted) {
      if (f.field_name) out.push({ entityType, fieldName: f.field_name });
    }
  }
  return out;
}
