import {
  getAddressFieldNames,
  normalizeAdminEntityType,
} from "./fieldDefinitionCatalog";

export const FULL_ADDRESS_FIELD_KEY = "__fullAddress__";
export const FULL_ADDRESS_FIELD_LABEL = "Full Address";

type FieldDefLike = {
  field_name?: string;
  field_label?: string;
};

type CatalogEntry = {
  key: string;
  label: string;
  name?: string;
};

const RECORD_ADDRESS_KEYS: Record<"address" | "address2" | "city" | "state" | "zip", string[]> = {
  address: ["address", "Address", "address1", "address_1"],
  address2: ["address2", "address_2", "Address2"],
  city: ["city", "City"],
  state: ["state", "State"],
  zip: ["zip", "zip_code", "zipCode", "postal_code", "postalCode"],
};

export function isFullAddressFieldKey(key: string): boolean {
  const bare = key.startsWith("custom:") ? key.slice("custom:".length) : key;
  return bare === FULL_ADDRESS_FIELD_KEY || bare === "fullAddress";
}

export function entityHasAddressFields(entityType: string): boolean {
  const parts = getAddressFieldNames(normalizeAdminEntityType(entityType));
  return Boolean(parts.address || parts.city || parts.state || parts.zip);
}

function isStoredFullAddressLabel(label: string): boolean {
  return /^full address$/i.test(String(label || "").trim());
}

/** Add computed Full Address to panel/header catalogs; drop stored Full Address duplicates. */
export function withFullAddressCatalogEntry<T extends CatalogEntry>(
  catalog: T[],
  entityType: string
): T[] {
  if (!entityHasAddressFields(entityType)) return catalog;

  const filtered = catalog.filter((entry) => !isStoredFullAddressLabel(entry.label));
  if (filtered.some((entry) => isFullAddressFieldKey(entry.key))) return filtered;

  const parts = getAddressFieldNames(normalizeAdminEntityType(entityType));
  const zipKey = parts.zip ? `custom:${parts.zip}` : null;
  const insertIndex = zipKey
    ? filtered.findIndex((entry) => entry.key === zipKey || entry.name === parts.zip)
    : -1;

  const entry = {
    key: FULL_ADDRESS_FIELD_KEY,
    label: FULL_ADDRESS_FIELD_LABEL,
    name: FULL_ADDRESS_FIELD_KEY,
  } as T;

  if (insertIndex >= 0) {
    const next = [...filtered];
    next.splice(insertIndex + 1, 0, entry);
    return next;
  }

  return [...filtered, entry];
}

function readRecordPart(
  record: Record<string, unknown> | undefined,
  part: keyof typeof RECORD_ADDRESS_KEYS
): string {
  if (!record) return "";
  for (const k of RECORD_ADDRESS_KEYS[part]) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function resolveCustomFieldPart(
  fieldName: string | null,
  customFields: Record<string, unknown>,
  fieldDefs?: FieldDefLike[]
): string {
  if (!fieldName) return "";

  const def = fieldDefs?.find(
    (f) => String(f.field_name || "").toLowerCase() === fieldName.toLowerCase()
  );
  const label = def?.field_label ? String(def.field_label).trim() : "";

  // AGENTS.md: field_name → label → custom_fields
  for (const k of [label, fieldName].filter(Boolean)) {
    const v = customFields[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  return "";
}

/** Merge address line 1, line 2, city, state, and zip/postal code. */
export function formatFullAddress(
  entityType: string,
  customFields: Record<string, unknown> | null | undefined,
  options?: {
    fieldDefs?: FieldDefLike[];
    record?: Record<string, unknown>;
    emptyFallback?: string;
  }
): string {
  const parts = getAddressFieldNames(normalizeAdminEntityType(entityType));
  const cf = customFields && typeof customFields === "object" ? customFields : {};
  const fieldDefs = options?.fieldDefs;
  const record = options?.record;

  const merged: string[] = [];

  const addr1 =
    resolveCustomFieldPart(parts.address, cf, fieldDefs) ||
    readRecordPart(record, "address");
  const addr2 =
    resolveCustomFieldPart(parts.address2, cf, fieldDefs) ||
    readRecordPart(record, "address2");
  if (addr1) merged.push(addr1);
  if (addr2) merged.push(addr2);

  const city =
    resolveCustomFieldPart(parts.city, cf, fieldDefs) ||
    readRecordPart(record, "city");
  const state =
    resolveCustomFieldPart(parts.state, cf, fieldDefs) ||
    readRecordPart(record, "state");
  const cityState = [city, state].filter(Boolean).join(", ");
  if (cityState) merged.push(cityState);

  const zip =
    resolveCustomFieldPart(parts.zip, cf, fieldDefs) ||
    readRecordPart(record, "zip");
  if (zip) merged.push(zip);

  if (merged.length === 0) return options?.emptyFallback ?? "";
  return merged.join(", ");
}

export function tryResolveFullAddressValue(
  key: string,
  entityType: string,
  args: {
    customFields?: Record<string, unknown>;
    fieldDefs?: FieldDefLike[];
    record?: Record<string, unknown>;
    emptyPlaceholder?: string;
  }
): string | undefined {
  if (!isFullAddressFieldKey(key)) return undefined;
  const formatted = formatFullAddress(entityType, args.customFields, {
    fieldDefs: args.fieldDefs,
    record: args.record,
  });
  return formatted || args.emptyPlaceholder || "-";
}

export function fullAddressFieldInfo(key: string = FULL_ADDRESS_FIELD_KEY) {
  return {
    key,
    label: FULL_ADDRESS_FIELD_LABEL,
    name: FULL_ADDRESS_FIELD_KEY,
    fieldType: "text",
  };
}
