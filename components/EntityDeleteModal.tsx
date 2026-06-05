"use client";

import { useState, useEffect } from "react";
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

interface EntityData {
  id: string;
  record_number?: number;
  name?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityId: string | null;
  entityData: EntityData | null;
  entityType: string;
}

export default function EntityDeleteModal({ open, onClose, onSuccess, entityId, entityData, entityType }: Props) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  const apiBase = `/api/${entityType}`;
  const recordType = ENTITY_TYPE_MAP[entityType] || entityType;
  const fmtType = RECORD_TYPE_MAP[entityType] || "organization";

  useEffect(() => {
    if (open && entityId) {
      checkPendingRequest();
    } else {
      setPendingRequest(null);
      setReason("");
    }
  }, [open, entityId]);

  const getAuthToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  const getCurrentUser = () => {
    try {
      const raw = document.cookie.replace(/(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/, "$1");
      return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch { return null; }
  };

  const checkPendingRequest = async () => {
    if (!entityId) return;
    try {
      const res = await fetch(`${apiBase}/${entityId}/delete-request`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequest(data.deleteRequest || null);
      } else {
        setPendingRequest(null);
      }
    } catch {
      setPendingRequest(null);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (!entityId) return;

    setIsSubmitting(true);
    try {
      const currentUser = getCurrentUser();

      await fetch(`${apiBase}/${entityId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          text: `Delete requested by ${currentUser?.name || "Unknown User"} – Pending payroll approval`,
          action: "Delete Request",
          about: entityData
            ? `${formatRecordId(entityData.record_number ?? entityData.id, fmtType)} ${entityData.name || ""}`
            : "",
        }),
      });

      const res = await fetch(`${apiBase}/${entityId}/delete-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          reason: reason.trim(),
          record_type: recordType,
          record_number: entityData ? formatRecordId(entityData.record_number ?? entityData.id, fmtType) : "",
          requested_by: currentUser?.id || currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
          action_type: "standard",
          dependencies_summary: {},
          user_consent: false,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Failed to create delete request" }));
        throw new Error(errData.message || "Failed to create delete request");
      }

      toast.success("Delete request submitted successfully. Payroll will be notified via email.");
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit delete request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const recordLabel = entityType === "hiring-managers" ? "Hiring Manager"
    : entityType === "job-seekers" ? "Job Seeker"
    : entityType === "placements" ? "Placement"
    : entityType === "organizations" ? "Organization"
    : entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
      <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Request Deletion</h2>
          <button
            onClick={() => { onClose(); setReason(""); }}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl font-bold">&times;</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          {entityData && (
            <div className="bg-gray-50 p-4 rounded">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {recordLabel} to Delete
              </label>
              <p className="text-sm text-gray-900 font-medium">
                {formatRecordId(entityData.record_number ?? entityData.id, fmtType)} {entityData.name || ""}
              </p>
            </div>
          )}

          {pendingRequest && pendingRequest.status === "pending" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm text-yellow-800">
                <strong>Pending Request:</strong> A delete request is already pending payroll approval.
              </p>
            </div>
          )}

          {pendingRequest && pendingRequest.status === "denied" && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-red-800">
                <strong>Previous Request Denied:</strong> {pendingRequest.denial_reason || "No reason provided"}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-red-500 mr-1">&bull;</span>
              Reason for Deletion
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Please provide a detailed reason for deleting this ${recordLabel.toLowerCase()}...`}
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
              <strong>Note:</strong> This will create a delete request. Payroll will be notified via email and must approve or deny it.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
          <button
            onClick={() => { onClose(); setReason(""); }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50"
            disabled={isSubmitting}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            disabled={isSubmitting || !reason.trim() || (pendingRequest?.status === "pending")}
          >
            {isSubmitting ? "SUBMITTING..." : "SUBMIT DELETE REQUEST"}
            {!isSubmitting && (
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
