"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/portal/EmptyState";
import LoadingState from "@/components/portal/LoadingState";
import StatusPill from "@/components/portal/StatusPill";

export default function JobSeekerTimecardsPage() {
  const [timecards, setTimecards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/jobseeker/timecards", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setTimecards(Array.isArray(data?.timecards) ? data.timecards : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState text="Loading timecards..." />;

  return (
    <div className="space-y-3">
      {!timecards.length ? (
        <EmptyState text="No timecards found." />
      ) : (
        timecards.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">
                Week: {String(t.week_start_date || "").slice(0, 10) || "N/A"}
              </p>
              <StatusPill value={t.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">Total hours: {Number(t.total_hours || 0).toFixed(2)}</p>
          </div>
        ))
      )}
    </div>
  );
}

