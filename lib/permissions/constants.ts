export const MODULE_PERMISSIONS = {
  organizations: { LIST_VIEW: "organizations.list.view" },
  jobs: { LIST_VIEW: "jobs.list.view" },
  job_seekers: { LIST_VIEW: "job_seekers.list.view" },
  leads: { LIST_VIEW: "leads.list.view" },
  hiring_managers: { LIST_VIEW: "hiring_managers.list.view" },
  tasks: { LIST_VIEW: "tasks.list.view" },
  placements: { LIST_VIEW: "placements.list.view" },
  tearsheets: { LIST_VIEW: "tearsheets.list.view" },
  planner: { LIST_VIEW: "planner.appointments.list.view" },
  admin: { CENTER_VIEW: "global.admin_center.view" },
  users: { LIST_VIEW: "admin.users.list.view" },
} as const;
