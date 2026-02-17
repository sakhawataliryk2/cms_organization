'use client';

import React from 'react';

export type RequestActionModalType = 'deletion' | 'unarchive';

export interface RequestActionModalProps {
  open: boolean;
  onClose: () => void;
  modelType: RequestActionModalType;
  /** e.g. "Organization" */
  entityLabel: string;
  /** e.g. "078 Velit dignissimos in." */
  recordDisplay: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Optional: validation - e.g. cascade consent for deletion */
  submitDisabled?: boolean;
  /** Optional: extra content below reason (e.g. pending request warning, cascade consent) */
  children?: React.ReactNode;
}

const COPY: Record<RequestActionModalType, {
  title: string;
  itemLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  note: string;
  submitLabel: string;
  submitLabelSubmitting: string;
}> = {
  deletion: {
    title: 'Request Deletion',
    itemLabel: 'to Delete',
    reasonLabel: 'Reason for Deletion',
    reasonPlaceholder: 'Please provide a detailed reason for deleting this record...',
    note: 'This will create a delete request. Payroll will be notified via email and must approve or deny the deletion. The record will be archived (not deleted) until payroll approval.',
    submitLabel: 'SUBMIT DELETE REQUEST',
    submitLabelSubmitting: 'SUBMITTING...',
  },
  unarchive: {
    title: 'Request Unarchive',
    itemLabel: 'to Unarchive',
    reasonLabel: 'Reason for Unarchive',
    reasonPlaceholder: 'Please provide a reason for unarchiving this record...',
    note: 'This will send your request and reason to Payroll (or Onboarding for Job Seekers). They will be notified via email.',
    submitLabel: 'SUBMIT UNARCHIVE REQUEST',
    submitLabelSubmitting: 'SUBMITTING...',
  },
};

export default function RequestActionModal({
  open,
  onClose,
  modelType,
  entityLabel,
  recordDisplay,
  reason,
  onReasonChange,
  onSubmit,
  isSubmitting,
  submitDisabled = false,
  children,
}: RequestActionModalProps) {
  if (!open) return null;

  const c = COPY[modelType];
  const itemLabel = `${entityLabel} ${c.itemLabel}`;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{c.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <span className="text-2xl font-bold">×</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          <div className="bg-gray-50 p-4 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {itemLabel}
            </label>
            <p className="text-sm text-gray-900 font-medium">
              {recordDisplay || 'N/A'}
            </p>
          </div>

          {children}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-red-500 mr-1">*</span>
              {c.reasonLabel}
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={c.reasonPlaceholder}
              className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                !reason.trim()
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
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
              <strong>Note:</strong> {c.note}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            disabled={
              isSubmitting ||
              !reason.trim() ||
              submitDisabled
            }
          >
            {isSubmitting ? c.submitLabelSubmitting : c.submitLabel}
            {!isSubmitting && modelType === 'deletion' && (
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
