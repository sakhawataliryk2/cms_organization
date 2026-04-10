"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiRefreshCw, FiClock } from "react-icons/fi";

type Placement = { id: number; job_title?: string; organization_name?: string };
type Timecard = {
  id: number; status: string; week_start_date: string;
  total_hours: number; rate_per_hour?: number; placement_id?: number;
  job_title?: string; organization_name?: string;
};

function StatusPill({ value }: { value?: string }) {
  const key = String(value || "").toLowerCase();
  const cls: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[key] || "bg-slate-100 text-slate-700"}`}>
      {value || "N/A"}
    </span>
  );
}

function CreateTimecardModal({
  placements, onClose, onCreated,
}: { placements: Placement[]; onClose: () => void; onCreated: () => void }) {
  const [placementId, setPlacementId] = useState<string>("");
  const [weekStart, setWeekStart] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!placementId || !weekStart || !hours) { toast.error("All fields are required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/jobseeker/timecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement_id: Number(placementId),
          week_start_date: weekStart,
          total_hours: Number(hours),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) { toast.error(data?.message || "Failed to create timecard"); return; }
      toast.success("Timecard created!");
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">New Timecard</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignment</label>
            <select value={placementId} onChange={(e) => setPlacementId(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select assignment...</option>
              {placements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.job_title || `Placement #${p.id}`}{p.organization_name ? ` — ${p.organization_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Week Start Date</label>
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Hours</label>
            <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 40"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="border px-4 py-2 rounded text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">
            {saving ? "Saving..." : "Create Timecard"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobSeekerTimecardsPage() {
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const load = async () => {
    const [tcRes, plRes] = await Promise.all([
      fetch("/api/portal/jobseeker/timecards", { cache: "no-store" }).catch(() => null),
      fetch("/api/portal/jobseeker/timecards/placements", { cache: "no-store" }).catch(() => null),
    ]);
    const tcData = await tcRes?.json().catch(() => ({}));
    const plData = await plRes?.json().catch(() => ({}));
    setTimecards(Array.isArray(tcData?.timecards) ? tcData.timecards : []);
    setPlacements(Array.isArray(plData?.placements) ? plData.placements : []);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (id: number) => {
    setSubmitting(id);
    try {
      const res = await fetch(`/api/portal/jobseeker/timecards/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) { toast.error(data?.message || "Failed to submit"); return; }
      toast.success("Timecard submitted for review!");
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timecards</h1>
          <p className="mt-1 text-sm text-slate-600">Track and submit your weekly hours.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <FiRefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <FiPlus size={14} /> New Timecard
          </button>
        </div>
      </div>

      {!timecards.length ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          <FiClock size={32} className="mx-auto mb-2 text-slate-300" />
          No timecards found. Create your first timecard above.
        </div>
      ) : (
        <div className="space-y-3">
          {timecards.map((t) => {
            const isDraft = t.status.toLowerCase() === "draft";
            const isRejected = t.status.toLowerCase() === "rejected";
            return (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      Week of {String(t.week_start_date || "").slice(0, 10) || "N/A"}
                    </p>
                    {(t.job_title || t.organization_name) && (
                      <p className="text-sm text-slate-500 mt-0.5">
                        {[t.job_title, t.organization_name].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>
                  <StatusPill value={t.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                  <span>Hours: <strong>{Number(t.total_hours || 0).toFixed(2)}</strong></span>
                  {t.rate_per_hour != null && (
                    <span>Rate: <strong>${Number(t.rate_per_hour).toFixed(2)}/hr</strong></span>
                  )}
                  {t.rate_per_hour != null && (
                    <span>Total: <strong>${(Number(t.total_hours || 0) * Number(t.rate_per_hour)).toFixed(2)}</strong></span>
                  )}
                </div>
                {(isDraft || isRejected) && (
                  <div className="mt-3">
                    <button
                      onClick={() => handleSubmit(t.id)}
                      disabled={submitting === t.id}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {submitting === t.id ? "Submitting..." : "Submit for Review"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTimecardModal
          placements={placements}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
