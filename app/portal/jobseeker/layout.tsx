"use client";

import PortalLayoutShell from "@/components/portal/PortalLayoutShell";
import PortalRoleGuard from "@/components/portal/PortalRoleGuard";

const tabs = [
  { label: "Home", href: "/portal/jobseeker/home" },
  { label: "Jobs", href: "/portal/jobseeker/jobs" },
  { label: "Timecards", href: "/portal/jobseeker/timecards" },
  { label: "Documents", href: "/portal/jobseeker/documents" },
  { label: "Profile", href: "/portal/jobseeker/profile" },
];

export default function JobSeekerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="JOB_SEEKER" mePath="/api/portal/jobseeker/auth/me">
      <PortalLayoutShell
        title="Job Seeker Portal"
        subtitle="Manage tasks, documents, and timecards."
        tabs={tabs}
        logoutPath="/api/portal/jobseeker/auth/logout"
      >
        {children}
      </PortalLayoutShell>
    </PortalRoleGuard>
  );
}

