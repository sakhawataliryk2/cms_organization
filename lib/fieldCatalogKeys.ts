export interface ColumnCatalogItem {
  key: string;
  label: string;
  name?: string;
}

export function getCustomFieldsBag(
  record: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!record) return {};
  const bag =
    (record as { customFields?: Record<string, unknown> }).customFields ??
    (record as { custom_fields?: Record<string, unknown> }).custom_fields;
  return bag && typeof bag === "object" ? bag : {};
}

/** Resolve a custom column value — custom_fields JSON keys are usually field labels */
export function resolveCustomColumnValue(
  record: Record<string, unknown>,
  columnKey: string,
  catalogItem?: ColumnCatalogItem | null
): unknown {
  if (!columnKey.startsWith("custom:")) return undefined;

  const suffix = columnKey.slice("custom:".length);
  const fieldName = (catalogItem?.name || suffix).trim();
  const fieldLabel = (catalogItem?.label || "").trim();
  const cf = getCustomFieldsBag(record);

  const keysToTry = [fieldLabel, fieldName, suffix].filter(
    (k, i, arr) => k.length > 0 && arr.indexOf(k) === i
  );

  for (const k of keysToTry) {
    const v = cf[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return v;
    }
  }

  // Backend columns mis-keyed as custom:field_name (e.g. custom:name)
  if (fieldName && record[fieldName] !== undefined && record[fieldName] !== null) {
    const top = record[fieldName];
    if (String(top).trim() !== "") return top;
  }

  return undefined;
}

export function formatColumnValueOrNA(value: unknown): string {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value);
}

export interface FieldDef {
  field_name?: string;
  field_key?: string;
  field_label?: string;
  api_name?: string;
  id?: string | number;
  name?: string;
  label?: string;
}

export function getStableFieldName(f: FieldDef): string {
  return String(
    f.field_name || f.field_key || f.api_name || f.name || f.id || ""
  );
}

export function backendColumnKey(name: string): string {
  return name;
}

export function customFieldKey(fieldName: string): string {
  return `custom:${fieldName}`;
}

export function catalogKeyFromField(
  f: FieldDef,
  isBackendCol: boolean
): string {
  const name = getStableFieldName(f);
  return isBackendCol ? backendColumnKey(name) : customFieldKey(name);
}

export function catalogKeyFromColumn(
  name: string,
  _label: string | undefined,
  isBackendCol: boolean
): string {
  return isBackendCol ? backendColumnKey(name) : customFieldKey(name);
}

export function headerCatalogKeyFromField(f: FieldDef): string {
  return customFieldKey(getStableFieldName(f));
}

export function panelCatalogKeyFromField(f: FieldDef): string {
  return customFieldKey(getStableFieldName(f));
}

/** Remap legacy label-based custom keys to field_name-based keys */
export function remapLegacyCustomKeys(
  keys: string[],
  catalog: Array<{ key: string; label: string }>
): string[] {
  if (!keys.length || !catalog.length) return keys;

  const labelToKey = new Map<string, string>();
  const validKeys = new Set(catalog.map((c) => c.key));

  for (const item of catalog) {
    if (item.label) {
      labelToKey.set(item.label.toLowerCase(), item.key);
    }
    const catalogName = (item as ColumnCatalogItem).name;
    if (catalogName) {
      labelToKey.set(catalogName.toLowerCase(), item.key);
    }
  }

  return keys
    .map((key) => {
      if (!key.startsWith("custom:")) {
        return validKeys.has(key) ? key : null;
      }

      const suffix = key.slice("custom:".length);
      if (validKeys.has(key)) return key;

      const byLabel = labelToKey.get(suffix.toLowerCase());
      if (byLabel) return byLabel;

      const bareName = suffix;
      const withPrefix = customFieldKey(bareName);
      if (validKeys.has(withPrefix)) return withPrefix;
      if (validKeys.has(bareName)) return bareName;

      return null;
    })
    .filter((k): k is string => k != null);
}
