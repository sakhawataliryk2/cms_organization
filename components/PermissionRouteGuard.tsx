"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { usePermissions } from "@/contexts/PermissionContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ScopedRecordLike, toScopedRecord } from "@/lib/permissions/types";
import { getFirstAllowedRoute } from "@/lib/permissions/navConfig";

interface PermissionRouteGuardProps {
  permission: string;
  record?: ScopedRecordLike | null;
  redirectTo?: string;
  children: ReactNode;
}

export default function PermissionRouteGuard({
  permission,
  record,
  redirectTo,
  children,
}: PermissionRouteGuardProps) {
  const { can, isSuper, isLoading } = usePermissions();
  const router = useRouter();
  const scopedRecord = toScopedRecord(record ?? undefined);
  const allowed = can(
    permission,
    scopedRecord ? { record: scopedRecord } : undefined
  );

  const fallbackRoute = useMemo(
    () => getFirstAllowedRoute(can, isSuper) ?? "/auth/login",
    [can, isSuper]
  );
  const destination = redirectTo ?? fallbackRoute;

  useEffect(() => {
    if (isLoading) return;
    if (!allowed) {
      router.replace(destination);
    }
  }, [allowed, destination, isLoading, router]);

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
