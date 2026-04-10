"use client";

import PortalNavbar from "@/components/portal/PortalNavbar";
import PortalRoleGuard from "@/components/portal/PortalRoleGuard";
import { useEffect, useState } from "react";

const tabs = [
  { label: "Home", href: "/portal/hiring/home" },
  { label: "Time Cards", href: "/portal/hiring/timecards" },
  { label: "Invoices", href: "/portal/hiring/invoices" },
  { label: "Profile", href: "/portal/hiring/profile" },
];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetch("/api/portal/hiring/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const hm = d?.hiring_manager || d?.hiringManager || d?.user || {};
        const name = [hm.first_name, hm.last_name].filter(Boolean).join(" ");
        if (name) setUserName(name);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalNavbar
        tabs={tabs}
        logoutPath="/api/portal/hiring/auth/logout"
        userName={userName}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function HiringPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="HIRING_MANAGER" mePath="/api/portal/hiring/auth/me">
      <LayoutInner>{children}</LayoutInner>
    </PortalRoleGuard>
  );
}
