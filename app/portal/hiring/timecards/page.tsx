"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock } from "react-icons/fi";

type Filter = "all" | "submitted" | "approved" | "rejected";

function statusStyles(status: string) {
  const s = status.toLowerCase();
  if (s === "approved") return "text-[#1f9d57]";
  if (s === "rejected") return "text-[#d64545]";
  if (s === "submitted") return "text-[#e0891a]";
  return "text-[#1a1a1a]";
}

function statusLabel(status: string) {
  const s = String(status || "").toLowerCase();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HiringTimecardsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = async (f: Filter) => {
    setLoading(true);
    const qs = f === "all" ? "" : `?status=${encodeURIComponent(f)}`;
    const res = await fetch(`/api/portal/hiring/timecards${qs}`, { cache: "no-store" }).catch(
      () => null
    );
    const data = await res?.json().catch(() => ({}));
    setRows(Array.isArray(data?.timecards) ? data.timecards : []);
    setLoading(false);
  };

  const review = async (id: number, action: "approve" | "reject") => {
    setReviewingId(id);
    try {
      await fetch(`/api/portal/hiring/timecards/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load(filter);
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-5">
        <h1 className="text-[20px] font-semibold text-[#1a1a1a]">Time Cards</h1>
        <p className="mt-1 text-[14px] text-[#5a6570]">
          Review submitted timesheets for your placements.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "submitted", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-9 rounded-md px-4 text-[13px] font-semibold capitalize ${
              filter === f
                ? "bg-[#1a6bb5] text-white"
                : "border border-[#c5ccd4] bg-white text-[#5a6570] hover:bg-[#f7f8fa]"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
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
          <h2 className="text-[18px] font-semibold text-[#1a1a1a]">No timecards found</h2>
          <p className="mt-1 text-[14px] text-[#7a8490]">
            Nothing matches this filter right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const status = String(t.status || "").toLowerCase();
            return (
              <div
                key={t.id}
                className="rounded-lg border border-[#d8dde3] bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1a1a1a]">
                      {t.first_name} {t.last_name}
                    </p>
                    <p className="mt-1 text-[13px] text-[#5a6570]">
                      Week: {String(t.week_start_date || "").slice(0, 10)}
                    </p>
                    <p className="text-[13px] text-[#5a6570]">
                      Hours: {Number(t.total_hours || 0).toFixed(2)} · Rate: $
                      {Number(t.rate_per_hour || t.rate || 0).toFixed(2)}/hr
                    </p>
                  </div>
                  <p className={`text-[14px] font-semibold ${statusStyles(status)}`}>
                    {statusLabel(status)}
                  </p>
                </div>

                {status === "submitted" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={reviewingId === Number(t.id)}
                      onClick={() => review(Number(t.id), "approve")}
                      className="inline-flex h-9 items-center gap-1.5 rounded bg-[#198754] px-4 text-[13px] font-semibold text-white hover:bg-[#157347] disabled:opacity-60"
                    >
                      <FiCheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === Number(t.id)}
                      onClick={() => review(Number(t.id), "reject")}
                      className="inline-flex h-9 items-center gap-1.5 rounded border border-[#d64545] bg-white px-4 text-[13px] font-semibold text-[#d64545] hover:bg-[#fdecea] disabled:opacity-60"
                    >
                      <FiAlertCircle size={14} />
                      Reject
                    </button>
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
