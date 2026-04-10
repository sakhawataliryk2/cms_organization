"use client";

import PortalNavbar from "@/components/portal/PortalNavbar";
import PortalRoleGuard from "@/components/portal/PortalRoleGuard";
import { useEffect, useState } from "react";

const tabs = [
  { label: "Home", href: "/portal/jobseeker/home" },
  { label: "Jobs", href: "/portal/jobseeker/jobs" },
  { label: "Timecards", href: "/portal/jobseeker/timecards" },
  { label: "Documents", href: "/portal/jobseeker/documents" },
  { label: "Profile", href: "/portal/jobseeker/profile" },
];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetch("/api/portal/jobseeker/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const js = d?.job_seeker || d?.jobSeeker || d?.user || {};
        const name = [js.first_name, js.last_name].filter(Boolean).join(" ");
        if (name) setUserName(name);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalNavbar
        tabs={tabs}
        logoutPath="/api/portal/jobseeker/auth/logout"
        userName={userName}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function JobSeekerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="JOB_SEEKER" mePath="/api/portal/jobseeker/auth/me">
      <LayoutInner>{children}</LayoutInner>
    </PortalRoleGuard>
  );
}
