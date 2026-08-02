"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "sonner";
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiFileText } from "react-icons/fi";
import { useCandidatePortal } from "@/components/portal/CandidatePortalContext";
import { formatWeekRange, getMondayOfWeek, statusLabel } from "@/lib/timesheetWeek";

type Timecard = {
  id: number;
  status: string;
  total_hours: number;
  week_start_date: string;
  week_end_date?: string;
};

function SummaryCard({
  weekLabel,
  status,
  totalHours,
  expenses,
}: {
  weekLabel: string;
  status: string;
  totalHours: number | null;
  expenses: number | null;
}) {
  return (
    <div className="rounded-lg border border-[#d8dde3] bg-white px-8 py-5">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9aa3ad]">
            Time Period
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-[#1a1a1a]">{weekLabel}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9aa3ad]">
            Timesheet Status
          </p>
          <p
            className={`mt-1.5 text-[15px] font-semibold ${
              status === "approved"
                ? "text-[#1f9d57]"
                : status === "rejected"
                  ? "text-[#d64545]"
                  : "text-[#1a1a1a]"
            }`}
          >
            {statusLabel(status)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9aa3ad]">
            Total Hours
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-[#1a1a1a]">
            {totalHours == null ? "—" : totalHours.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9aa3ad]">
            Total Expenses
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-[#1a1a1a]">
            {expenses == null ? "—" : expenses.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetsDashboardPage() {
  const router = useRouter();
  const { activePlacement, loadingPlacements, placements } = useCandidatePortal();
  const weekStart = getMondayOfWeek();
  const weekLabel = formatWeekRange(weekStart);

  const [loading, setLoading] = useState(true);
  const [timecard, setTimecard] = useState<Timecard | null>(null);
  const [confirmZero, setConfirmZero] = useState(false);
  const [successZero, setSuccessZero] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!activePlacement?.id) {
      setTimecard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/portal/jobseeker/timecards/current-week?placement_id=${activePlacement.id}&week_start_date=${weekStart}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      setTimecard(data?.timecard || null);
    } catch {
      setTimecard(null);
    } finally {
      setLoading(false);
    }
  }, [activePlacement?.id, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const status = timecard?.status || "not_created";
  const totalHours = status === "not_created" ? null : Number(timecard?.total_hours ?? 0);
  const expenses = status === "not_created" ? null : 0;

  const onYesWorked = async () => {
    if (!activePlacement?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/jobseeker/timecards/ensure-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement_id: activePlacement.id,
          week_start_date: weekStart,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.timecard?.id) {
        toast.error(data?.message || "Could not start timesheet");
        return;
      }
      router.push(`/portal/jobseeker/timesheets/entry?id=${data.timecard.id}`);
    } catch {
      toast.error("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirmZero = async () => {
    if (!activePlacement?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/jobseeker/timecards/zero-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement_id: activePlacement.id,
          week_start_date: weekStart,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.message || "Could not submit zero hours");
        return;
      }
      setTimecard(data.timecard);
      setConfirmZero(false);
      setSuccessZero(true);
    } catch {
      toast.error("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlacements || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
      </div>
    );
  }

  if (!placements.length) {
    return (
      <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
          <FiFileText size={30} />
        </div>
        <h2 className="text-[18px] font-semibold text-[#1a1a1a]">No timesheets available</h2>
        <p className="mt-2 text-[14px] text-[#7a8490]">
          Timesheets are only available for approved Contract placements.
        </p>
      </div>
    );
  }

  const isApprovedZero = status === "approved" && Number(timecard?.total_hours || 0) === 0;
  const isNotCreated = status === "not_created";
  const canContinueDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <div className="space-y-4">
      <SummaryCard
        weekLabel={weekLabel}
        status={status}
        totalHours={totalHours}
        expenses={expenses}
      />

      <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-14">
        {isNotCreated && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
              <FiCalendar size={30} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold leading-tight text-[#1a1a1a]">
              Did you work this week?
            </h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">Time period: {weekLabel}</p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmZero(true)}
                className="h-11 w-[108px] rounded-md border border-[#c5ccd4] bg-white text-[15px] font-semibold text-[#5a6570] hover:bg-[#f7f8fa] disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onYesWorked}
                className="h-11 w-[108px] rounded-md bg-[#1a6bb5] text-[15px] font-semibold text-white hover:bg-[#155a99] disabled:opacity-50"
              >
                Yes
              </button>
            </div>
          </div>
        )}

        {isApprovedZero && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7ef] text-[#1f9d57]">
              <FiCheckCircle size={32} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Zero hours were submitted.</h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">Time period: {weekLabel}</p>
          </div>
        )}

        {isApproved && !isApprovedZero && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7ef] text-[#1f9d57]">
              <FiCheckCircle size={32} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Timesheet approved</h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">
              {Number(timecard?.total_hours || 0).toFixed(2)} hours · {weekLabel}
            </p>
            {timecard?.id && (
              <button
                type="button"
                onClick={() => router.push(`/portal/jobseeker/timesheets/entry?id=${timecard.id}`)}
                className="mt-6 text-[14px] font-medium text-[#1a6bb5] hover:underline"
              >
                View timesheet
              </button>
            )}
          </div>
        )}

        {canContinueDraft && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
              <FiCalendar size={30} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Continue your draft</h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">Time period: {weekLabel}</p>
            <button
              type="button"
              onClick={() => router.push(`/portal/jobseeker/timesheets/entry?id=${timecard!.id}`)}
              className="mt-8 h-11 rounded-md bg-[#1a6bb5] px-10 text-[15px] font-semibold text-white hover:bg-[#155a99]"
            >
              Enter Hours
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff6e8] text-[#e0891a]">
              <FiAlertCircle size={30} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Timesheet submitted</h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">
              Pending review · {Number(timecard?.total_hours || 0).toFixed(2)} hours · {weekLabel}
            </p>
          </div>
        )}

        {isRejected && (
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fdecec] text-[#d64545]">
              <FiAlertCircle size={30} strokeWidth={1.75} />
            </div>
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Timesheet rejected</h2>
            <p className="mt-2 text-[14px] text-[#4a5560]">
              Contact your hiring manager if you need to resubmit for {weekLabel}.
            </p>
          </div>
        )}
      </div>

      {/* Confirm zero hours — matches mock: orange icon + question + No/Yes */}
      {confirmZero && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2a3340]/45 p-4">
          <div className="w-full max-w-[400px] rounded-xl bg-white px-8 py-8 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0e0] text-[#e8891a]">
              <FiAlertCircle size={28} strokeWidth={2} />
            </div>
            <p className="text-[17px] font-semibold leading-snug text-[#1a1a1a]">
              Are you sure you want to submit zero hours for the week?
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmZero(false)}
                className="h-11 w-[100px] rounded-md border border-[#c5ccd4] bg-white text-[15px] font-semibold text-[#5a6570]"
              >
                No
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirmZero}
                className="h-11 w-[100px] rounded-md bg-[#1a6bb5] text-[15px] font-semibold text-white hover:bg-[#155a99] disabled:opacity-50"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal — matches mock copy exactly */}
      {successZero && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2a3340]/45 p-4">
          <div className="w-full max-w-[400px] rounded-xl bg-white px-8 py-8 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f7ef] text-[#1f9d57]">
              <FiCheckCircle size={30} strokeWidth={2} />
            </div>
            <p className="text-[17px] font-semibold text-[#1a1a1a]">Zero hours were submitted.</p>
            <p className="mt-2 text-[14px] text-[#4a5560]">
              Status has been updated to{" "}
              <span className="font-semibold text-[#1f9d57]">Approved</span>.
            </p>
            <button
              type="button"
              onClick={() => setSuccessZero(false)}
              className="mt-7 h-11 w-[100px] rounded-md bg-[#1a6bb5] text-[15px] font-semibold text-white hover:bg-[#155a99]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
