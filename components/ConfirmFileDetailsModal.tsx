"use client";

import { useEffect, useCallback } from "react";

const DEFAULT_DOCUMENT_TYPES = [
  { value: "General", label: "General" },
  { value: "Contract", label: "Contract" },
  { value: "Invoice", label: "Invoice" },
  { value: "Report", label: "Report" },
  { value: "ID", label: "ID" },
  { value: "Agreement", label: "Agreement" },
  { value: "Policy", label: "Policy" },
  { value: "Resume", label: "Resume" },
  { value: "Welcome", label: "Welcome" },
  { value: "Other", label: "Other" },
];

export interface ConfirmFileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (details: { name: string; type: string }) => void;
  fileName: string;
  fileType: string;
  onFileNameChange: (value: string) => void;
  onFileTypeChange: (value: string) => void;
  pendingFiles: File[];
  /** Custom document type options. Defaults to a comprehensive set. */
  documentTypeOptions?: { value: string; label: string }[];
  /** Confirm button label. Default: "Save & Upload" */
  confirmButtonText?: string;
  /** Modal title. Default: "Confirm File Details" */
  title?: string;
  /** Z-index for overlay. Default: 50 */
  zIndex?: number;
  /**
   * When true, always show the single-file form (name + type inputs) for the first file,
   * even when multiple files are pending (queue mode). Default: false.
   */
  alwaysShowSingleForm?: boolean;
}

export default function ConfirmFileDetailsModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  fileType,
  onFileNameChange,
  onFileTypeChange,
  pendingFiles,
  documentTypeOptions = DEFAULT_DOCUMENT_TYPES,
  confirmButtonText = "Save & Upload",
  title = "Confirm File Details",
  zIndex = 50,
  alwaysShowSingleForm = false,
}: ConfirmFileDetailsModalProps) {
  const isSingleFile = alwaysShowSingleForm || pendingFiles.length === 1;
  const isConfirmDisabled = isSingleFile && !fileName.trim();

  const handleConfirm = useCallback(() => {
    if (isSingleFile) {
      onConfirm({ name: fileName.trim(), type: fileType });
    } else {
      onConfirm({ name: "", type: "General" });
    }
  }, [isSingleFile, fileName, fileType, onConfirm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target.tagName === "SELECT" && (target as HTMLSelectElement).multiple) return;
        e.preventDefault();
        if (!isConfirmDisabled) handleConfirm();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handler);
    }
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, isConfirmDisabled, handleConfirm]);

  if (!isOpen || pendingFiles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex }}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-file-details-title"
      >
        <h3 id="confirm-file-details-title" className="text-lg font-semibold mb-4">
          {title}
        </h3>
        <div className="space-y-4">
          {isSingleFile ? (
            <>
              <div>
                <label htmlFor="file-details-name" className="block text-sm font-medium mb-1">
                  File Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="file-details-name"
                  type="text"
                  value={fileName}
                  autoFocus
                  onChange={(e) => onFileNameChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter file name"
                />
              </div>
              <div>
                <label htmlFor="file-details-type" className="block text-sm font-medium mb-1">
                  Document Type
                </label>
                <select
                  id="file-details-type"
                  value={fileType}
                  onChange={(e) => onFileTypeChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {documentTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-sm text-gray-700 font-medium mb-2">
                You selected {pendingFiles.length} files
              </p>
              <ul className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                {pendingFiles.map((file) => (
                  <li key={file.name} className="truncate">
                    {file.name}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Each file will use its filename as the document name and &quot;General&quot; as the
                type.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
