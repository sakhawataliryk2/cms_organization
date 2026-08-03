/** Monday–Sunday week helpers for candidate timesheets */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type DayDetail = {
  time_in: string;
  time_out: string;
  lunch_hours: number;
  lunch_minutes: number;
  total_hours: number;
};

export function emptyDayDetail(): DayDetail {
  return { time_in: "", time_out: "", lunch_hours: 0, lunch_minutes: 0, total_hours: 0 };
}

export function emptyDayDetails(): Record<DayKey, DayDetail> {
  return {
    mon: emptyDayDetail(),
    tue: emptyDayDetail(),
    wed: emptyDayDetail(),
    thu: emptyDayDetail(),
    fri: emptyDayDetail(),
    sat: emptyDayDetail(),
    sun: emptyDayDetail(),
  };
}

/** Monday of the week containing `date` (local). */
export function getMondayOfWeek(date = new Date()): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYmd(d);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(weekStart + "T12:00:00");
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts).replace(",", "")} – ${end
    .toLocaleDateString("en-US", opts)
    .replace(",", "")}`;
}

/** e.g. Mon 07/27/26 */
export function formatDayLabel(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + dayIndex);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${weekday} ${mm}/${dd}/${yy}`;
}

function parseTimeToMinutes(value: string): number | null {
  const s = String(value || "").trim();
  if (!s) return null;
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }
  return null;
}

export function computeDayTotalHours(detail: DayDetail): number {
  const inMin = parseTimeToMinutes(detail.time_in);
  const outMin = parseTimeToMinutes(detail.time_out);
  if (inMin == null || outMin == null) return Number(detail.total_hours) || 0;
  let worked = outMin - inMin;
  if (worked < 0) worked += 24 * 60;
  const lunchMin =
    Math.max(0, Number(detail.lunch_hours) || 0) * 60 +
    Math.max(0, Number(detail.lunch_minutes) || 0);
  const net = Math.max(0, worked - lunchMin);
  return Math.round((net / 60) * 100) / 100;
}

export function formatHoursDisplay(hours: number): string {
  const h = Math.floor(Math.max(0, hours));
  const m = Math.round((Math.max(0, hours) - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function statusLabel(status: string | null | undefined): string {
  const s = String(status || "not_created").toLowerCase();
  if (s === "not_created") return "Not Created";
  if (s === "draft") return "Draft";
  if (s === "submitted") return "Submitted";
  if (s === "resubmitted") return "Resubmitted";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "late") return "Late";
  if (s === "missing") return "Missing";
  return status || "Not Created";
}
