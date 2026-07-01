"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "nextjs-toploader/app";
import { usePermissions } from "@/contexts/PermissionContext";
import LoadingScreen from "@/components/LoadingScreen";
import { OrgRecordLike, toOrgRecord } from "@/lib/organizationPermissions";

interface PermissionRouteGuardProps {
  permission: string;
  record?: OrgRecordLike | null;
  redirectTo?: string;
  children: ReactNode;
}

export default function PermissionRouteGuard({
  permission,
  record,
  redirectTo = "/dashboard",
  children,
}: PermissionRouteGuardProps) {
  const { can, isLoading } = usePermissions();
  const router = useRouter();
  const scopedRecord = toOrgRecord(record ?? undefined);
  const allowed = can(
    permission,
    scopedRecord ? { record: scopedRecord } : undefined
  );

  useEffect(() => {
    if (isLoading) return;
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [allowed, isLoading, redirectTo, router]);

  if (isLoading) {
    return <LoadingScreen message="Checking permissions..." />;
  }

  if (!allowed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access denied
          </h2>
          <p className="text-gray-600">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
