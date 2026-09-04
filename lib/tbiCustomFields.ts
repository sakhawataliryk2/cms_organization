export type FieldSpec = {
  fieldName: string;
  aliases?: string[];
};

export function parseCustomFields(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
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
  return {};
}

export function stringifyCfValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((v) => stringifyCfValue(v)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.title ?? obj.display ?? obj.full_name;
    if (name != null) return stringifyCfValue(name);
    if (obj.first_name != null || obj.last_name != null) {
      return `${stringifyCfValue(obj.first_name)} ${stringifyCfValue(obj.last_name)}`.trim();
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

function normalizeKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getCfValue(
  customFields: unknown,
  spec: FieldSpec,
  currentLabel?: string | null,
): string {
  const cf = parseCustomFields(customFields);
  const keys = Object.keys(cf);
  const ordered = [currentLabel, spec.fieldName, ...(spec.aliases || [])].filter(
    Boolean,
  ) as string[];

  for (const key of ordered) {
    if (Object.prototype.hasOwnProperty.call(cf, key)) {
      const hit = stringifyCfValue(cf[key]);
      if (hit) return hit;
    }
  }

  const wanted = new Set(ordered.map(normalizeKey).filter(Boolean));
  for (const key of keys) {
    if (wanted.has(normalizeKey(key))) {
      const hit = stringifyCfValue(cf[key]);
      if (hit) return hit;
    }
  }
  return "";
}

export function extractLookupId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(raw);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/^\d+$/.test(s) && Number(s) > 0) return s;
    return null;
  }
  if (Array.isArray(raw)) return extractLookupId(raw[0]);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return extractLookupId(
      obj.id ?? obj.value ?? obj.record_id ?? obj.recordId ?? obj.job_seeker_id,
    );
  }
  return null;
}

export function getCfLookupId(
  customFields: unknown,
  spec: FieldSpec,
  currentLabel?: string | null,
): string | null {
  const cf = parseCustomFields(customFields);
  const ordered = [currentLabel, spec.fieldName, ...(spec.aliases || [])].filter(
    Boolean,
  ) as string[];
  for (const key of ordered) {
    if (Object.prototype.hasOwnProperty.call(cf, key)) {
      const id = extractLookupId(cf[key]);
      if (id) return id;
    }
  }
  const wanted = new Set(ordered.map(normalizeKey).filter(Boolean));
  for (const key of Object.keys(cf)) {
    if (wanted.has(normalizeKey(key))) {
      const id = extractLookupId(cf[key]);
      if (id) return id;
    }
  }
  return null;
}

export function isApprovedStatus(value: unknown): boolean {
  return String(value || "")
    .trim()
    .toLowerCase() === "approved";
}

export const TBI_FIELDS = {
  organization: {
    name: { fieldName: "Field_1", aliases: ["Organization Name", "Name"] },
    status: { fieldName: "Field_2", aliases: ["Status"] },
    address1: { fieldName: "Field_8", aliases: ["Address Line 1", "Address"] },
    address2: { fieldName: "Field_9", aliases: ["Address Line 2", "Address 2"] },
    city: { fieldName: "Field_10", aliases: ["City"] },
    phone: { fieldName: "Field_6", aliases: ["Main Phone", "Phone"] },
    state: { fieldName: "Field_11", aliases: ["State"] },
    zip: { fieldName: "Field_12", aliases: ["ZIP / Postal Code", "ZIP", "Zip"] },
    oasisKey: { fieldName: "Field_30", aliases: ["Oasis Key", "IASIS KEY"] },
  },
  jobSeeker: {
    firstName: { fieldName: "Field_1", aliases: ["First Name", "FirstName"] },
    lastName: { fieldName: "Field_3", aliases: ["Last Name", "LastName"] },
    status: { fieldName: "Field_4", aliases: ["Status"] },
    email: { fieldName: "Field_8", aliases: ["Primary Email", "Email"] },
    phone: { fieldName: "Field_11", aliases: ["Primary Phone", "Phone"] },
    city: { fieldName: "Field_17", aliases: ["City"] },
    state: { fieldName: "Field_18", aliases: ["State"] },
    oasisKey: { fieldName: "Field_33", aliases: ["Oasis Key"] },
  },
  hiringManager: {
    firstName: { fieldName: "Field_1", aliases: ["First Name"] },
    lastName: { fieldName: "Field_2", aliases: ["Last Name"] },
    organization: { fieldName: "Field_3", aliases: ["Organization"] },
    status: { fieldName: "Field_4", aliases: ["Status"] },
    email: { fieldName: "Field_7", aliases: ["Primary Email", "Email"] },
    state: { fieldName: "Field_15", aliases: ["State"] },
  },
  placement: {
    status: { fieldName: "Field_1", aliases: ["Status"] },
    jobSeeker: { fieldName: "Field_2", aliases: ["Job Seeker"] },
    billingContact: { fieldName: "Field_3", aliases: ["Billing contact", "Billing Contact"] },
    reportingTo: { fieldName: "Field_4", aliases: ["Reporting to"] },
    employeeType: { fieldName: "Field_5", aliases: ["Employee Type", "Payroll Type"] },
    startDate: { fieldName: "Field_6", aliases: ["Start Date"] },
    endDate: { fieldName: "Field_7", aliases: ["Scheduled End", "End Date"] },
    payRate: { fieldName: "Field_10", aliases: ["Pay Rate"] },
    billRate: { fieldName: "Field_11", aliases: ["Bill Rate"] },
    workerComp: {
      fieldName: "Field_13",
      aliases: ["Workers Compensation Code", "Worker Comp Code", "Worker Compensation Code"],
    },
    payrollCycle: { fieldName: "Field_16", aliases: ["Payroll Cycle"] },
    timesheetType: { fieldName: "Field_17", aliases: ["Timesheet Type"] },
    poNumber: { fieldName: "Field_18", aliases: ["PO Number"] },
    approver: {
      fieldName: "Field_20",
      aliases: ["TimerCard Approver", "Primary Approver", "Time Card Approver(s)", "Timecard Approver"],
    },
    job: { fieldName: "Field_21", aliases: ["Job"] },
    organization: { fieldName: "Field_22", aliases: ["Organization"] },
  },
  job: {
    title: { fieldName: "Field_1", aliases: ["Title", "Job Title"] },
  },
} as const;

export function personName(cf: unknown, first: FieldSpec, last: FieldSpec): string {
  return `${getCfValue(cf, first)} ${getCfValue(cf, last)}`.trim();
}

export function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const s = stringifyCfValue(value);
    if (s) return s;
  }
  return "";
}
