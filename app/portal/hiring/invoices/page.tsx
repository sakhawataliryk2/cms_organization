"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/portal/EmptyState";
import LoadingState from "@/components/portal/LoadingState";

export default function HiringInvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState<"all" | "latest">("all");
  const [hoursFilter, setHoursFilter] = useState<"any" | "40+">("any");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/portal/hiring/invoices", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => ({}));
      setRows(Array.isArray(data?.invoices) ? data.invoices : []);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...rows];
    if (weekFilter === "latest" && result.length > 0) {
      const latest = [...result].sort((a, b) => String(b.week_start_date).localeCompare(String(a.week_start_date)))[0]?.week_start_date;
      result = result.filter((r) => r.week_start_date === latest);
    }
    if (hoursFilter === "40+") result = result.filter((r) => Number(r.total_hours || 0) >= 40);
    return result;
  }, [rows, weekFilter, hoursFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setWeekFilter(weekFilter === "all" ? "latest" : "all")} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          Week: {weekFilter === "all" ? "All" : "Latest"}
        </button>
        <button onClick={() => setHoursFilter(hoursFilter === "any" ? "40+" : "any")} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          Hours: {hoursFilter}
        </button>
      </div>
      {loading ? (
        <LoadingState text="Loading invoices..." />
      ) : !filtered.length ? (
        <EmptyState text="No invoices found." />
      ) : (
        filtered.map((inv) => (
          <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">{inv.job_seeker_name || `Invoice #${inv.timecard_id || inv.id}`}</p>
            <p className="mt-1 text-sm text-slate-600">Week: {String(inv.week_start_date || "").slice(0, 10)}</p>
            <p className="text-sm text-slate-600">
              Hours: {Number(inv.hours || inv.total_hours || 0).toFixed(2)} | Rate: ${Number(inv.rate || inv.rate_per_hour || 0).toFixed(2)}
            </p>
            <p className="text-sm font-medium text-slate-900">Total: ${Number(inv.total || inv.total_amount || 0).toFixed(2)}</p>
            <button
              onClick={() => window.print()}
              className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white"
            >
              Download / Share PDF
            </button>
          </div>
        ))
      )}
    </div>
  );
}

