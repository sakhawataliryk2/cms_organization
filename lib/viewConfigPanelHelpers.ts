import type { ViewConfig } from "./viewConfigCache";

type PanelFields = NonNullable<ViewConfig["panel_fields"]>;

export function getPanelFieldPath(
  panelFields: PanelFields | undefined,
  path: string
): string[] | undefined {
  if (!panelFields) return undefined;

  const parts = path.split(".");
  if (parts.length === 1) {
    const val = panelFields[parts[0]];
    return Array.isArray(val) ? val : undefined;
  }

  const [parent, child] = parts;
  const nested = panelFields[parent];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const val = nested[child];
    return Array.isArray(val) ? val : undefined;
  }

  return undefined;
}

export function setPanelFieldPath(
  panelFields: PanelFields | undefined,
  path: string,
  value: string[]
): PanelFields {
  const next: PanelFields = { ...(panelFields || {}) };
  const parts = path.split(".");

  if (parts.length === 1) {
    next[parts[0]] = value;
    return next;
  }

  const [parent, child] = parts;
  const existing = next[parent];
  const nested =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  nested[child] = value;
  next[parent] = nested;
  return next;
}

export function getJobsSubtypePath(
  panel: "jobDetails" | "details",
  jobType?: string | null
): string {
  const normalized = (jobType || "").toLowerCase();
  if (normalized.includes("direct")) return `${panel}.directHire`;
  if (normalized.includes("executive")) return `${panel}.executiveSearch`;
  return `${panel}.default`;
}
