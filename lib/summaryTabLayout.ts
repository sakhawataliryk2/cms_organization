export type SummaryLayout = { left: string[]; right: string[] };

export type SummaryPanelDef = {
  id: string;
  title: string;
  /** Approximate visual height in the designer (px), matching typical Summary Tab boxes */
  height: number;
};

export type SummaryModuleCatalog = {
  section: string;
  supported: boolean;
  panels: SummaryPanelDef[];
  systemDefault: SummaryLayout;
};

export type SummaryMoveDirection = "left" | "right" | "up" | "down";

const p = (id: string, title: string, height: number): SummaryPanelDef => ({
  id,
  title,
  height,
});

const JOB_PANELS: SummaryPanelDef[] = [
  p("jobDetails", "Job Details", 280),
  p("details", "Organization / Company Details", 260),
  p("hiringManager", "Hiring Manager", 200),
  p("recentNotes", "Recent Notes", 240),
  p("openTasks", "Open Tasks", 240),
];

const JOB_DEFAULT: SummaryLayout = {
  left: ["jobDetails"],
  right: ["details", "hiringManager", "recentNotes", "openTasks"],
};

const PLACEMENT_PANELS: SummaryPanelDef[] = [
  p("benefitPackage", "Benefit Package", 220),
  p("candidateDetails", "Candidate Details", 200),
  p("companyDetails", "Company Details", 200),
  p("billingContactDetails", "Billing Contact Details", 180),
  p("timesheetApproverDetails", "Timesheet Approver Details", 180),
  p("jobDetails", "Job Details", 200),
  p("placementDetails", "Placement Details", 220),
  p("recentNotes", "Recent Notes", 240),
  p("openTasks", "Open Tasks", 240),
];

const PLACEMENT_DEFAULT: SummaryLayout = {
  left: [
    "benefitPackage",
    "candidateDetails",
    "companyDetails",
    "billingContactDetails",
    "timesheetApproverDetails",
  ],
  right: ["jobDetails", "placementDetails", "recentNotes", "openTasks"],
};

export const SUMMARY_TAB_CATALOG: Record<string, SummaryModuleCatalog> = {
  organizations: {
    section: "organizations",
    supported: true,
    panels: [
      p("contactInfo", "Organization Contact Info", 260),
      p("about", "About", 180),
      p("recentNotes", "Recent Notes", 240),
      p("websiteJobs", "Open Jobs from Website", 200),
      p("ourJobs", "Our Jobs", 180),
      p("openTasks", "Open Tasks", 240),
    ],
    systemDefault: {
      left: ["contactInfo", "about"],
      right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
    },
  },
  jobs: {
    section: "jobs",
    supported: true,
    panels: JOB_PANELS,
    systemDefault: JOB_DEFAULT,
  },
  "jobs-direct-hire": {
    section: "jobs-direct-hire",
    supported: true,
    panels: JOB_PANELS,
    systemDefault: JOB_DEFAULT,
  },
  "jobs-executive-search": {
    section: "jobs-executive-search",
    supported: true,
    panels: JOB_PANELS,
    systemDefault: JOB_DEFAULT,
  },
  "job-seekers": {
    section: "job-seekers",
    supported: true,
    panels: [
      p("resume", "Resume", 320),
      p("jobSeekerDetails", "Job Seeker Details", 280),
      p("overview", "Overview", 220),
      p("payrollInfo", "Payroll Info", 200),
      p("recentNotes", "Recent Notes", 240),
      p("openTasks", "Open Tasks", 240),
    ],
    systemDefault: {
      left: ["resume", "jobSeekerDetails"],
      right: ["overview", "payrollInfo", "recentNotes", "openTasks"],
    },
  },
  leads: {
    section: "leads",
    supported: true,
    panels: [
      p("contactInfo", "Contact Info", 240),
      p("details", "Details", 220),
      p("recentNotes", "Recent Notes", 240),
      p("websiteJobs", "Website Jobs", 200),
      p("ourJobs", "Our Jobs", 180),
      p("openTasks", "Open Tasks", 240),
    ],
    systemDefault: {
      left: ["contactInfo", "details"],
      right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
    },
  },
  "hiring-managers": {
    section: "hiring-managers",
    supported: true,
    panels: [
      p("details", "Hiring Manager Details", 280),
      p("organizationDetails", "Organization Details", 240),
      p("recentNotes", "Recent Notes", 240),
      p("openTasks", "Open Tasks", 240),
    ],
    systemDefault: {
      left: ["details"],
      right: ["organizationDetails", "recentNotes", "openTasks"],
    },
  },
  tasks: {
    section: "tasks",
    supported: true,
    panels: [
      p("taskOverview", "Task Overview", 280),
      p("details", "Details", 220),
      p("recentNotes", "Recent Notes", 240),
    ],
    systemDefault: {
      left: ["taskOverview"],
      right: ["details", "recentNotes"],
    },
  },
  placements: {
    section: "placements",
    supported: true,
    panels: PLACEMENT_PANELS,
    systemDefault: PLACEMENT_DEFAULT,
  },
  "placements-direct-hire": {
    section: "placements-direct-hire",
    supported: true,
    panels: PLACEMENT_PANELS,
    systemDefault: PLACEMENT_DEFAULT,
  },
  "placements-executive-search": {
    section: "placements-executive-search",
    supported: true,
    panels: PLACEMENT_PANELS,
    systemDefault: PLACEMENT_DEFAULT,
  },
  tearsheets: {
    section: "tearsheets",
    supported: true,
    panels: [
      p("overview", "Overview", 220),
      p("statistics", "Statistics", 200),
    ],
    systemDefault: {
      left: ["overview"],
      right: ["statistics"],
    },
  },
  planner: {
    section: "planner",
    supported: false,
    panels: [],
    systemDefault: { left: [], right: [] },
  },
  "goals-quotas": {
    section: "goals-quotas",
    supported: false,
    panels: [],
    systemDefault: { left: [], right: [] },
  },
};

export function getSummaryCatalog(section: string): SummaryModuleCatalog {
  return (
    SUMMARY_TAB_CATALOG[section] || {
      section,
      supported: false,
      panels: [],
      systemDefault: { left: [], right: [] },
    }
  );
}

export function catalogPanelIds(catalog: SummaryModuleCatalog): string[] {
  return catalog.panels.map((panel) => panel.id);
}

export function isSummaryLayout(value: unknown): value is SummaryLayout {
  if (!value || typeof value !== "object") return false;
  const layout = value as SummaryLayout;
  return Array.isArray(layout.left) && Array.isArray(layout.right);
}

export function layoutsEqual(a: SummaryLayout, b: SummaryLayout): boolean {
  return (
    a.left.length === b.left.length &&
    a.right.length === b.right.length &&
    a.left.every((id, i) => id === b.left[i]) &&
    a.right.every((id, i) => id === b.right[i])
  );
}

/**
 * Drop unknown/duplicate panel ids and append newly added catalog panels
 * using the system default column (or the right column as fallback).
 */
export function mergeSummaryLayout(
  saved: SummaryLayout | null | undefined,
  catalogIds: string[],
  systemDefault: SummaryLayout
): SummaryLayout {
  const allowed = new Set(catalogIds);
  const used = new Set<string>();

  const take = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    const next: string[] = [];
    for (const raw of ids) {
      const id = String(raw || "");
      if (!id || !allowed.has(id) || used.has(id)) continue;
      used.add(id);
      next.push(id);
    }
    return next;
  };

  const left = take(saved?.left);
  const right = take(saved?.right);

  for (const id of catalogIds) {
    if (used.has(id)) continue;
    if (systemDefault.left.includes(id)) left.push(id);
    else right.push(id);
    used.add(id);
  }

  return { left, right };
}

export function findPanelColumn(
  layout: SummaryLayout,
  panelId: string
): "left" | "right" | null {
  if (layout.left.includes(panelId)) return "left";
  if (layout.right.includes(panelId)) return "right";
  return null;
}

export function canMoveSummaryPanel(
  layout: SummaryLayout,
  panelId: string,
  direction: SummaryMoveDirection
): boolean {
  const column = findPanelColumn(layout, panelId);
  if (!column) return false;
  const index = layout[column].indexOf(panelId);
  if (direction === "up") return index > 0;
  if (direction === "down") return index >= 0 && index < layout[column].length - 1;
  if (direction === "left") return column === "right";
  if (direction === "right") return column === "left";
  return false;
}

export function applySummaryPanelDrag(
  layout: SummaryLayout,
  activeId: string,
  overId: string
): SummaryLayout {
  const findContainer = (id: string): "left" | "right" | null => {
    if (id === "left" || id === "right") return id;
    if (layout.left.includes(id)) return "left";
    if (layout.right.includes(id)) return "right";
    return null;
  };

  const source = findContainer(activeId);
  const target = findContainer(overId);
  if (!source || !target) {
    return { left: [...layout.left], right: [...layout.right] };
  }

  if (source === target) {
    if (overId === source) {
      return { left: [...layout.left], right: [...layout.right] };
    }
    const items = [...layout[source]];
    const oldIndex = items.indexOf(activeId);
    const newIndex = items.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return { left: [...layout.left], right: [...layout.right] };
    }
    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);
    return { ...layout, [source]: items };
  }

  const sourceItems = layout[source].filter((id) => id !== activeId);
  const targetItems = layout[target].filter((id) => id !== activeId);
  const insertAt =
    overId === target ? targetItems.length : Math.max(0, targetItems.indexOf(overId));
  const safeIndex = insertAt < 0 ? targetItems.length : insertAt;
  targetItems.splice(safeIndex, 0, activeId);

  return {
    ...layout,
    [source]: sourceItems,
    [target]: targetItems,
  };
}

export function moveSummaryPanel(
  layout: SummaryLayout,
  panelId: string,
  direction: SummaryMoveDirection
): SummaryLayout {
  if (!canMoveSummaryPanel(layout, panelId, direction)) {
    return { left: [...layout.left], right: [...layout.right] };
  }

  const next: SummaryLayout = {
    left: [...layout.left],
    right: [...layout.right],
  };
  const column = findPanelColumn(next, panelId)!;
  const from = next[column];
  const index = from.indexOf(panelId);

  if (direction === "up" || direction === "down") {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    [from[index], from[swapWith]] = [from[swapWith], from[index]];
    return next;
  }

  from.splice(index, 1);
  const target = direction === "left" ? next.left : next.right;
  const insertAt = Math.min(index, target.length);
  target.splice(insertAt, 0, panelId);
  return next;
}

export function validateSummaryLayoutPayload(
  layout: unknown,
  catalogIds: string[]
): { ok: true; layout: SummaryLayout } | { ok: false; message: string } {
  if (!isSummaryLayout(layout)) {
    return { ok: false, message: "Layout must include left and right panel arrays" };
  }
  const allowed = new Set(catalogIds);
  const seen = new Set<string>();
  for (const id of [...layout.left, ...layout.right]) {
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, message: "Layout contains an invalid panel id" };
    }
    if (!allowed.has(id)) {
      return { ok: false, message: `Unknown panel: ${id}` };
    }
    if (seen.has(id)) {
      return { ok: false, message: "Layout contains duplicate panel positions" };
    }
    seen.add(id);
  }
  return {
    ok: true,
    layout: { left: [...layout.left], right: [...layout.right] },
  };
}
