"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/contexts/PermissionContext";
import { OrgRecordLike, toOrgRecord } from "@/lib/organizationPermissions";

interface PermissionGateProps {
  permission: string;
  record?: OrgRecordLike | null;
  fallback?: ReactNode;
  hideWhileLoading?: boolean;
  children: ReactNode;
}

export default function PermissionGate({
  permission,
  record,
  fallback = null,
  hideWhileLoading = true,
  children,
}: PermissionGateProps) {
  const { can, isLoading } = usePermissions();
  const scopedRecord = toOrgRecord(record ?? undefined);

  if (isLoading && hideWhileLoading) {
    return <>{fallback}</>;
  }

  if (!can(permission, scopedRecord ? { record: scopedRecord } : undefined)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
