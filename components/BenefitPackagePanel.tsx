"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import PanelWithHeader from "@/components/PanelWithHeader";

type BenefitStatus = {
  record?: { status?: string; sent_at?: string; avg_weekly_hours?: number };
  evaluation?: {
    eligible?: boolean;
    skip_reason?: string | null;
    days_employed?: number;
    avg_weekly_hours?: number;
    employment_type?: string;
    hours_source?: string;
    weeks_evaluated?: { week_start_date: string; total_hours: number }[];
  };
};

const SKIP_REASON_LABELS: Record<string, string> = {
  already_sent: "Benefit package already sent",
  field2_mismatch: "Job seeker on placement does not match the Field_2 lookup",
  employment_type_not_eligible:
    "Employment type is not eligible (must be Temp to Hire or Contract)",
  no_benefit_rule_configured: "No benefit rule configured for this employment type",
  insufficient_tenure: "Insufficient tenure (minimum days employed not met)",
  insufficient_week_definitions:
    "Unable to evaluate hours — insufficient completed week definitions",
};

export function formatBenefitPackageSkipReason(reason: string): string {
  const trimmed = String(reason || "").trim();
  if (!trimmed) return "";

  if (SKIP_REASON_LABELS[trimmed]) return SKIP_REASON_LABELS[trimmed];

  const missingWeek = trimmed.match(/^missing_approved_timecard_for_week_(.+)$/);
  if (missingWeek) {
    return `Missing approved timecard for week starting ${missingWeek[1]}`;
  }

  const avgBelow = trimmed.match(/^avg_hours_below_(\d+(?:\.\d+)?)$/);
  if (avgBelow) {
    return `4-week average hours below ${avgBelow[1]}`;
  }

  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex border-b border-gray-200 last:border-b-0">
      <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">
        {label}:
      </div>
      <div className="flex-1 p-2">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusClass =
    status === "Sent"
      ? "bg-green-100 text-green-800"
      : status === "Eligible"
        ? "bg-blue-100 text-blue-800"
        : status === "Not eligible"
          ? "bg-amber-100 text-amber-800"
          : "bg-gray-100 text-gray-800";

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusClass}`}>
      {status}
    </span>
  );
}

export default function BenefitPackagePanel({ placementId }: { placementId: string | number }) {
  const [data, setData] = useState<BenefitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/benefit-package/placements/${placementId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load benefit status");
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load benefit status");
    } finally {
      setLoading(false);
    }
  }, [placementId]);

  useEffect(() => {
    load();
  }, [load]);

  const evaluate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/benefit-package/placements/${placementId}/evaluate`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Evaluate failed");
      setData((prev) => ({ ...prev, evaluation: json.evaluation }));
      toast.success(json.evaluation?.eligible ? "Eligible for benefit package" : "Not eligible yet");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Evaluate failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/benefit-package/placements/${placementId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Send failed");
      toast.success("Benefit package sent");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const ev = data?.evaluation;
  const recordStatus = data?.record?.status;

  const badge =
    recordStatus === "sent"
      ? "Sent"
      : ev?.eligible
        ? "Eligible"
        : ev?.skip_reason
          ? "Not eligible"
          : "Unknown";

  const formattedReason =
    ev?.skip_reason && recordStatus !== "sent"
      ? formatBenefitPackageSkipReason(ev.skip_reason)
      : null;

  return (
    <PanelWithHeader title="Benefit Package">
      {loading ? (
        <div className="p-4 text-gray-500 text-sm">Loading...</div>
      ) : (
        <>
          <div className="space-y-0 border border-gray-200 rounded">
            <DetailRow label="Status">
              <StatusBadge status={badge} />
            </DetailRow>
            <DetailRow label="Employment type">{ev?.employment_type || "—"}</DetailRow>
            <DetailRow label="Days employed">{ev?.days_employed ?? "—"}</DetailRow>
            <DetailRow label="4-wk avg hours">{ev?.avg_weekly_hours ?? "—"}</DetailRow>
            <DetailRow label="Hours source">{ev?.hours_source || "—"}</DetailRow>
            {formattedReason && (
              <DetailRow label="Reason">
                <span className="text-amber-800">{formattedReason}</span>
              </DetailRow>
            )}
            {Array.isArray(ev?.weeks_evaluated) && ev.weeks_evaluated.length > 0 && (
              <DetailRow label="Weeks evaluated">
                <ul className="space-y-1 text-sm">
                  {ev.weeks_evaluated.map((w) => (
                    <li key={w.week_start_date}>
                      Week {w.week_start_date}: {w.total_hours} hrs
                    </li>
                  ))}
                </ul>
              </DetailRow>
            )}
          </div>
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={evaluate}
              className="text-sm border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              Evaluate
            </button>
            <button
              type="button"
              disabled={busy || recordStatus === "sent"}
              onClick={send}
              className="text-sm bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
            >
              Send package
            </button>
          </div>
        </>
      )}
    </PanelWithHeader>
  );
}
