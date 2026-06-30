"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

interface BulkItem {
  id: number;
  record_id: number;
  record_number: string | null;
  record_label: string | null;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

interface BulkBatch {
  id: string;
  action_type: string;
  entity_type: string;
  requested_by: number | null;
  reason: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  items: BulkItem[];
}

export default function BulkReviewPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams?.get("batchId");

  const [batch, setBatch] = useState<BulkBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const getAuthToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  useEffect(() => {
    if (!batchId) {
      setLoading(false);
      setError("No batch ID provided");
      return;
    }

    const fetchBatch = async () => {
      try {
        const res = await fetch(`/api/bulk-actions/${batchId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: "Failed to fetch" }));
          throw new Error(data.message || "Failed to fetch batch");
        }
        const data = await res.json();
        setBatch(data.batch);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [batchId]);

  const handleApprove = async (itemId: number) => {
    setActionInProgress(itemId);
    try {
      const res = await fetch(`/api/bulk-actions/${itemId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ review_notes: reviewNotes[itemId] || null }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Item approved and record archived for deletion");
        setBatch(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item =>
              item.id === itemId
                ? { ...item, status: "approved", reviewed_at: new Date().toISOString() }
                : item
            ),
            status: prev.items.every(i => i.id === itemId || i.status !== "pending")
              ? "completed"
              : prev.status,
          };
        });
      } else {
        toast.error(data.message || "Failed to approve");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeny = async (itemId: number) => {
    const notes = reviewNotes[itemId];
    if (!notes || !notes.trim()) {
      toast.error("Please provide a reason for denial");
      return;
    }
    setActionInProgress(itemId);
    try {
      const res = await fetch(`/api/bulk-actions/${itemId}/deny`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ review_notes: notes.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Item denied");
        setBatch(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item =>
              item.id === itemId
                ? { ...item, status: "denied", reviewed_at: new Date().toISOString() }
                : item
            ),
            status: prev.items.every(i => i.id === itemId || i.status !== "pending")
              ? "completed"
              : prev.status,
          };
        });
      } else {
        toast.error(data.message || "Failed to deny");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      denied: "bg-red-100 text-red-800",
    };
    return `px-2 py-1 rounded text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`;
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-gray-500">Batch not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const pendingItems = batch.items.filter(i => i.status === "pending");
  const processedItems = batch.items.filter(i => i.status !== "pending");
  const entityLabel = batch.entity_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Review Bulk {batch.action_type === "archive" ? "Archive" : "Delete"} Request</h1>
        <p className="text-gray-500 mt-1">
          {entityLabel} &middot; {batch.items.length} record(s) &middot; Submitted {new Date(batch.created_at).toLocaleDateString()}
        </p>
      </div>

      {batch.reason && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
          <p className="text-sm text-gray-700"><strong>Reason:</strong> {batch.reason}</p>
        </div>
      )}

      {batch.status === "completed" && pendingItems.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-sm text-green-800 font-medium">All items have been reviewed.</p>
        </div>
      )}

      {pendingItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Pending Review ({pendingItems.length})</h2>
          <div className="space-y-4">
            {pendingItems.map(item => (
              <div key={item.id} className="border border-gray-200 rounded p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">
                      {item.record_label || `${entityLabel} #${item.record_number || item.record_id}`}
                    </p>
                    <p className="text-sm text-gray-500">Record ID: {item.record_id}</p>
                  </div>
                  <span className={getStatusBadge(item.status)}>{item.status.toUpperCase()}</span>
                </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    {actionInProgress === item.id ? "Notes:" : "Review Notes (required for denial):"}
                  </label>
                  <textarea
                    value={reviewNotes[item.id] || ""}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Optional notes for approval, required for denial..."
                    disabled={actionInProgress === item.id}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={actionInProgress === item.id}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {actionInProgress === item.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDeny(item.id)}
                    disabled={actionInProgress === item.id || !(reviewNotes[item.id] || "").trim()}
                    className="px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {actionInProgress === item.id ? "Processing..." : "Deny"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processedItems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Processed ({processedItems.length})</h2>
          <div className="space-y-2">
            {processedItems.map(item => (
              <div key={item.id} className="border border-gray-200 rounded p-3 bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {item.record_label || `${entityLabel} #${item.record_number || item.record_id}`}
                  </p>
                  {item.review_notes && (
                    <p className="text-xs text-gray-500 mt-1">Notes: {item.review_notes}</p>
                  )}
                </div>
                <span className={getStatusBadge(item.status)}>{item.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
          &larr; Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
