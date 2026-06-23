import type { ViewEntityType } from "./viewConfigEntityTypes";

export type ViewConfig = {
  column_order?: string[];
  favorites?: unknown[];
  advanced_search_recent?: unknown[];
  summary_layout?: { left: string[]; right: string[] };
  header_fields?: string[];
  panel_fields?: Record<string, string[] | Record<string, string[]>>;
  planner_view_type?: string;
  planner_items_per_page?: number;
  tbi_column_layout?: Record<string, string[]>;
  tbi_column_widths?: Record<string, Record<string, number>>;
  client_visits_ack?: Record<string, boolean>;
  _migrated?: boolean;
};

const CACHE_PREFIX = "userViewConfig:";

type LegacyKeyMap = Partial<Record<keyof ViewConfig, string | string[]>>;

const LEGACY_KEY_MAP: Record<ViewEntityType, LegacyKeyMap> = {
  jobs: {
    column_order: "jobsColumnOrder",
    favorites: "jobsFavorites",
    advanced_search_recent: "jobsAdvancedSearchRecent",
  },
  "jobs-archived": {
    column_order: "jobsArchivedColumnOrder",
    favorites: "jobsArchivedFavorites",
  },
  "jobs-detail": {
    summary_layout: "jobsSummaryColumns",
    panel_fields: [
      "jobsHiringManagerFields",
      "jobsJobDetailsFields",
      "jobsDirectHireJobDetailsFields",
      "jobsExecutiveSearchJobDetailsFields",
      "jobsDetailsFields",
      "jobsDirectHireDetailsFields",
      "jobsExecutiveSearchDetailsFields",
    ],
  },
  "hiring-managers": {
    column_order: "hiringManagerColumnOrder",
    favorites: "hiringManagersFavorites",
  },
  "hiring-managers-archived": {
    column_order: "hiringManagerArchivedColumnOrder",
    favorites: "hiringManagersArchivedFavorites",
  },
  "hiring-managers-detail": {
    summary_layout: "hiringManagerSummaryColumns",
    panel_fields: [
      "hiringManagerDetailsFields",
      "hiringManagerOrganizationDetailsFields",
    ],
  },
  organizations: {
    column_order: "organizationColumnOrder",
    favorites: "organizationsFavorites",
    advanced_search_recent: "organizationAdvancedSearchRecent",
  },
  "organizations-archived": {
    column_order: "organizationArchivedColumnOrder",
    favorites: "organizationArchivedFavorites",
  },
  "organizations-detail": {
    summary_layout: "organizationSummaryColumns",
    panel_fields: ["organizationContactInfoFields"],
  },
  leads: {
    column_order: "leadsColumnOrder",
    favorites: "leadsFavorites",
  },
  "leads-archived": {
    column_order: "leadArchivedColumnOrder",
    favorites: "leadArchivedFavorites",
  },
  "leads-detail": {
    summary_layout: "leadsSummaryColumns",
    panel_fields: [
      "leadsContactInfoFields",
      "leadsDetailsFields",
      "leadsWebsiteJobsFields",
      "leadsOurJobsFields",
    ],
  },
  placements: {
    column_order: "placementsColumnOrder",
    favorites: "placementsFavorites",
  },
  "placements-archived": {
    column_order: "placementsArchivedColumnOrder",
    favorites: "placementsArchivedFavorites",
  },
  "placements-detail": {
    summary_layout: "placementSummaryColumns",
    panel_fields: [
      "placementSummaryCandidateFields",
      "placementSummaryCompanyFields",
      "placementSummaryBillingContactFields",
      "placementSummaryTimesheetApproverFields",
      "placementSummaryJobFields",
      "placementDetailsFields",
    ],
  },
  "job-seekers": {
    column_order: "jobSeekerColumnOrder",
    favorites: "jobSeekersFavorites",
    advanced_search_recent: "jobSeekersAdvancedSearchRecent",
  },
  "job-seekers-archived": {
    column_order: "jobSeekerArchivedColumnOrder",
    favorites: "jobSeekersArchivedFavorites",
  },
  "job-seekers-detail": {
    summary_layout: "jobSeekerSummaryColumns",
    panel_fields: [
      "jobSeekersJobSeekerDetailsFields",
      "jobSeekersOverviewFields",
      "jobSeekersPayrollInfoFields",
    ],
  },
  tasks: {
    column_order: "tasksColumnOrder",
    favorites: "tasksFavorites",
  },
  "tasks-archived": {
    column_order: "tasksArchivedColumnOrder",
    favorites: "tasksArchivedFavorites",
  },
  "tasks-detail": {
    summary_layout: "taskSummaryColumns",
    panel_fields: ["taskDetailsFields", "taskOverviewFields"],
  },
  tearsheets: {
    column_order: "tearsheetsColumnOrder",
    favorites: "tearsheetsFavorites",
  },
  "tearsheets-detail": {},
  tbi: {
    tbi_column_layout: "tbi-column-layout",
    tbi_column_widths: "tbi-column-widths",
  },
  planner: {},
};

const JOBS_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  jobsHiringManagerFields: "hiringManager",
  jobsJobDetailsFields: "jobDetails.default",
  jobsDirectHireJobDetailsFields: "jobDetails.directHire",
  jobsExecutiveSearchJobDetailsFields: "jobDetails.executiveSearch",
  jobsDetailsFields: "details.default",
  jobsDirectHireDetailsFields: "details.directHire",
  jobsExecutiveSearchDetailsFields: "details.executiveSearch",
};

const HM_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  hiringManagerDetailsFields: "details",
  hiringManagerOrganizationDetailsFields: "organizationDetails",
};

const LEADS_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  leadsContactInfoFields: "contactInfo",
  leadsDetailsFields: "details",
  leadsWebsiteJobsFields: "websiteJobs",
  leadsOurJobsFields: "ourJobs",
};

const PLACEMENTS_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  placementSummaryCandidateFields: "candidate",
  placementSummaryCompanyFields: "company",
  placementSummaryBillingContactFields: "billingContact",
  placementSummaryTimesheetApproverFields: "timesheetApprover",
  placementSummaryJobFields: "job",
  placementDetailsFields: "placementDetails",
};

const JOB_SEEKERS_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  jobSeekersJobSeekerDetailsFields: "jobSeekerDetails",
  jobSeekersOverviewFields: "overview",
  jobSeekersPayrollInfoFields: "payrollInfo",
};

const TASKS_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  taskDetailsFields: "details",
  taskOverviewFields: "overview",
};

const ORG_DETAIL_PANEL_KEY_MAP: Record<string, string> = {
  organizationContactInfoFields: "contactInfo",
};

function cacheKey(entityType: ViewEntityType): string {
  return `${CACHE_PREFIX}${entityType}`;
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setNestedPanelField(
  target: Record<string, string[] | Record<string, string[]>>,
  path: string,
  value: string[]
) {
  const parts = path.split(".");
  if (parts.length === 1) {
    target[parts[0]] = value;
    return;
  }
  const [parent, child] = parts;
  const existing = target[parent];
  const nested =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  nested[child] = value;
  target[parent] = nested;
}

export function readCache(entityType: ViewEntityType): ViewConfig | null {
  if (typeof window === "undefined") return null;
  return readJson<ViewConfig>(localStorage.getItem(cacheKey(entityType)));
}

export function writeCache(
  entityType: ViewEntityType,
  config: ViewConfig
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(cacheKey(entityType), JSON.stringify(config));
}

export function mergeCache(
  entityType: ViewEntityType,
  partial: Partial<ViewConfig>
): ViewConfig {
  const existing = readCache(entityType) || {};
  const merged = { ...existing, ...partial };
  writeCache(entityType, merged);
  return merged;
}

function migratePanelFieldsFromLegacy(
  entityType: ViewEntityType,
  legacyKeys: string[]
): Record<string, string[] | Record<string, string[]>> | undefined {
  const panelKeyMaps: Partial<Record<ViewEntityType, Record<string, string>>> = {
    "jobs-detail": JOBS_DETAIL_PANEL_KEY_MAP,
    "hiring-managers-detail": HM_DETAIL_PANEL_KEY_MAP,
    "organizations-detail": ORG_DETAIL_PANEL_KEY_MAP,
    "leads-detail": LEADS_DETAIL_PANEL_KEY_MAP,
    "placements-detail": PLACEMENTS_DETAIL_PANEL_KEY_MAP,
    "job-seekers-detail": JOB_SEEKERS_DETAIL_PANEL_KEY_MAP,
    "tasks-detail": TASKS_DETAIL_PANEL_KEY_MAP,
  };

  const keyMap = panelKeyMaps[entityType];
  if (!keyMap) return undefined;

  const result: Record<string, string[] | Record<string, string[]>> = {};
  let found = false;

  for (const legacyKey of legacyKeys) {
    const raw = localStorage.getItem(legacyKey);
    const parsed = readJson<string[]>(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) continue;

    const targetPath = keyMap[legacyKey];
    if (!targetPath) continue;

    setNestedPanelField(result, targetPath, parsed);
    found = true;
  }

  return found ? result : undefined;
}

export function migrateLegacyLocalStorage(
  entityType: ViewEntityType
): ViewConfig {
  if (typeof window === "undefined") return {};

  const map = LEGACY_KEY_MAP[entityType];
  if (!map) return {};

  const migrated: ViewConfig = {};

  for (const [configKey, legacyKey] of Object.entries(map)) {
    if (configKey === "panel_fields" && Array.isArray(legacyKey)) {
      const panels = migratePanelFieldsFromLegacy(entityType, legacyKey);
      if (panels) migrated.panel_fields = panels;
      continue;
    }

    if (typeof legacyKey !== "string") continue;

    const raw = localStorage.getItem(legacyKey);
    if (!raw) continue;

    const parsed = readJson<unknown>(raw);
    if (parsed == null) continue;

    (migrated as Record<string, unknown>)[configKey] = parsed;
  }

  if (entityType === "organizations-detail") {
    const ack: Record<string, boolean> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("cms_org_client_visits_ack_")) continue;
      const orgId = key.replace("cms_org_client_visits_ack_", "");
      const val = localStorage.getItem(key);
      if (val === "true") ack[orgId] = true;
    }
    if (Object.keys(ack).length > 0) {
      migrated.client_visits_ack = ack;
    }
  }

  return migrated;
}

export function clearLegacyLocalStorage(entityType: ViewEntityType): void {
  if (typeof window === "undefined") return;

  const map = LEGACY_KEY_MAP[entityType];
  if (!map) return;

  for (const legacyKey of Object.values(map)) {
    if (Array.isArray(legacyKey)) {
      legacyKey.forEach((k) => localStorage.removeItem(k));
    } else if (typeof legacyKey === "string") {
      localStorage.removeItem(legacyKey);
    }
  }

  if (entityType === "organizations-detail") {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cms_org_client_visits_ack_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

export function getConfigValue<T>(
  config: ViewConfig,
  key: keyof ViewConfig
): T | undefined {
  return config[key] as T | undefined;
}
