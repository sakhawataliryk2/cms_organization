/**
 * Validation and formatting helpers for Admin Field Mapping "default value"
 * inputs. Keeps rules aligned with CustomFieldRenderer where applicable.
 */

import {
  AUTO_CURRENT_DATE,
  AUTO_CURRENT_DATETIME,
  AUTO_CURRENT_OWNER_USER_ID,
} from "./custom-field-auto-defaults";

export type FieldMappingLookupType =
  | "organizations"
  | "hiring-managers"
  | "job-seekers"
  | "jobs"
  | "owner";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Normalize stored date string to yyyy-mm-dd for <input type="date"> */
export function toDateInputValue(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (ISO_DATE.test(t.slice(0, 10))) return t.slice(0, 10);
  const m = t.match(MDY);
  if (m) {
    const month = m[1].padStart(2, "0");
    const day = m[2].padStart(2, "0");
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  return "";
}

/** Format for <input type="datetime-local"> (no timezone); mirrors CustomFieldRenderer slice when already local. */
export function toDatetimeLocalInputValue(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return t.slice(0, 16);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Persist value from datetime-local (strip seconds if any). */
export function fromDatetimeLocalInputValue(local: string): string {
  const t = (local || "").trim();
  return t.length >= 16 ? t.slice(0, 16) : t;
}

function isValidIsoDate(yyyyMmDd: string): boolean {
  if (!ISO_DATE.test(yyyyMmDd)) return false;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isValidNumberLike(s: string, allowNegative: boolean): boolean {
  const t = s.trim();
  if (t === "") return false;
  const re = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  return re.test(t);
}

function sanitizeCurrencyInput(s: string): string {
  let v = s.replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) {
    const [intPart, decPart] = v.split(".");
    v = intPart + "." + (decPart ?? "").slice(0, 2);
  }
  return v;
}

const SIMPLE_EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseMultiselectDefault(raw: string): string[] {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function getDefaultValueHelperText(fieldType: string): string {
  switch (fieldType) {
    case "date":
      return "Fixed date is stored as YYYY-MM-DD. “Current date when adding a new record” fills today when someone opens an add form (not when editing an existing record).";
    case "datetime":
      return "Fixed value is stored as local date/time. “Current … when adding a new record” fills now when someone opens an add form (not when editing).";
    case "number":
      return "Integer or decimal. Leading zeros are not required.";
    case "currency":
      return "Amount in dollars (e.g. 12.99). Currency symbol is not stored.";
    case "percentage":
      return "Numeric percentage (e.g. 15 or 12.5). Must be zero or greater.";
    case "lookup":
      return "Choose a record or, for Owner lookup, “logged-in user when adding a new record” stores the current user’s ID when someone opens an add form (from cookies/token), not when editing.";
    case "multiselect_lookup":
      return "Choose one or more records. IDs are stored as a comma-separated list.";
    case "select":
    case "radio":
      return "Default must be one of the options below (add options first).";
    case "multiselect":
    case "multicheckbox":
      return "Hold Ctrl/Cmd to select multiple defaults. Stored as comma-separated values.";
    case "checkbox":
      return "Default checked state uses true/false.";
    case "email":
      return "Must be a valid email address.";
    case "url":
    case "link":
      return "Include scheme (https://).";
    case "phone":
      return "Digits and formatting characters; stored as entered.";
    case "textarea":
    case "text":
      return "Plain text default.";
    case "file":
      return "File fields cannot have a default upload path; leave empty.";
    case "composite":
      return "Composite fields do not use a single default value.";
    default:
      return "Enter a default compatible with this field type.";
  }
}

export function getDefaultValuePlaceholder(fieldType: string): string {
  switch (fieldType) {
    case "number":
      return "e.g. 42";
    case "currency":
      return "0.00";
    case "percentage":
      return "e.g. 15";
    case "email":
      return "name@example.com";
    case "url":
    case "link":
      return "https://";
    case "phone":
      return "(555) 000-0000";
    case "textarea":
      return "Default text…";
    default:
      return "Default value for the field";
  }
}

export type ValidateDefaultParams = {
  fieldType: string;
  value: string;
  /** Trimmed picklist options */
  options?: string[];
  /** Required to validate owner auto-default */
  lookupType?: FieldMappingLookupType;
};

export type ValidateDefaultResult =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

/**
 * Client-side validation before save. Empty string is always allowed (no default).
 */
export function validateFieldMappingDefaultValue(
  params: ValidateDefaultParams
): ValidateDefaultResult {
  const raw = params.value ?? "";
  const v = raw.trim();
  if (!v) return { ok: true, normalized: "" };

  const ft = params.fieldType;
  const opts = (params.options || []).map((o) => String(o).trim()).filter(Boolean);

  const optionSet = new Set(opts);

  switch (ft) {
    case "date": {
      if (v === AUTO_CURRENT_DATE) {
        return { ok: true, normalized: AUTO_CURRENT_DATE };
      }
      const iso = toDateInputValue(v) || (ISO_DATE.test(v) ? v : "");
      if (!iso || !isValidIsoDate(iso)) {
        return { ok: false, message: "Default date must be a valid calendar date." };
      }
      return { ok: true, normalized: iso };
    }
    case "datetime": {
      if (v === AUTO_CURRENT_DATETIME) {
        return { ok: true, normalized: AUTO_CURRENT_DATETIME };
      }
      const local = fromDatetimeLocalInputValue(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? v : toDatetimeLocalInputValue(v)
      );
      if (!local || local.length < 16) {
        return { ok: false, message: "Default date/time is not valid." };
      }
      return { ok: true, normalized: local };
    }
    case "number":
      if (!isValidNumberLike(v, true)) {
        return { ok: false, message: "Default must be a valid number." };
      }
      return { ok: true, normalized: v };
    case "currency": {
      const cleaned = sanitizeCurrencyInput(v);
      if (!cleaned || !isValidNumberLike(cleaned, false)) {
        return { ok: false, message: "Default currency must be a valid amount." };
      }
      return { ok: true, normalized: cleaned };
    }
    case "percentage": {
      if (!isValidNumberLike(v, false)) {
        return { ok: false, message: "Default percentage must be a valid number." };
      }
      const n = parseFloat(v);
      if (n < 0) {
        return { ok: false, message: "Default percentage cannot be negative." };
      }
      return { ok: true, normalized: v };
    }
    case "select":
    case "radio":
      if (opts.length === 0) {
        return {
          ok: false,
          message: "Add at least one option before setting a default.",
        };
      }
      if (!optionSet.has(v)) {
        return { ok: false, message: "Default must be one of the defined options." };
      }
      return { ok: true, normalized: v };
    case "multiselect":
    case "multicheckbox": {
      if (opts.length === 0) {
        return {
          ok: false,
          message: "Add at least one option before setting a default.",
        };
      }
      const parts = parseMultiselectDefault(v);
      if (parts.length === 0) {
        return { ok: true, normalized: "" };
      }
      for (const p of parts) {
        if (!optionSet.has(p)) {
          return {
            ok: false,
            message: `Each default value must be one of the options. Invalid: "${p}".`,
          };
        }
      }
      return { ok: true, normalized: parts.join(",") };
    }
    case "checkbox":
      if (v !== "true" && v !== "false") {
        return { ok: false, message: 'Checkbox default must be "true" or "false".' };
      }
      return { ok: true, normalized: v };
    case "lookup": {
      if (
        v === AUTO_CURRENT_OWNER_USER_ID &&
        params.lookupType === "owner"
      ) {
        return { ok: true, normalized: AUTO_CURRENT_OWNER_USER_ID };
      }
      if (!/^\d+$/.test(v)) {
        return { ok: false, message: "Lookup default must be a numeric record ID." };
      }
      return { ok: true, normalized: v };
    }
    case "multiselect_lookup": {
      const ids = parseMultiselectDefault(v);
      if (ids.length === 0) return { ok: true, normalized: "" };
      for (const id of ids) {
        if (!/^\d+$/.test(id)) {
          return {
            ok: false,
            message: "Each lookup ID must be numeric.",
          };
        }
      }
      return { ok: true, normalized: ids.join(",") };
    }
    case "email":
      if (!SIMPLE_EMAIL.test(v)) {
        return { ok: false, message: "Default email format is invalid." };
      }
      return { ok: true, normalized: v };
    case "url":
    case "link":
      try {
        const u = new URL(v);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return { ok: false, message: "URL must start with http:// or https://." };
        }
      } catch {
        return { ok: false, message: "Default URL is not valid." };
      }
      return { ok: true, normalized: v };
    case "file":
      return {
        ok: false,
        message: "File fields cannot have a default value.",
      };
    case "composite":
      return {
        ok: false,
        message: "Composite fields cannot have a default value.",
      };

    default:
      return { ok: true, normalized: v };
  }
}
