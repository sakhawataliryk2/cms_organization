import {
  catalogKeyFromField,
  getStableFieldName,
  type FieldDef,
} from "./fieldCatalogKeys";

export interface DefaultViewFieldDef extends FieldDef {
  is_default?: boolean;
  isDefault?: boolean;
  is_hidden?: boolean;
  isHidden?: boolean;
  hidden?: boolean;
  sort_order?: number;
  sortOrder?: number;
  /** When true, treat as a backend/list column key rather than custom:Field_N */
  isBackendColumn?: boolean;
}

function isHiddenField(f: DefaultViewFieldDef): boolean {
  return Boolean(f?.is_hidden || f?.hidden || f?.isHidden);
}

function isDefaultField(f: DefaultViewFieldDef): boolean {
  return Boolean(f?.is_default || f?.isDefault);
}

function sortOrderOf(f: DefaultViewFieldDef): number {
  const n = Number(f?.sort_order ?? f?.sortOrder ?? 0);
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
   * Used when no fields are marked Default.
   * Defaults to catalogKeys (all non-hidden). Jobs can pass required-only keys.
   */
  fallbackKeys?: string[];
  /** Keys always prepended when using Default/fallback (e.g. record_number) */
  alwaysInclude?: string[];
};

/**
 * Keys for the initial overview/panel layout for first-time users.
 * Uses fields marked Default (and not hidden), ordered by sort_order.
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

  const defaultKeys = (fields || [])
    .filter((f) => isDefaultField(f) && !isHiddenField(f) && getStableFieldName(f))
    .sort((a, b) => sortOrderOf(a) - sortOrderOf(b))
    .map((f) => keyFor(f))
    .filter((k) => catalogSet.has(k));

  const unique = dedupePreserve(defaultKeys);

  if (unique.length > 0) {
    return withAlwaysInclude(unique, catalogSet, options?.alwaysInclude);
  }

  const fallback = (options?.fallbackKeys?.length
    ? options.fallbackKeys.filter((k) => catalogSet.has(k))
    : catalogKeys
  ).filter(Boolean);

  return withAlwaysInclude(
    fallback.length > 0 ? fallback : [...catalogKeys],
    catalogSet,
    options?.alwaysInclude
  );
}

/**
 * Effective visible keys: saved layout if non-empty, else Default fallback.
 */
export function getEffectiveVisibleKeys(
  savedKeys: string[] | null | undefined,
  fields: DefaultViewFieldDef[] | null | undefined,
  catalogKeys: string[],
  options?: DefaultVisibleKeysOptions
): string[] {
  if (Array.isArray(savedKeys) && savedKeys.length > 0) {
    return savedKeys;
  }
  return getDefaultVisibleKeys(fields, catalogKeys, options);
}
