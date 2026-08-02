"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FiChevronDown, FiChevronUp, FiClock, FiMessageSquare, FiTrash2 } from "react-icons/fi";
import {
  DAY_KEYS,
  DayDetail,
  DayKey,
  computeDayTotalHours,
  emptyDayDetails,
  formatDayLabel,
  formatHoursDisplay,
} from "@/lib/timesheetWeek";
import {
  TIMESHEET_LEAVE_MESSAGE,
  allowTimesheetLeaveOnce,
  setTimesheetLeaveGuard,
} from "@/lib/timesheetLeaveGuard";

type TimesheetNote = {
  id: string;
  text: string;
  created_at: string | null;
};

type Timecard = {
  id: number;
  status: string;
  week_start_date: string;
  notes?: TimesheetNote[] | string;
  day_details?: Record<string, DayDetail>;
  total_hours?: number;
};

function newNoteId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
          id: String((n as TimesheetNote).id || newNoteId()),
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
        /* legacy free text */
      }
    }
    return [{ id: "legacy", text: s, created_at: null }];
  }
  return [];
}

function formatNoteDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Split "Mon 07/27/26" into weekday + date for stacked cell */
function splitDayLabel(weekStart: string, dayIndex: number) {
  const full = formatDayLabel(weekStart, dayIndex); // "Mon 07/27/26"
  const [weekday, ...rest] = full.split(" ");
  return { weekday, date: rest.join(" ") };
}

function EntryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams?.get("id") || 0);

  const [loading, setLoading] = useState(true);
  const [timecard, setTimecard] = useState<Timecard | null>(null);
  const [days, setDays] = useState<Record<DayKey, DayDetail>>(emptyDayDetails());
  const [notes, setNotes] = useState<TimesheetNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">(
    "idle"
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef(false);
  const pendingSave = useRef(false);
  const notesRef = useRef<TimesheetNote[]>([]);
  const draftNoteRef = useRef("");
  const saveStatusRef = useRef(saveStatus);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  const readOnly = timecard ? timecard.status !== "draft" : true;
  const isDirty = saveStatus === "pending" || saveStatus === "saving";
  const hasUnsavedDraftNote = draftNote.trim().length > 0;
  const shouldBlockLeave =
    !readOnly &&
    (isDirty || hasUnsavedDraftNote || saveStatus === "error");

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    draftNoteRef.current = draftNote;
  }, [draftNote]);

  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  // Register leave-guard for shell (logout) + shared confirm helper
  useEffect(() => {
    if (readOnly) {
      setTimesheetLeaveGuard(null);
      return;
    }
    setTimesheetLeaveGuard(() => {
      const status = saveStatusRef.current;
      return (
        pendingSave.current ||
        saveInFlight.current ||
        draftNoteRef.current.trim().length > 0 ||
        status === "pending" ||
        status === "saving" ||
        status === "error"
      );
    });
    return () => setTimesheetLeaveGuard(null);
  }, [readOnly]);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/jobseeker/timecards/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.timecard) {
        toast.error(data?.message || "Timesheet not found");
        router.push("/portal/jobseeker/timesheets");
        return;
      }
      const tc = data.timecard as Timecard;
      if (typeof tc.week_start_date === "string") {
        tc.week_start_date = tc.week_start_date.slice(0, 10);
      }
      setTimecard(tc);
      const next = emptyDayDetails();
      for (const key of DAY_KEYS) {
        const d = tc.day_details?.[key];
        if (d) {
          next[key] = {
            time_in: d.time_in || "",
            time_out: d.time_out || "",
            lunch_hours: Number(d.lunch_hours) || 0,
            lunch_minutes: Number(d.lunch_minutes) || 0,
            total_hours: Number(d.total_hours) || 0,
          };
          next[key].total_hours = computeDayTotalHours(next[key]);
        }
      }
      setDays(next);
      const loadedNotes = normalizeNotes(tc.notes);
      setNotes(loadedNotes);
      notesRef.current = loadedNotes;
      if (loadedNotes.length > 0) setShowNotes(true);
      setSaveStatus("idle");
    } catch {
      toast.error("Failed to load timesheet");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const isLeaveBlocked = useCallback(() => {
    if (readOnly) return false;
    const status = saveStatusRef.current;
    return (
      pendingSave.current ||
      saveInFlight.current ||
      draftNoteRef.current.trim().length > 0 ||
      status === "pending" ||
      status === "saving" ||
      status === "error"
    );
  }, [readOnly]);

  // Warn before browser close/refresh while hours/notes are unsaved or saving
  useEffect(() => {
    if (readOnly) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isLeaveBlocked()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [readOnly, isLeaveBlocked]);

  // Block in-app link navigation (tabs, profile, etc.) while unsaved
  useEffect(() => {
    if (readOnly) return;
    const onClick = (e: MouseEvent) => {
      if (!isLeaveBlocked()) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      // Same-page hash / current entry URL — allow
      try {
        const next = new URL(href, window.location.origin);
        if (
          next.pathname === window.location.pathname &&
          next.search === window.location.search
        ) {
          return;
        }
      } catch {
        /* continue with confirm */
      }
      const leave = window.confirm(TIMESHEET_LEAVE_MESSAGE);
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        allowTimesheetLeaveOnce();
        setTimesheetLeaveGuard(null);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [readOnly, isLeaveBlocked]);

  // Confirm on browser Back while unsaved
  useEffect(() => {
    if (readOnly) return;
    const onPopState = () => {
      if (!isLeaveBlocked()) return;
      const leave = window.confirm(TIMESHEET_LEAVE_MESSAGE);
      if (!leave) {
        history.pushState(null, "", window.location.href);
      } else {
        allowTimesheetLeaveOnce();
        setTimesheetLeaveGuard(null);
      }
    };
    history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [readOnly, isLeaveBlocked]);

  const persist = useCallback(
    async (
      nextDays: Record<DayKey, DayDetail>,
      nextNotes: TimesheetNote[]
    ): Promise<boolean> => {
      if (!id || readOnly) return false;
      const weekStart =
        typeof timecard?.week_start_date === "string"
          ? timecard.week_start_date.slice(0, 10)
          : "";
      if (!weekStart) {
        toast.error("Missing week start date");
        setSaveStatus("error");
        return false;
      }
      saveInFlight.current = true;
      pendingSave.current = false;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/portal/jobseeker/timecards/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            week_start_date: weekStart,
            day_details: nextDays,
            notes: nextNotes,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          toast.error(data?.message || "Autosave failed");
          setSaveStatus("error");
          return false;
        }
        if (data.timecard) {
          setTimecard(data.timecard);
          if (data.timecard.notes != null) {
            const synced = normalizeNotes(data.timecard.notes);
            setNotes(synced);
            notesRef.current = synced;
          }
        }
        setSaveStatus("saved");
        return true;
      } catch {
        toast.error("Autosave failed");
        setSaveStatus("error");
        return false;
      } finally {
        saveInFlight.current = false;
      }
    },
    [id, readOnly, timecard?.week_start_date]
  );

  const scheduleSave = useCallback(
    (nextDays: Record<DayKey, DayDetail>, nextNotes: TimesheetNote[]) => {
      if (readOnly) return;
      pendingSave.current = true;
      setSaveStatus("pending");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persist(nextDays, nextNotes);
      }, 750);
    },
    [persist, readOnly]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const updateDay = (key: DayKey, patch: Partial<DayDetail>) => {
    setDays((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          ...patch,
        },
      };
      next[key].total_hours = computeDayTotalHours(next[key]);
      scheduleSave(next, notesRef.current);
      return next;
    });
  };

  const openNotesSection = (withAddForm = false) => {
    setShowNotes(true);
    if (withAddForm && !readOnly) {
      setShowAddForm(true);
      setTimeout(() => noteInputRef.current?.focus(), 50);
    }
  };

  const toggleNotesSection = () => {
    setShowNotes((prev) => {
      if (prev) {
        setShowAddForm(false);
        return false;
      }
      return true;
    });
  };

  const addNote = () => {
    if (readOnly) return;
    const text = draftNote.trim();
    if (!text) {
      toast.error("Enter a note before adding");
      return;
    }
    const next = [
      {
        id: newNoteId(),
        text,
        created_at: new Date().toISOString(),
      },
      ...notesRef.current,
    ];
    setNotes(next);
    notesRef.current = next;
    setDraftNote("");
    setShowAddForm(false);
    setShowNotes(true);
    scheduleSave(days, next);
  };

  const removeNote = (noteId: string) => {
    if (readOnly) return;
    const next = notesRef.current.filter((n) => n.id !== noteId);
    setNotes(next);
    notesRef.current = next;
    scheduleSave(days, next);
  };

  const onSubmit = async () => {
    if (!id || readOnly) return;
    if (isDirty || saveTimer.current || pendingSave.current) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const ok = await persist(days, notesRef.current);
      if (!ok) {
        toast.error("Please wait until your timesheet finishes saving");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/jobseeker/timecards/${id}/submit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.message || "Submit failed");
        return;
      }
      toast.success("Timesheet submitted");
      allowTimesheetLeaveOnce();
      setTimesheetLeaveGuard(null);
      router.push("/portal/jobseeker/timesheets");
    } catch {
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const leaveToTimesheets = () => {
    if (shouldBlockLeave && !window.confirm(TIMESHEET_LEAVE_MESSAGE)) return;
    allowTimesheetLeaveOnce();
    setTimesheetLeaveGuard(null);
    router.push("/portal/jobseeker/timesheets");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
      </div>
    );
  }

  if (!timecard) {
    return (
      <div className="rounded-lg border border-[#d8dde3] bg-white p-8 text-center text-sm text-[#7a8490]">
        Timesheet not found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#d8dde3] bg-white">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Hours</h2>
        {!readOnly && saveStatus !== "idle" && (
          <p
            className={`text-sm ${
              saveStatus === "error"
                ? "text-red-600"
                : saveStatus === "saved"
                  ? "text-[#2e7d32]"
                  : "text-[#5a6570]"
            }`}
            aria-live="polite"
          >
            {saveStatus === "pending" && "Unsaved changes…"}
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "All changes saved"}
            {saveStatus === "error" && "Save failed — try editing again"}
          </p>
        )}
      </div>

      <div className="overflow-x-auto px-2 sm:px-4">
        <table className="min-w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#e6ebf0] text-left">
              <th className="px-3 py-3 font-semibold text-[#333]">Date</th>
              <th className="px-3 py-3 font-semibold text-[#333]">Time In</th>
              <th className="px-3 py-3 font-semibold text-[#333]">Time Out</th>
              <th className="px-3 py-3 font-semibold text-[#333]">Lunch (hours)</th>
              <th className="px-3 py-3 font-semibold text-[#333]">Lunch (min)</th>
              <th className="px-3 py-3 font-semibold text-[#333]">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {DAY_KEYS.map((key, index) => {
              const row = days[key];
              const { weekday, date } = splitDayLabel(timecard.week_start_date, index);
              return (
                <tr key={key} className="border-b border-[#e6ebf0] last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-3.5 text-[#1a1a1a]">
                    <div className="leading-tight">
                      <div className="font-medium">{weekday}</div>
                      <div className="text-[13px] text-[#5a6570]">{date}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="relative max-w-[140px]">
                      <input
                        type="time"
                        disabled={readOnly}
                        value={row.time_in}
                        onChange={(e) => updateDay(key, { time_in: e.target.value })}
                        className="h-10 w-full rounded border border-[#c5ccd4] bg-white px-3 pr-9 text-[#1a1a1a] outline-none focus:border-[#1a6bb5] disabled:bg-[#f7f8fa]"
                      />
                      <FiClock
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1a6bb5]"
                        size={16}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="relative max-w-[140px]">
                      <input
                        type="time"
                        disabled={readOnly}
                        value={row.time_out}
                        onChange={(e) => updateDay(key, { time_out: e.target.value })}
                        className="h-10 w-full rounded border border-[#c5ccd4] bg-white px-3 pr-9 text-[#1a1a1a] outline-none focus:border-[#1a6bb5] disabled:bg-[#f7f8fa]"
                      />
                      <FiClock
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1a6bb5]"
                        size={16}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      disabled={readOnly}
                      value={row.lunch_hours || ""}
                      placeholder=""
                      onChange={(e) =>
                        updateDay(key, {
                          lunch_hours: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                        })
                      }
                      className="h-10 w-[88px] rounded border border-[#c5ccd4] bg-white px-3 text-[#1a1a1a] outline-none focus:border-[#1a6bb5] disabled:bg-[#f7f8fa]"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      disabled={readOnly}
                      value={row.lunch_minutes || ""}
                      placeholder=""
                      onChange={(e) =>
                        updateDay(key, {
                          lunch_minutes: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                        })
                      }
                      className="h-10 w-[88px] rounded border border-[#c5ccd4] bg-white px-3 text-[#1a1a1a] outline-none focus:border-[#1a6bb5] disabled:bg-[#f7f8fa]"
                    />
                  </td>
                  <td className="px-3 py-3.5 font-medium text-[#1a1a1a]">
                    {formatHoursDisplay(row.total_hours)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toggleable Notes section — table + simple Add Note (text only) */}
      {showNotes && (
        <div className="border-t border-[#e6ebf0] px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[#1a1a1a]">
              Notes{notes.length > 0 ? ` (${notes.length})` : ""}
            </h3>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setTimeout(() => noteInputRef.current?.focus(), 50);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-[#1a6bb5] bg-white px-3 text-[13px] font-semibold text-[#1a6bb5] hover:bg-[#e8f1fb]"
                >
                  <FiMessageSquare size={14} />
                  Add Note
                </button>
              )}
              <button
                type="button"
                onClick={toggleNotesSection}
                className="inline-flex h-9 items-center gap-1 rounded border border-[#c5ccd4] bg-white px-3 text-[13px] font-medium text-[#5a6570] hover:bg-[#f7f8fa]"
                aria-expanded={showNotes}
              >
                Hide
                <FiChevronUp size={14} />
              </button>
            </div>
          </div>

          {!readOnly && showAddForm && (
            <div className="mb-4 rounded border border-[#d8dde3] bg-[#f7f9fc] p-3">
              <label className="mb-1.5 block text-[13px] font-medium text-[#333]">
                Note text
              </label>
              <textarea
                ref={noteInputRef}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={3}
                className="w-full rounded border border-[#c5ccd4] bg-white px-3 py-2 text-[14px] text-[#1a1a1a] outline-none focus:border-[#1a6bb5]"
                placeholder="Write a simple note for this timesheet…"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setDraftNote("");
                  }}
                  className="h-9 rounded border border-[#c5ccd4] px-3 text-[13px] font-medium text-[#5a6570] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addNote}
                  className="h-9 rounded bg-[#1a6bb5] px-4 text-[13px] font-semibold text-white hover:bg-[#155a9a]"
                >
                  Add Note
                </button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#7a8490]">
              No notes yet.{!readOnly ? " Use Add Note to create one." : ""}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-[#e6ebf0] text-left">
                    <th className="w-[180px] px-3 py-2.5 font-semibold text-[#333]">Date</th>
                    <th className="px-3 py-2.5 font-semibold text-[#333]">Note</th>
                    {!readOnly && (
                      <th className="w-[72px] px-3 py-2.5 font-semibold text-[#333]"> </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => (
                    <tr key={note.id} className="border-b border-[#e6ebf0] last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-3 align-top text-[13px] text-[#5a6570]">
                        {formatNoteDate(note.created_at)}
                      </td>
                      <td className="whitespace-pre-wrap px-3 py-3 align-top text-[#1a1a1a]">
                        {note.text}
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => removeNote(note.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-[#9aa3ad] hover:bg-[#fdecea] hover:text-[#c62828]"
                            title="Remove note"
                            aria-label="Remove note"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer — Notes toggle / Add Note left, Submit right */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf0] px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleNotesSection}
            className="inline-flex h-10 items-center gap-2 rounded border border-[#c5ccd4] bg-white px-4 text-[14px] font-semibold text-[#5a6570] hover:bg-[#f7f8fa]"
            aria-expanded={showNotes}
          >
            Notes{notes.length > 0 ? ` (${notes.length})` : ""}
            {showNotes ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => openNotesSection(true)}
              className="inline-flex h-10 items-center gap-2 rounded border border-[#1a6bb5] bg-white px-4 text-[14px] font-semibold text-[#1a6bb5] hover:bg-[#e8f1fb]"
            >
              <FiMessageSquare size={16} />
              Add Note
            </button>
          )}
        </div>

        {!readOnly ? (
          <button
            type="button"
            disabled={submitting || isDirty}
            onClick={onSubmit}
            className="h-11 min-w-[180px] rounded bg-[#198754] px-6 text-[15px] font-bold text-white hover:bg-[#157347] disabled:opacity-60"
          >
            {submitting ? "Submitting…" : isDirty ? "Saving…" : "Submit Timesheet"}
          </button>
        ) : (
          <button
            type="button"
            onClick={leaveToTimesheets}
            className="h-11 rounded border border-[#c5ccd4] px-5 text-[14px] font-medium text-[#5a6570] hover:bg-[#f7f8fa]"
          >
            Back to Timesheets
          </button>
        )}
      </div>
    </div>
  );
}

export default function TimesheetEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
        </div>
      }
    >
      <EntryInner />
    </Suspense>
  );
}
