"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiClock } from "react-icons/fi";
import { formatWeekRange, statusLabel } from "@/lib/timesheetWeek";

type HistoryRow = {
  id: number;
  status?: string;
  week_start_date?: string;
  total_hours?: number;
  rejection_reason?: string | null;
  placement?: {
    job_title?: string;
    organization_name?: string;
  };
};

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "approved") return "text-[#1f9d57]";
  if (s === "rejected") return "text-[#d64545]";
  if (s === "submitted") return "text-[#e0891a]";
  return "text-[#1a1a1a]";
}

export default function TimesheetHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/portal/jobseeker/timecards", { cache: "no-store" }).catch(
        () => null
      );
      const data = await res?.json().catch(() => ({}));
      setRows(Array.isArray(data?.timecards) ? data.timecards : []);
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-5">
        <h1 className="text-[20px] font-semibold text-[#1a1a1a]">Timesheet History</h1>
        <p className="mt-1 text-[14px] text-[#5a6570]">
          Past weekly timesheets for your placements.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-[#d8dde3] bg-white py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
        </div>
      ) : !rows.length ? (
        <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
            <FiClock size={26} />
          </div>
          <h2 className="text-[18px] font-semibold text-[#1a1a1a]">No timesheets yet</h2>
          <p className="mt-1 text-[14px] text-[#7a8490]">
            Submitted timesheets will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const status = String(t.status || "");
            const week = String(t.week_start_date || "").slice(0, 10);
            const title =
              t.placement?.job_title ||
              t.placement?.organization_name ||
              "Placement";
            return (
              <div
                key={t.id}
                className="rounded-lg border border-[#d8dde3] bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1a1a1a]">{title}</p>
                    <p className="mt-1 text-[13px] text-[#5a6570]">
                      Week: {week ? formatWeekRange(week) : "—"}
                    </p>
                    <p className="text-[13px] text-[#5a6570]">
                      Hours: {Number(t.total_hours || 0).toFixed(2)}
                    </p>
                  </div>
                  <p className={`text-[14px] font-semibold ${statusColor(status)}`}>
                    {statusLabel(status)}
                  </p>
                </div>
                {status.toLowerCase() === "rejected" && (
                  <div className="mt-3 rounded-md border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2.5">
                    <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#d64545]">
                      <FiAlertCircle size={13} />
                      Rejection reason
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#1a1a1a]">
                      {t.rejection_reason?.trim() || "No reason provided."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
