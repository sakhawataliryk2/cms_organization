import {
  catalogKeyFromField,
  getStableFieldName,
  type FieldDef,
} from "./fieldCatalogKeys";

export interface DefaultViewFieldDef extends FieldDef {
  is_default?: boolean;
  isDefault?: boolean;
  is_header_default?: boolean;
  isHeaderDefault?: boolean;
  is_hidden?: boolean;
  isHidden?: boolean;
  hidden?: boolean;
  sort_order?: number;
  sortOrder?: number;
  header_sort_order?: number;
  headerSortOrder?: number;
  /** When true, treat as a backend/list column key rather than custom:Field_N */
  isBackendColumn?: boolean;
}

function isHiddenField(f: DefaultViewFieldDef): boolean {
  return Boolean(f?.is_hidden || f?.hidden || f?.isHidden);
}

function isDefaultField(f: DefaultViewFieldDef): boolean {
  return Boolean(f?.is_default || f?.isDefault);
}

function isHeaderDefaultField(f: DefaultViewFieldDef): boolean {
  return Boolean(f?.is_header_default || f?.isHeaderDefault);
}

function sortOrderOf(f: DefaultViewFieldDef): number {
  const n = Number(f?.sort_order ?? f?.sortOrder ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function headerSortOrderOf(f: DefaultViewFieldDef): number {
  const n = Number(f?.header_sort_order ?? f?.headerSortOrder ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dedupePreserve(keys: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(k);
  }
  return unique;
}

function withAlwaysInclude(
  keys: string[],
  catalogSet: Set<string>,
  alwaysInclude?: string[]
): string[] {
  if (!alwaysInclude?.length) return keys;
  const prefix = alwaysInclude.filter((k) => catalogSet.has(k) && !keys.includes(k));
  return dedupePreserve([...prefix, ...keys]);
}

export type DefaultVisibleKeysOptions = {
  /** Resolve catalog key for a field; defaults to custom:/backend via isBackendColumn */
  keyForField?: (f: DefaultViewFieldDef) => string;
  /**
   * Used when no fields are marked Default / Header Default.
   * Defaults to catalogKeys (all non-hidden). Jobs can pass required-only keys.
   */
  fallbackKeys?: string[];
  /** Keys always prepended when using Default/fallback (e.g. record_number) */
  alwaysInclude?: string[];
  /**
   * Which Admin default flag to use.
   * - "default" (overview + panels): is_default + sort_order
   * - "headerDefault" (view-page headers): is_header_default + header_sort_order
   */
  defaultFlag?: "default" | "headerDefault";
  /** Which sort column to order by; defaults based on defaultFlag when omitted */
  sortField?: "sort_order" | "header_sort_order";
};

/**
 * True when the saved layout is empty or still the old auto-persisted
 * "show every catalog field" layout (not a real user customization).
 */
export function isUncustomizedLayout(
  savedKeys: string[] | null | undefined,
  catalogKeys: string[]
): boolean {
  if (!Array.isArray(savedKeys) || savedKeys.length === 0) return true;
  if (!catalogKeys.length) return true;

  const savedSet = new Set(savedKeys);
  // Auto-persist saved every catalog key; treat that as not customized.
  return catalogKeys.every((k) => savedSet.has(k));
}

/**
 * Keys for the initial overview/panel (or header) layout for first-time users.
 * Uses fields marked Default / Header Default (and not hidden), ordered by the matching sort field.
 * If none are marked, uses fallbackKeys or all catalogKeys.
 */
export function getDefaultVisibleKeys(
  fields: DefaultViewFieldDef[] | null | undefined,
  catalogKeys: string[],
  options?: DefaultVisibleKeysOptions
): string[] {
  const catalogSet = new Set(catalogKeys);
  if (!catalogKeys.length) return [];

  const keyFor =
    options?.keyForField ||
    ((f: DefaultViewFieldDef) =>
      catalogKeyFromField(f, Boolean(f.isBackendColumn)));

  const useHeaderDefault = options?.defaultFlag === "headerDefault";
  const sortField =
    options?.sortField ||
    (useHeaderDefault ? "header_sort_order" : "sort_order");
  const orderOf = sortField === "header_sort_order" ? headerSortOrderOf : sortOrderOf;
  const isMarkedDefault = useHeaderDefault ? isHeaderDefaultField : isDefaultField;

  const defaultKeys = (fields || [])
    .filter((f) => isMarkedDefault(f) && !isHiddenField(f) && getStableFieldName(f))
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map((f) => keyFor(f))
    .filter((k) => catalogSet.has(k));

  const unique = dedupePreserve(defaultKeys);

  if (unique.length > 0) {
    return withAlwaysInclude(unique, catalogSet, options?.alwaysInclude);
  }

  // Explicit fallbackKeys (including empty array) — do not expand to all catalog keys.
  // Overview/panels omit fallbackKeys and keep the prior "show all catalog" behavior.
  if (options?.fallbackKeys !== undefined) {
    const fallback = options.fallbackKeys
      .filter((k) => catalogSet.has(k))
      .filter(Boolean);
    return withAlwaysInclude(fallback, catalogSet, options?.alwaysInclude);
  }

  return withAlwaysInclude([...catalogKeys], catalogSet, options?.alwaysInclude);
}

/**
 * Effective visible keys: real saved custom layouts win; otherwise Default fallback.
 * Layouts that still contain every catalog field (old auto-persist) are treated as uncustomized.
 */
export function getEffectiveVisibleKeys(
  savedKeys: string[] | null | undefined,
  fields: DefaultViewFieldDef[] | null | undefined,
  catalogKeys: string[],
  options?: DefaultVisibleKeysOptions
): string[] {
  if (!isUncustomizedLayout(savedKeys, catalogKeys)) {
    return savedKeys as string[];
  }
  return getDefaultVisibleKeys(fields, catalogKeys, options);
}
