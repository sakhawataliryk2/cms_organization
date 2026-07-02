"use client";

import { ReactNode } from "react";
import PermissionRouteGuard from "@/components/PermissionRouteGuard";
import { MODULE_PERMISSIONS } from "@/lib/permissions/constants";

type GuardedModule = keyof typeof MODULE_PERMISSIONS;

const PERMISSION_BY_MODULE: Record<GuardedModule, string> = {
  organizations: MODULE_PERMISSIONS.organizations.LIST_VIEW,
  jobs: MODULE_PERMISSIONS.jobs.LIST_VIEW,
  job_seekers: MODULE_PERMISSIONS.job_seekers.LIST_VIEW,
  leads: MODULE_PERMISSIONS.leads.LIST_VIEW,
  hiring_managers: MODULE_PERMISSIONS.hiring_managers.LIST_VIEW,
  tasks: MODULE_PERMISSIONS.tasks.LIST_VIEW,
  placements: MODULE_PERMISSIONS.placements.LIST_VIEW,
  tearsheets: MODULE_PERMISSIONS.tearsheets.LIST_VIEW,
  planner: MODULE_PERMISSIONS.planner.LIST_VIEW,
  admin: MODULE_PERMISSIONS.admin.CENTER_VIEW,
  users: MODULE_PERMISSIONS.users.LIST_VIEW,
};

export default function ModuleListGuard({
  module,
  children,
  redirectTo = "/dashboard",
}: {
  module: GuardedModule;
  children: ReactNode;
  redirectTo?: string;
}) {
  return (
    <PermissionRouteGuard
      permission={PERMISSION_BY_MODULE[module]}
      redirectTo={redirectTo}
    >
      {children}
    </PermissionRouteGuard>
  );
}
