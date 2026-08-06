"use client";

import { useState } from "react";
import { toast } from "sonner";

const ENTITY_TYPE_MAP: Record<string, string> = {
  "hiring-managers": "hiring_manager",
  leads: "lead",
  "job-seekers": "job_seeker",
  jobs: "job",
  tasks: "task",
  placements: "placement",
  organizations: "organization",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityIds: string[];
  entityType: string;
  selectedCount: number;
}

export default function EntityBulkDeleteModal({ open, onClose, onSuccess, entityIds, entityType, selectedCount }: Props) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const apiBase = `/api/${entityType}`;
  const entityTypeDb = ENTITY_TYPE_MAP[entityType] || entityType;

  const getAuthToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (entityIds.length === 0) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(`${apiBase}/bulk-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          entity_type: entityTypeDb,
          record_ids: entityIds,
          reason: reason.trim(),
        }),
      });

      const text = await res.text();
      let data: { message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok) {
        toast.success(`Bulk delete request submitted for ${entityIds.length} record(s). Payroll has been notified.`);
        setResult({ success: true, message: data.message || "Delete request submitted successfully" });
        setTimeout(() => {
          setResult(null);
          setReason("");
          onClose();
          onSuccess?.();
        }, 1500);
      } else {
        const errorMsg = data.message || `Failed to create delete request (${res.status})`;
        toast.error(errorMsg);
        setResult({ success: false, message: errorMsg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
      setResult({ success: false, message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setResult(null);
    setReason("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
      <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Request Deletion for {selectedCount} Record(s)</h2>
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
            <span className="text-2xl font-bold">&times;</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          {result ? (
            <div className={`rounded p-4 ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
                {result.message}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Records
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {selectedCount} record(s) selected
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">&bull;</span>
                  Reason for Deletion (shared for all)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a detailed reason for deleting these records..."
                  className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${!reason.trim()
                    ? "border-red-300 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                  }`}
                  rows={5}
                  required
                />
                {!reason.trim() && (
                  <p className="mt-1 text-sm text-red-500">Reason is required</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> A single batch delete request will be submitted. Payroll will receive an email with a link to review and approve/deny each record individually.
                </p>
              </div>
            </>
          )}
        </div>

        {!result && (
          <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50"
              disabled={isSubmitting}
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? "SUBMITTING..." : "SUBMIT DELETE REQUEST"}
              {!isSubmitting && (
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
