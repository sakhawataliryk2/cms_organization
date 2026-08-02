"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useRef, useState } from "react";
import { FiChevronRight, FiHelpCircle, FiLogOut, FiUser } from "react-icons/fi";
import CandidateHelpGuide from "@/components/portal/CandidateHelpGuide";
import TimecardRejectionNotice from "@/components/portal/TimecardRejectionNotice";
import { useCandidatePortal } from "@/components/portal/CandidatePortalContext";
import { confirmTimesheetLeave } from "@/lib/timesheetLeaveGuard";

const TABS = [
  { label: "Timesheets", href: "/portal/jobseeker/timesheets" },
  { label: "Documents", href: "/portal/jobseeker/documents" },
  { label: "History", href: "/portal/jobseeker/reports" },
];

function placementLabel(p: { job_title?: string; organization_name?: string } | null) {
  if (!p) return "No active placement";
  const title = p.job_title || "Placement";
  const org = p.organization_name ? ` (${p.organization_name})` : "";
  const full = `${title}${org}`;
  return full.length > 48 ? `${full.slice(0, 46)}…` : full;
}

export default function CandidatePortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { displayName, placements, activePlacement, setActivePlacementId } = useCandidatePortal();
  const [helpOpen, setHelpOpen] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeHref =
    TABS.find((t) => pathname?.startsWith(t.href))?.href ??
    (pathname?.startsWith("/portal/jobseeker/profile") ? null : TABS[0].href);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setPlacementOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onLogout = async () => {
    if (!confirmTimesheetLeave()) return;
    await fetch("/api/portal/jobseeker/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/portal/login");
  };

  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#1a1a1a]">
      {/* Top header — matches mock navy bar */}
      <header className="bg-[#001B3A] text-white">
        <div className="mx-auto grid h-[52px] max-w-[1100px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-5">
          <div className="truncate text-[15px] font-medium tracking-tight">
            {displayName || "Candidate"}
          </div>

          <div className="relative min-w-0 justify-self-center" ref={menuRef}>
            <button
              type="button"
              onClick={() => placements.length > 1 && setPlacementOpen((v) => !v)}
              className="inline-flex max-w-[min(92vw,420px)] items-center gap-1.5 truncate text-[14px] text-white"
              aria-haspopup={placements.length > 1 ? "listbox" : undefined}
              aria-expanded={placementOpen}
            >
              <span className="whitespace-nowrap font-normal">Active Placement</span>
              <FiChevronRight size={14} className="shrink-0 opacity-90" />
              <span className="truncate font-normal">{placementLabel(activePlacement)}</span>
            </button>
            {placementOpen && placements.length > 1 && (
              <div className="absolute left-1/2 z-50 mt-2 w-[min(100vw-2rem,360px)] -translate-x-1/2 rounded-md border border-[#d8dde3] bg-white py-1 text-left shadow-lg">
                {placements.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePlacementId(p.id);
                      setPlacementOpen(false);
                    }}
                    className={`block w-full truncate px-3 py-2.5 text-left text-sm hover:bg-[#f5f7fa] ${
                      activePlacement?.id === p.id
                        ? "bg-[#e8f1fb] font-medium text-[#1a6bb5]"
                        : "text-[#333]"
                    }`}
                  >
                    {p.job_title || "Placement"}
                    {p.organization_name ? ` (${p.organization_name})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-full p-2 text-white hover:bg-white/10"
              aria-label="Help"
              title="Help"
            >
              <FiHelpCircle size={20} strokeWidth={1.75} />
            </button>
            <Link
              href="/portal/jobseeker/profile"
              className="rounded-full p-2 text-white hover:bg-white/10"
              aria-label="Profile"
              title="Profile"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/90">
                <FiUser size={12} strokeWidth={2} />
              </span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full p-2 text-white hover:bg-white/10"
              aria-label="Logout"
              title="Logout"
            >
              <FiLogOut size={19} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-[#dde3ea] bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-center gap-10 px-5">
          {TABS.map((tab) => {
            const active = activeHref === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative py-3.5 text-[15px] font-medium transition-colors ${
                  active ? "text-[#1a6bb5]" : "text-[#9aa3ad] hover:text-[#66707a]"
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#1a6bb5]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-[1100px] px-5 py-6">{children}</main>

      <CandidateHelpGuide open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TimecardRejectionNotice />
    </div>
  );
}
