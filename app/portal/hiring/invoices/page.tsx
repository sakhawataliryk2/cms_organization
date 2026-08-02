"use client";

import { useEffect, useMemo, useState } from "react";
import { FiFileText } from "react-icons/fi";

export default function HiringInvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState<"all" | "latest">("all");
  const [hoursFilter, setHoursFilter] = useState<"any" | "40+">("any");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/portal/hiring/invoices", { cache: "no-store" }).catch(
        () => null
      );
      const data = await res?.json().catch(() => ({}));
      setRows(Array.isArray(data?.invoices) ? data.invoices : []);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...rows];
    if (weekFilter === "latest" && result.length > 0) {
      const latest = [...result].sort((a, b) =>
        String(b.week_start_date).localeCompare(String(a.week_start_date))
      )[0]?.week_start_date;
      result = result.filter((r) => r.week_start_date === latest);
    }
    if (hoursFilter === "40+") result = result.filter((r) => Number(r.total_hours || r.hours || 0) >= 40);
    return result;
  }, [rows, weekFilter, hoursFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-5">
        <h1 className="text-[20px] font-semibold text-[#1a1a1a]">Invoices</h1>
        <p className="mt-1 text-[14px] text-[#5a6570]">
          Approved timecards available for billing review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setWeekFilter(weekFilter === "all" ? "latest" : "all")}
          className="h-9 rounded-md border border-[#c5ccd4] bg-white px-4 text-[13px] font-semibold text-[#5a6570] hover:bg-[#f7f8fa]"
        >
          Week: {weekFilter === "all" ? "All" : "Latest"}
        </button>
        <button
          type="button"
          onClick={() => setHoursFilter(hoursFilter === "any" ? "40+" : "any")}
          className="h-9 rounded-md border border-[#c5ccd4] bg-white px-4 text-[13px] font-semibold text-[#5a6570] hover:bg-[#f7f8fa]"
        >
          Hours: {hoursFilter}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-[#d8dde3] bg-white py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
        </div>
      ) : !filtered.length ? (
        <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
            <FiFileText size={26} />
          </div>
          <h2 className="text-[18px] font-semibold text-[#1a1a1a]">No invoices found</h2>
          <p className="mt-1 text-[14px] text-[#7a8490]">
            Approved timesheets will show here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <div
              key={inv.id || inv.timecard_id}
              className="rounded-lg border border-[#d8dde3] bg-white px-5 py-4"
            >
              <p className="text-[15px] font-semibold text-[#1a1a1a]">
                {inv.job_seeker_name || `Invoice #${inv.timecard_id || inv.id}`}
              </p>
              <p className="mt-1 text-[13px] text-[#5a6570]">
                Week: {String(inv.week_start_date || "").slice(0, 10)}
              </p>
              <p className="text-[13px] text-[#5a6570]">
                Hours: {Number(inv.hours || inv.total_hours || 0).toFixed(2)} · Rate: $
                {Number(inv.rate || inv.rate_per_hour || 0).toFixed(2)}
              </p>
              <p className="mt-2 text-[15px] font-semibold text-[#1a1a1a]">
                Total: ${Number(inv.total || inv.total_amount || 0).toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 h-9 rounded bg-[#1a6bb5] px-4 text-[13px] font-semibold text-white hover:bg-[#155a9a]"
              >
                Download / Share PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
