"use client";

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { formatWeekRange } from "@/lib/timesheetWeek";

type RejectedTimecard = {
  id: number;
  week_start_date?: string;
  total_hours?: number;
  rejection_reason?: string | null;
  placement?: {
    job_title?: string;
    organization_name?: string;
  };
};

export default function TimecardRejectionNotice() {
  const [queue, setQueue] = useState<RejectedTimecard[]>([]);
  const [acking, setAcking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/jobseeker/timecards/unread-rejections", {
      cache: "no-store",
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setQueue(Array.isArray(data?.timecards) ? data.timecards : []);
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => {
      void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const current = queue[0] || null;

  const acknowledge = async () => {
    if (!current?.id || acking) return;
    setAcking(true);
    try {
      await fetch(`/api/portal/jobseeker/timecards/${current.id}/acknowledge-rejection`, {
        method: "POST",
      }).catch(() => null);
      setQueue((prev) => prev.filter((t) => Number(t.id) !== Number(current.id)));
    } finally {
      setAcking(false);
    }
  };

  if (!current) return null;

  const week = String(current.week_start_date || "").slice(0, 10);
  const placementLabel =
    current.placement?.job_title ||
    current.placement?.organization_name ||
    "your placement";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2a3340]/50 p-4">
      <div className="w-full max-w-[440px] rounded-xl bg-white px-7 py-7 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fdecec] text-[#d64545]">
          <FiAlertCircle size={28} />
        </div>
        <h2 className="text-[18px] font-semibold text-[#1a1a1a]">Timesheet rejected</h2>
        <p className="mt-2 text-[14px] text-[#5a6570]">
          Your timesheet for {week ? formatWeekRange(week) : "this week"} ({placementLabel}) was
          rejected by your hiring manager.
        </p>
        {current.rejection_reason?.trim() ? (
          <div className="mt-4 rounded-md border border-[#f5c2c7] bg-[#fff5f5] px-4 py-3 text-left">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#d64545]">
              Reason
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] text-[#1a1a1a]">
              {current.rejection_reason}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-[#5a6570]">No rejection reason was provided.</p>
        )}
        <p className="mt-3 text-[13px] text-[#7a8490]">
          Hours: {Number(current.total_hours || 0).toFixed(2)}
        </p>
        <button
          type="button"
          disabled={acking}
          onClick={() => void acknowledge()}
          className="mt-6 h-11 w-full rounded-md bg-[#1a6bb5] text-[15px] font-semibold text-white hover:bg-[#155a99] disabled:opacity-60"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
