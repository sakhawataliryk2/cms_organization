type NoteLike = {
  note_date_time?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

export const getNoteDateTimeValue = (note: NoteLike): string | null =>
  note?.note_date_time || note?.created_at || note?.createdAt || null;

export const getNoteDateTimeMs = (note: NoteLike): number => {
  const rawValue = getNoteDateTimeValue(note);
  if (!rawValue) return 0;
  const ms = new Date(rawValue).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

export const isNoteWithinDateRange = (
  note: NoteLike,
  startDate: string,
  endDate: string,
): boolean => {
  if (!startDate && !endDate) return true;

  const noteMs = getNoteDateTimeMs(note);
  if (!noteMs) return false;

  const fromDate = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
  const toDate = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

  if (fromDate !== null && noteMs < fromDate) return false;
  if (toDate !== null && noteMs > toDate) return false;
  return true;
};

export const formatNoteDateTime = (note: NoteLike): string => {
  const rawValue = getNoteDateTimeValue(note);
  if (!rawValue) return "N/A";

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "N/A";

  return parsed.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
