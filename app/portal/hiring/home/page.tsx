"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/portal/EmptyState";
import KpiCard from "@/components/portal/KpiCard";
import LoadingState from "@/components/portal/LoadingState";
import StatusPill from "@/components/portal/StatusPill";

export default function HiringHomePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/hiring/home", { cache: "no-store" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setData(json || {});
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState text="Loading dashboard..." />;

  const totals = data?.totals || data?.summary || {};
  const recent = Array.isArray(data?.recent) ? data.recent : Array.isArray(data?.recent_timecards) ? data.recent_timecards : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="Submitted" value={totals.submitted ?? 0} />
        <KpiCard label="Approved" value={totals.approved ?? 0} />
        <KpiCard label="Rejected" value={totals.rejected ?? 0} />
      </div>
      {!recent.length ? (
        <EmptyState text="No recent timecards." />
      ) : (
        <div className="space-y-2">
          {recent.map((t: any) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{t.job_seeker_name || `Timecard #${t.id}`}</p>
                <StatusPill value={t.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">Week: {String(t.week_start_date || "").slice(0, 10)}</p>
              <p className="text-sm text-slate-600">Hours: {Number(t.total_hours || t.hours || 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

