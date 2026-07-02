export interface NavRouteConfig {
  name: string;
  path: string;
  permission: string;
}

/** Sidebar order — also used for landing redirects when home/dashboard is denied. */
export const NAV_ROUTE_CONFIG: NavRouteConfig[] = [
  { name: "Home", path: "/home", permission: "global.home.view" },
  {
    name: "Organizations",
    path: "/dashboard/organizations",
    permission: "organizations.list.view",
  },
  { name: "Jobs", path: "/dashboard/jobs", permission: "jobs.list.view" },
  {
    name: "Job Seekers",
    path: "/dashboard/job-seekers",
    permission: "job_seekers.list.view",
  },
  { name: "Leads", path: "/dashboard/leads", permission: "leads.list.view" },
  {
    name: "Hiring Managers",
    path: "/dashboard/hiring-managers",
    permission: "hiring_managers.list.view",
  },
  {
    name: "Planner",
    path: "/dashboard/planner",
    permission: "planner.appointments.list.view",
  },
  { name: "Tasks", path: "/dashboard/tasks", permission: "tasks.list.view" },
  {
    name: "Goals & Quotas",
    path: "/dashboard/goals",
    permission: "global.goals.view",
  },
  {
    name: "Placements",
    path: "/dashboard/placements",
    permission: "placements.list.view",
  },
  {
    name: "Tearsheets",
    path: "/dashboard/tearsheets",
    permission: "tearsheets.list.view",
  },
  {
    name: "Admin Center",
    path: "/dashboard/admin",
    permission: "global.admin_center.view",
  },
];

export const LANDING_PATHS = ["/home", "/dashboard"] as const;

export function getFirstAllowedRoute(
  can: (code: string) => boolean,
  isSuper: boolean
): string | null {
  if (isSuper) return "/home";

  for (const route of NAV_ROUTE_CONFIG) {
    if (can(route.permission)) return route.path;
  }

  return null;
}

export function resolveLandingRedirect(
  pathname: string,
  can: (code: string) => boolean,
  isSuper: boolean
): string | null {
  if (!LANDING_PATHS.includes(pathname as (typeof LANDING_PATHS)[number])) {
    return null;
  }

  if (isSuper || can("global.home.view")) {
    return null;
  }

  const firstAllowed = getFirstAllowedRoute(can, isSuper);
  if (firstAllowed && firstAllowed !== pathname) {
    return firstAllowed;
  }

  return null;
}
