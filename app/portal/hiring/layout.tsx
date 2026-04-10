"use client";

import PortalLayoutShell from "@/components/portal/PortalLayoutShell";
import PortalRoleGuard from "@/components/portal/PortalRoleGuard";

const tabs = [
  { label: "Home", href: "/portal/hiring/home" },
  { label: "Time Cards", href: "/portal/hiring/timecards" },
  { label: "Invoices", href: "/portal/hiring/invoices" },
  { label: "Profile", href: "/portal/hiring/profile" },
];

export default function HiringPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="HIRING_MANAGER" mePath="/api/portal/hiring/auth/me">
      <PortalLayoutShell
        title="Hiring Manager Portal"
        subtitle="Review timecards and invoices."
        tabs={tabs}
        logoutPath="/api/portal/hiring/auth/logout"
      >
        {children}
      </PortalLayoutShell>
    </PortalRoleGuard>
  );
}