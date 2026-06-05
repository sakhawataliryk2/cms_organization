"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatRecordId, type RecordType } from "@/lib/recordIdFormatter";

const RECORD_TYPE_MAP: Record<string, RecordType> = {
  "hiring-managers": "hiringManager",
  leads: "lead",
  "job-seekers": "jobSeeker",
  jobs: "job",
  tasks: "task",
  placements: "placement",
  organizations: "organization",
};

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
  const [results, setResults] = useState<{ success: number; failed: number; errors: { name: string; error: string }[] } | null>(null);

  const apiBase = `/api/${entityType}`;
  const recordType = ENTITY_TYPE_MAP[entityType] || entityType;
  const fmtType = RECORD_TYPE_MAP[entityType] || "organization";

  const getAuthToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  const getCurrentUser = () => {
    try {
      const raw = document.cookie.replace(/(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/, "$1");
      return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch { return null; }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (entityIds.length === 0) return;

    setIsSubmitting(true);
    setResults(null);

    const currentUser = getCurrentUser();
    const successes: string[] = [];
    const failures: { name: string; error: string }[] = [];

    for (const id of entityIds) {
      try {
        const res = await fetch(`${apiBase}/${id}/delete-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            reason: reason.trim(),
            record_type: recordType,
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
            action_type: "standard",
            dependencies_summary: {},
            user_consent: false,
          }),
        });

        if (res.ok) {
          successes.push(id);
        } else {
          const errData = await res.json().catch(() => ({ message: "Request failed" }));
          failures.push({ name: id, error: errData.message || "Request failed" });
        }
      } catch (err) {
        failures.push({ name: id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    setResults({ success: successes.length, failed: failures.length, errors: failures });

    if (failures.length === 0) {
      toast.success(`Delete requests submitted for all ${successes.length} record(s). Verification emails will be sent to payroll.`);
      setResults(null);
      setReason("");
      onClose();
      onSuccess?.();
    } else if (successes.length > 0) {
      toast.warning(`Delete requests submitted for ${successes.length} record(s). ${failures.length} failed.`);
    } else {
      toast.error("Failed to submit any delete requests.");
    }

    setIsSubmitting(false);
  };

  const handleDone = () => {
    setResults(null);
    setReason("");
    onClose();
    onSuccess?.();
  };

  const handleCancel = () => {
    setResults(null);
    setReason("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
      <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Request Deletion for {selectedCount} Record(s)</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl font-bold">&times;</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          {results ? (
            <div className="space-y-4">
              <div className={`rounded p-4 ${results.failed === 0 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
                <p className={`text-sm font-medium ${results.failed === 0 ? "text-green-800" : "text-yellow-800"}`}>
                  {results.success} delete request(s) submitted successfully.
                  {results.failed > 0 && ` ${results.failed} failed.`}
                </p>
              </div>
              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                  <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                    {results.errors.map((e, i) => (
                      <li key={i}>{e.name}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={handleDone}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                DONE
              </button>
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
                  <strong>Note:</strong> Delete requests will be created for each selected record. Payroll will receive individual verification emails for each record and must approve or deny them independently.
                </p>
              </div>
            </>
          )}
        </div>

        {!results && (
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
              {isSubmitting ? "SUBMITTING..." : "SUBMIT DELETE REQUESTS"}
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
