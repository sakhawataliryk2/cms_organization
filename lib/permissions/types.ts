export type PermissionScope = "all" | "own" | "assigned" | "team" | "office";

export interface PermissionSelection {
  code: string;
  granted: boolean;
  scope: PermissionScope;
}

export interface ScopedRecordLike {
  created_by?: number | string | null;
  createdBy?: number | string | null;
  assigned_to?: number | string | null;
  assignedTo?: number | string | null;
}

export function toScopedRecord(
  record?: ScopedRecordLike | null
): { created_by?: number | string; assigned_to?: number | string } | undefined {
  if (!record) return undefined;
  const createdBy = record.created_by ?? record.createdBy;
  const assignedTo = record.assigned_to ?? record.assignedTo;
  if (
    (createdBy == null || createdBy === "") &&
    (assignedTo == null || assignedTo === "")
  ) {
    return undefined;
  }
  return {
    ...(createdBy != null && createdBy !== "" ? { created_by: createdBy } : {}),
    ...(assignedTo != null && assignedTo !== ""
      ? { assigned_to: assignedTo }
      : {}),
  };
}

const MUTATION_CATEGORIES = new Set([
  "record",
  "bulk",
  "delete",
  "documents",
  "notes",
  "transfer",
  "unarchive",
]);

export function isScopedPermission(code: string): boolean {
  const parts = code.split(".");
  if (parts.length < 3) return false;
  const category = parts[1];
  const action = parts.slice(2).join(".");
  if (action === "view" || action === "check" || action === "query") return false;
  if (MUTATION_CATEGORIES.has(category)) return true;
  if (category === "transfer" && action === "request") return true;
  return false;
}
