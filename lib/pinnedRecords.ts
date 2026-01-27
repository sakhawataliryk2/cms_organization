export type PinnedRecord = {
  key: string;
  label: string;
  url: string;
};

export const PINNED_RECORDS_STORAGE_KEY = "pinnedRecords";
export const PINNED_RECORDS_CHANGED_EVENT = "pinnedRecordsChanged";
export const MAX_PINNED_RECORDS = 10;

function safeParse(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function loadPinnedRecords(): PinnedRecord[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(PINNED_RECORDS_STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x: any) => ({
      key: String(x?.key || ""),
      label: String(x?.label || ""),
      url: String(x?.url || ""),
    }))
    .filter((x: PinnedRecord) => x.key && x.url);
}

export function savePinnedRecords(records: PinnedRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PINNED_RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function dispatchPinnedRecordsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PINNED_RECORDS_CHANGED_EVENT));
}

export function isPinnedRecord(key: string): boolean {
  return loadPinnedRecords().some((r) => r.key === key);
}

export function unpinRecord(key: string) {
  const next = loadPinnedRecords().filter((r) => r.key !== key);
  savePinnedRecords(next);
  dispatchPinnedRecordsChanged();
}

export function pinRecord(record: PinnedRecord): { ok: boolean; reason?: "limit" | "duplicate" } {
  const existing = loadPinnedRecords();
  if (existing.some((r) => r.key === record.key)) return { ok: false, reason: "duplicate" };
  if (existing.length >= MAX_PINNED_RECORDS) return { ok: false, reason: "limit" };

  const next = [record, ...existing];
  savePinnedRecords(next);
  dispatchPinnedRecordsChanged();
  return { ok: true };
}

export function togglePinnedRecord(record: PinnedRecord): {
  action: "pinned" | "unpinned" | "limit";
} {
  const existing = loadPinnedRecords();
  const isPinned = existing.some((r) => r.key === record.key);

  if (isPinned) {
    const next = existing.filter((r) => r.key !== record.key);
    savePinnedRecords(next);
    dispatchPinnedRecordsChanged();
    return { action: "unpinned" };
  }

  if (existing.length >= MAX_PINNED_RECORDS) {
    return { action: "limit" };
  }

  const next = [record, ...existing];
  savePinnedRecords(next);
  dispatchPinnedRecordsChanged();
  return { action: "pinned" };
}

export function buildPinnedKey(module: string, id: string | number) {
  return `${module}:${String(id)}`;
}
