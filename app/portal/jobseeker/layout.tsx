"use client";

import PortalRoleGuard from "@/components/portal/PortalRoleGuard";
import CandidatePortalShell from "@/components/portal/CandidatePortalShell";
import { CandidatePortalProvider } from "@/components/portal/CandidatePortalContext";
import { useEffect, useState } from "react";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    fetch("/api/portal/jobseeker/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const js = d?.job_seeker || d?.jobSeeker || d?.user || {};
        setFirstName(String(js.first_name || "").trim());
        setLastName(String(js.last_name || "").trim());
      })
      .catch(() => null);
  }, []);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  // Mock style: "Last, First"
  const displayName =
    lastName && firstName ? `${lastName}, ${firstName}` : fullName || "Candidate";

  return (
    <CandidatePortalProvider userName={fullName} displayName={displayName}>
      <CandidatePortalShell>{children}</CandidatePortalShell>
    </CandidatePortalProvider>
  );
}

export default function JobSeekerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleGuard role="JOB_SEEKER" mePath="/api/portal/jobseeker/auth/me">
      <LayoutInner>{children}</LayoutInner>
    </PortalRoleGuard>
  );
}
