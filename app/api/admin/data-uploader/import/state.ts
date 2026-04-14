const cancelledImports = new Set<string>();

export function markImportCancelled(importId: string) {
  if (!importId) return;
  cancelledImports.add(importId);
}

export function isImportCancelled(importId?: string | null): boolean {
  if (!importId) return false;
  return cancelledImports.has(importId);
}

export function clearImportCancellation(importId?: string | null) {
  if (!importId) return;
  cancelledImports.delete(importId);
}
