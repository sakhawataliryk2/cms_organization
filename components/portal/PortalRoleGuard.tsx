"use client";

import { getCookie } from "cookies-next";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useState } from "react";
import LoadingState from "@/components/portal/LoadingState";

interface PortalRoleGuardProps {
  role: "JOB_SEEKER" | "HIRING_MANAGER";
  mePath: string;
  children: React.ReactNode;
}

export default function PortalRoleGuard({ role, mePath, children }: PortalRoleGuardProps) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const portalRole = String(getCookie("portal_role") || "");
      if (portalRole && portalRole !== role) {
        router.replace("/portal/login");
        return;
      }
      const res = await fetch(mePath, { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (!res || !res.ok) {
        router.replace("/portal/login");
        return;
      }
      setOk(true);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mePath, role, router]);

  if (loading) return <LoadingState text="Loading portal..." />;
  if (!ok) return null;
  return <>{children}</>;
}

