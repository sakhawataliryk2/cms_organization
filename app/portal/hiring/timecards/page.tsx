"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/portal/EmptyState";
import LoadingState from "@/components/portal/LoadingState";
import StatusPill from "@/components/portal/StatusPill";

type Filter = "all" | "submitted" | "approved" | "rejected";

export default function HiringTimecardsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async (f: Filter) => {
    setLoading(true);
    const qs = f === "all" ? "" : `?status=${encodeURIComponent(f)}`;
    const res = await fetch(`/api/portal/hiring/timecards${qs}`, { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRows(Array.isArray(data?.timecards) ? data.timecards : []);
    setLoading(false);
  };

  const review = async (id: number, action: "approve" | "reject") => {
    await fetch(`/api/portal/hiring/timecards/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    void load(filter);
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["all", "submitted", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filter === f ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingState text="Loading timecards..." />
      ) : !rows.length ? (
        <EmptyState text="No timecards found." />
      ) : (
        rows.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{t.first_name} {t.last_name}</p>
              <StatusPill value={t.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">Week: {String(t.week_start_date || "").slice(0, 10)}</p>
            <p className="text-sm text-slate-600">Hours: {Number(t.total_hours || 0).toFixed(2)}</p>
            <p className="text-sm text-slate-600">
              Rate: ${Number(t.rate_per_hour || t.rate || 0).toFixed(2)}/hr
            </p>
            {String(t.status || "").toLowerCase() === "submitted" ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => review(Number(t.id), "approve")}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => review(Number(t.id), "reject")}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

