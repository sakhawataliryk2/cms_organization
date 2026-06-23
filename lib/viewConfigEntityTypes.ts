export const VIEW_ENTITY_TYPES = {
  jobs: "jobs",
  jobsArchived: "jobs-archived",
  jobsDetail: "jobs-detail",
  hiringManagers: "hiring-managers",
  hiringManagersArchived: "hiring-managers-archived",
  hiringManagersDetail: "hiring-managers-detail",
  organizations: "organizations",
  organizationsArchived: "organizations-archived",
  organizationsDetail: "organizations-detail",
  leads: "leads",
  leadsArchived: "leads-archived",
  leadsDetail: "leads-detail",
  placements: "placements",
  placementsArchived: "placements-archived",
  placementsDetail: "placements-detail",
  jobSeekers: "job-seekers",
  jobSeekersArchived: "job-seekers-archived",
  jobSeekersDetail: "job-seekers-detail",
  tasks: "tasks",
  tasksArchived: "tasks-archived",
  tasksDetail: "tasks-detail",
  tearsheets: "tearsheets",
  tearsheetsDetail: "tearsheets-detail",
  tbi: "tbi",
  planner: "planner",
} as const;

export type ViewEntityType =
  (typeof VIEW_ENTITY_TYPES)[keyof typeof VIEW_ENTITY_TYPES];

/** Maps entity_type to header_configs entity_type for org-wide defaults */
export const HEADER_CONFIG_ENTITY_MAP: Partial<
  Record<ViewEntityType, { entityType: string; configType: "header" | "columns" }>
> = {
  jobs: { entityType: "JOB", configType: "columns" },
  "jobs-archived": { entityType: "JOB", configType: "columns" },
  "jobs-detail": { entityType: "JOB", configType: "header" },
  "hiring-managers": { entityType: "HIRING_MANAGER", configType: "columns" },
  "hiring-managers-archived": {
    entityType: "HIRING_MANAGER",
    configType: "columns",
  },
  "hiring-managers-detail": {
    entityType: "HIRING_MANAGER",
    configType: "header",
  },
  organizations: { entityType: "ORGANIZATION", configType: "columns" },
  "organizations-archived": { entityType: "ORGANIZATION", configType: "columns" },
  "organizations-detail": { entityType: "ORGANIZATION", configType: "header" },
  leads: { entityType: "LEAD", configType: "columns" },
  "leads-archived": { entityType: "LEAD", configType: "columns" },
  "leads-detail": { entityType: "LEAD", configType: "header" },
  placements: { entityType: "PLACEMENT", configType: "columns" },
  "placements-archived": { entityType: "PLACEMENT", configType: "columns" },
  "placements-detail": { entityType: "PLACEMENT", configType: "header" },
  "job-seekers": { entityType: "JOB_SEEKER", configType: "columns" },
  "job-seekers-archived": { entityType: "JOB_SEEKER", configType: "columns" },
  "job-seekers-detail": { entityType: "JOB_SEEKER", configType: "header" },
  tasks: { entityType: "TASK", configType: "columns" },
  "tasks-archived": { entityType: "TASK", configType: "columns" },
  "tasks-detail": { entityType: "TASK", configType: "header" },
  tearsheets: { entityType: "TEARSHEET", configType: "columns" },
  "tearsheets-detail": { entityType: "TEARSHEET", configType: "header" },
};
