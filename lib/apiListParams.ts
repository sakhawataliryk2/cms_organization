export const LIST_API_PASSTHROUGH_KEYS = [
  "page",
  "limit",
  "offset",
  "q",
  "search",
  "sort",
  "order",
  "filters",
  "includeArchived",
  "archivedOnly",
  "archived",
] as const;

export function buildListQueryString(
  incomingParams: URLSearchParams,
  keys: readonly string[] = LIST_API_PASSTHROUGH_KEYS,
): string {
  const qs = new URLSearchParams();
  for (const key of keys) {
    const value = incomingParams.get(key);
    if (value !== null && value !== "") qs.set(key, value);
  }
  return qs.toString();
}

export const SEARCH_DEBOUNCE_MS = 400;
export const COLUMN_FILTER_DEBOUNCE_MS = 400;
