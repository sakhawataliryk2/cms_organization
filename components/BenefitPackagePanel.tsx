"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
      const res = await fetch(`/api/benefit-package/placements/${placementId}/evaluate`, { method: "POST" });
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

  const badge = recordStatus === "sent"
    ? "Sent"
    : ev?.eligible
      ? "Eligible"
      : ev?.skip_reason
        ? "Not eligible"
        : "Unknown";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Benefit Package</h3>
        <span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 text-slate-700">{badge}</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>Employment type: <strong>{ev?.employment_type || "—"}</strong></div>
            <div>Days employed: <strong>{ev?.days_employed ?? "—"}</strong></div>
            <div>4-wk avg hours: <strong>{ev?.avg_weekly_hours ?? "—"}</strong></div>
            <div>Hours source: <strong>{ev?.hours_source || "—"}</strong></div>
          </div>
          {ev?.skip_reason && recordStatus !== "sent" && (
            <p className="text-xs text-amber-700">Reason: {ev.skip_reason}</p>
          )}
          {Array.isArray(ev?.weeks_evaluated) && ev.weeks_evaluated.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {ev.weeks_evaluated.map((w) => (
                <li key={w.week_start_date}>
                  Week {w.week_start_date}: {w.total_hours} hrs
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={evaluate}
              className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Evaluate
            </button>
            <button
              type="button"
              disabled={busy || recordStatus === "sent"}
              onClick={send}
              className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
            >
              Send package
            </button>
          </div>
        </>
      )}
    </div>
  );
}
