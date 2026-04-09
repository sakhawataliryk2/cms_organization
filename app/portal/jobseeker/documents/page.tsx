"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/portal/EmptyState";
import LoadingState from "@/components/portal/LoadingState";

function getOnboardingItemId(doc: Record<string, unknown>): number | null {
  const raw =
    doc.item_id ??
    doc.onboarding_item_id ??
    doc.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeStatus(status: unknown): string {
  return String(status || "").toUpperCase().trim();
}

/** Matches app `(jobseeker)/documents.tsx` StatusPill */
function DocStatusPill({
  status,
  rejectionNote,
}: {
  status: string;
  rejectionNote?: string | null;
}) {
  const key = normalizeStatus(status);
  const colorMap: Record<string, string> = {
    SENT: "#3b82f6",
    SUBMITTED: "#f59e0b",
    APPROVED: "#10b981",
    COMPLETED: "#10b981",
    REJECTED: "#ef4444",
    PENDING_JOBSEEKER: "#3b82f6",
    PENDING_ADMIN_REVIEW: "#f59e0b",
  };
  const labelMap: Record<string, string> = {
    SENT: "Sent",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    COMPLETED: "Completed",
    REJECTED: "Rejected",
    PENDING_JOBSEEKER: "Pending",
    PENDING_ADMIN_REVIEW: "Under review",
  };
  const bg = colorMap[key] || "#64748b";
  const label = labelMap[key] || status;

  return (
    <div>
      <span
        className="inline-block rounded-xl px-2 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: bg }}
      >
        {label}
      </span>
      {key === "REJECTED" && rejectionNote ? (
        <p className="mt-2 text-sm italic text-red-600">Note: {rejectionNote}</p>
      ) : null}
    </div>
  );
}

export default function JobSeekerDocumentsPage() {
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<"all" | "pending" | "done">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/portal/jobseeker/documents", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.success) {
      setError(String(data?.message || "Failed to load documents"));
      setDocuments([]);
    } else {
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    }
    setLoading(false);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const pendingDocuments = useMemo(
    () =>
      documents.filter((d) =>
        ["SENT", "PENDING_JOBSEEKER", "REJECTED"].includes(normalizeStatus(d.status))
      ),
    [documents]
  );

  const completedDocuments = useMemo(
    () =>
      documents.filter((d) =>
        ["SUBMITTED", "PENDING_ADMIN_REVIEW", "APPROVED", "COMPLETED"].includes(
          normalizeStatus(d.status)
        )
      ),
    [documents]
  );

  const visiblePending = docFilter === "done" ? [] : pendingDocuments;
  const visibleCompleted = docFilter === "pending" ? [] : completedDocuments;

  if (loading && !documents.length) {
    return <LoadingState text="Loading documents…" />;
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review, sign, and upload your onboarding paperwork.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setDocFilter(f)}
            className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              docFilter === f
                ? "border-blue-500 bg-blue-50 text-slate-900"
                : "border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f === "done" ? "Completed" : f}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {visiblePending.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-slate-800">Needs your signature</h2>
          <div className="space-y-3">
            {visiblePending.map((doc) => {
              const st = normalizeStatus(doc.status);
              const leftBorder = st === "REJECTED" ? "#F87171" : "#60A5FA";
              const itemId = getOnboardingItemId(doc);
              const rejectionNote =
                typeof doc.rejection_note === "string" ? doc.rejection_note : null;

              return (
                <div
                  key={String(doc.id)}
                  className="rounded-xl bg-white p-4"
                  style={{
                    borderWidth: 1.5,
                    borderLeftWidth: 5,
                    borderStyle: "solid",
                    borderColor: leftBorder,
                    borderLeftColor: leftBorder,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {String(doc.document_name || `Document #${doc.id}`)}
                    </p>
                    <DocStatusPill status={String(doc.status)} rejectionNote={rejectionNote} />
                  </div>
                  {doc.file_url ? (
                    <a
                      href={String(doc.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm font-medium text-blue-600 underline"
                    >
                      Open document
                    </a>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {itemId ? (
                      <Link
                        href={`/portal/jobseeker/fill-and-sign?itemId=${itemId}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Fill &amp; Sign
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mb-4 text-sm text-slate-500">
          You have no documents waiting for your signature right now.
        </p>
      )}

      {visibleCompleted.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-slate-800">Submitted / approved</h2>
          <div className="space-y-3">
            {visibleCompleted.map((doc) => (
              <div
                key={String(doc.id)}
                className="rounded-xl bg-white p-4"
                style={{
                  borderWidth: 1.5,
                  borderLeftWidth: 5,
                  borderStyle: "solid",
                  borderColor: "#34D399",
                  borderLeftColor: "#34D399",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {String(doc.document_name || `Document #${doc.id}`)}
                  </p>
                  <DocStatusPill status={String(doc.status)} />
                </div>
                {doc.file_url ? (
                  <a
                    href={String(doc.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-blue-600 underline"
                  >
                    Open document
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {documents.length === 0 && !loading ? <EmptyState text="No documents available." /> : null}
    </div>
  );
}
