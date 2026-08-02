"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiMessageSquare } from "react-icons/fi";
import {
  DAY_KEYS,
  DayDetail,
  DayKey,
  computeDayTotalHours,
  emptyDayDetails,
  formatDayLabel,
  formatHoursDisplay,
  formatWeekRange,
} from "@/lib/timesheetWeek";

type Filter = "all" | "submitted" | "approved" | "rejected";

type TimesheetNote = {
  id: string;
  text: string;
  created_at: string | null;
};

type TimecardRow = {
  id: number;
  first_name?: string;
  last_name?: string;
  status?: string;
  week_start_date?: string;
  total_hours?: number;
  pay_rate?: number;
  rate_per_hour?: number;
  rate?: number;
  day_details?: Record<string, DayDetail>;
  notes?: TimesheetNote[] | string;
  mon?: number;
  tue?: number;
  wed?: number;
  thu?: number;
  fri?: number;
  sat?: number;
  sun?: number;
  rejection_reason?: string | null;
};

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

function splitDayLabel(weekStart: string, dayIndex: number) {
  const full = formatDayLabel(weekStart, dayIndex);
  const [weekday, ...rest] = full.split(" ");
  return { weekday, date: rest.join(" ") };
}

function formatTimeDisplay(value: string | undefined) {
  const s = String(value || "").trim();
  if (!s) return "—";
  return s;
}

function normalizeNotes(raw: unknown): TimesheetNote[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw
      .map((n) => {
        if (!n || typeof n !== "object") return null;
        const text = String((n as TimesheetNote).text ?? "").trim();
        if (!text) return null;
        return {
          id: String((n as TimesheetNote).id || Math.random()),
          text,
          created_at: (n as TimesheetNote).created_at
            ? new Date((n as TimesheetNote).created_at as string).toISOString()
            : null,
        } as TimesheetNote;
      })
      .filter(Boolean) as TimesheetNote[];
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith("[")) {
      try {
        return normalizeNotes(JSON.parse(s));
      } catch {
        /* legacy */
      }
    }
    return [{ id: "legacy", text: s, created_at: null }];
  }
  return [];
}

function resolveDayDetails(t: TimecardRow): Record<DayKey, DayDetail> {
  const base = emptyDayDetails();
  const fromApi = t.day_details && typeof t.day_details === "object" ? t.day_details : {};
  for (const key of DAY_KEYS) {
    const d = fromApi[key] || {};
    const detail: DayDetail = {
      time_in: String(d.time_in || ""),
      time_out: String(d.time_out || ""),
      lunch_hours: Number(d.lunch_hours || 0),
      lunch_minutes: Number(d.lunch_minutes || 0),
      total_hours: Number(d.total_hours || 0),
    };
    if (!detail.total_hours) {
      const colHours = Number(t[key] || 0);
      if (colHours > 0) detail.total_hours = colHours;
      else detail.total_hours = computeDayTotalHours(detail);
    }
    base[key] = detail;
  }
  return base;
}

function formatLunch(detail: DayDetail) {
  const h = Number(detail.lunch_hours || 0);
  const m = Number(detail.lunch_minutes || 0);
  if (!h && !m) return "—";
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function HiringTimecardsPage() {
  const [rows, setRows] = useState<TimecardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
            const weekStart = String(t.week_start_date || "").slice(0, 10);
            const days = resolveDayDetails(t);
            const notes = normalizeNotes(t.notes);
            const isExpanded = expandedId === Number(t.id);

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
                      Week: {weekStart ? formatWeekRange(weekStart) : "—"}
                    </p>
                    <p className="text-[13px] text-[#5a6570]">
                      Hours: {Number(t.total_hours || 0).toFixed(2)} · Pay Rate: $
                      {Number(t.pay_rate || t.rate_per_hour || t.rate || 0).toFixed(2)}/hr
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className={`text-[14px] font-semibold ${statusStyles(status)}`}>
                      {statusLabel(status)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : Number(t.id))}
                      className="text-[13px] font-semibold text-[#1a6bb5] hover:underline"
                    >
                      {isExpanded ? "Hide details" : "View details"}
                    </button>
                  </div>
                </div>

                {isExpanded && weekStart && (
                  <div className="mt-4 overflow-x-auto rounded-md border border-[#e6ebf0]">
                    <table className="min-w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-[#e6ebf0] bg-[#f7f8fa] text-left">
                          <th className="px-3 py-2.5 font-semibold text-[#333]">Date</th>
                          <th className="px-3 py-2.5 font-semibold text-[#333]">Time In</th>
                          <th className="px-3 py-2.5 font-semibold text-[#333]">Time Out</th>
                          <th className="px-3 py-2.5 font-semibold text-[#333]">Lunch</th>
                          <th className="px-3 py-2.5 font-semibold text-[#333]">Total Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAY_KEYS.map((key, index) => {
                          const row = days[key];
                          const { weekday, date } = splitDayLabel(weekStart, index);
                          const hours = Number(row.total_hours || computeDayTotalHours(row) || 0);
                          return (
                            <tr key={key} className="border-b border-[#e6ebf0] last:border-b-0">
                              <td className="whitespace-nowrap px-3 py-2.5 text-[#1a1a1a]">
                                <div className="leading-tight">
                                  <div className="font-medium">{weekday}</div>
                                  <div className="text-[12px] text-[#5a6570]">{date}</div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-[#1a1a1a]">
                                {formatTimeDisplay(row.time_in)}
                              </td>
                              <td className="px-3 py-2.5 text-[#1a1a1a]">
                                {formatTimeDisplay(row.time_out)}
                              </td>
                              <td className="px-3 py-2.5 text-[#1a1a1a]">{formatLunch(row)}</td>
                              <td className="px-3 py-2.5 font-medium text-[#1a1a1a]">
                                {formatHoursDisplay(hours)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#f7f8fa]">
                          <td
                            colSpan={4}
                            className="px-3 py-2.5 text-right text-[13px] font-semibold text-[#5a6570]"
                          >
                            Week total
                          </td>
                          <td className="px-3 py-2.5 text-[14px] font-semibold text-[#1a1a1a]">
                            {Number(t.total_hours || 0).toFixed(2)} hrs
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {isExpanded && notes.length > 0 && (
                  <div className="mt-3 rounded-md border border-[#e6ebf0] px-4 py-3">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#333]">
                      <FiMessageSquare size={14} />
                      Notes
                    </p>
                    <ul className="space-y-2">
                      {notes.map((n) => (
                        <li key={n.id} className="text-[13px] text-[#1a1a1a]">
                          {n.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {status === "rejected" && t.rejection_reason && (
                  <p className="mt-3 text-[13px] text-[#d64545]">
                    Rejection reason: {t.rejection_reason}
                  </p>
                )}

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
