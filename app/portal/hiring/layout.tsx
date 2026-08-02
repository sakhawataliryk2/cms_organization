"use client";

import PortalRoleGuard from "@/components/portal/PortalRoleGuard";
import HiringPortalShell from "@/components/portal/HiringPortalShell";
import { useEffect, useState } from "react";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    fetch("/api/portal/hiring/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const hm = d?.hiring_manager || d?.hiringManager || d?.user || {};
        setFirstName(String(hm.first_name || "").trim());
        setLastName(String(hm.last_name || "").trim());
      })
      .catch(() => null);
  }, []);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName =
    lastName && firstName ? `${lastName}, ${firstName}` : fullName || "Hiring Manager";

  return <HiringPortalShell displayName={displayName}>{children}</HiringPortalShell>;
}

export default function HiringPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="HIRING_MANAGER" mePath="/api/portal/hiring/auth/me">
      <LayoutInner>{children}</LayoutInner>
    </PortalRoleGuard>
  );
}
