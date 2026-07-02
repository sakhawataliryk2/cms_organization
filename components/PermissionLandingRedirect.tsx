"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { usePermissions } from "@/contexts/PermissionContext";
import { resolveLandingRedirect } from "@/lib/permissions/navConfig";
import { getUser, isAuthenticated } from "@/lib/auth";

export default function PermissionLandingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { can, isSuper, isLoading } = usePermissions();

  useEffect(() => {
    if (!isAuthenticated() || !getUser() || isLoading || !pathname) return;

    const target = resolveLandingRedirect(pathname, can, isSuper);
    if (target) {
      router.replace(target);
    }
  }, [can, isLoading, isSuper, pathname, router]);

  return null;
}
