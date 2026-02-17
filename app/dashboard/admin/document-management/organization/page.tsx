"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiX } from "react-icons/fi";
import DocumentViewer from "@/components/DocumentViewer";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";

const WELCOME_DOC_TYPE_OPTIONS = [
  { value: "Welcome", label: "Welcome" },
  { value: "General", label: "General" },
  { value: "Other", label: "Other" },
];

const MAX_FILE_SIZE_MB = 25;

type OrgDefaultWelcome = {
  id: number;
  slot: string;
  template_document_id: number | null;
  document_name?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
};

export default function DocumentManagementOrganizationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [welcomeDefault, setWelcomeDefault] = useState<OrgDefaultWelcome | null>(null);
  const [loadingOrgDefaults, setLoadingOrgDefaults] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFileType, setUploadFileType] = useState("Welcome");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchWelcomeDefault = async () => {
    setLoadingOrgDefaults(true);
    try {
      const res = await fetch("/api/organization-default-documents/welcome", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data?.default) {
        setWelcomeDefault(data.default);
      } else {
        setWelcomeDefault(null);
      }
    } catch {
      setWelcomeDefault(null);
    } finally {
      setLoadingOrgDefaults(false);
    }
  };

  useEffect(() => {
    fetchWelcomeDefault();
  }, []);

  const pushWelcomeToAll = async () => {
    if (
      !confirm(
        "Push the current Welcome document to all existing organizations? This will update their Welcome document to match."
      )
    )
      return;
    setLoadingPush(true);
    try {
      const res = await fetch(
        "/api/organization-default-documents/welcome/push-to-all",
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Failed to push");
      toast.success(data.message || "Pushed to all organizations");
      fetchWelcomeDefault();
    } catch (e: any) {
      toast.error(e.message || "Failed to push");
    } finally {
      setLoadingPush(false);
    }
  };

  const validateFile = (file: File): boolean => {
    setUploadError(null);
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`File size should be less than ${MAX_FILE_SIZE_MB}MB.`);
      return false;
    }
    return true;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0 && validateFile(droppedFiles[0])) {
      const file = droppedFiles[0];
      setPendingFile(file);
      setUploadFileName(file.name.replace(/\.pdf$/i, "") || "Welcome Document");
      setUploadFileType("Welcome");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!validateFile(file)) return;
    setPendingFile(file);
    setUploadFileName(file.name.replace(/\.pdf$/i, "") || "Welcome Document");
    setUploadFileType("Welcome");
  };

  const handleConfirmUpload = async (details: { name: string; type: string }) => {
    if (!pendingFile) return;
    const name = details.name.trim() || pendingFile.name.replace(/\.pdf$/i, "") || "Welcome Document";
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingFile);
      fd.append("documentName", name);
      const res = await fetch(
        "/api/organization-default-documents/welcome/upload",
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Upload failed");
      toast.success("Welcome document uploaded. New organizations will receive this document.");
      setPendingFile(null);
      setUploadFileName("");
      setUploadFileType("Welcome");
      fetchWelcomeDefault();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const closeConfirmModal = () => {
    setPendingFile(null);
    setUploadFileName("");
    setUploadFileType("Welcome");
    setUploadError(null);
  };

  const hasWelcomeFile = welcomeDefault?.file_url || welcomeDefault?.file_path;
  const displayName =
    welcomeDefault?.document_name ||
    welcomeDefault?.file_name ||
    "Welcome Document";

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard/admin/document-management")}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4"
      >
        <FiArrowLeft className="w-5 h-5" />
        Back to Document Management
      </button>

      <div className="bg-white p-6 rounded shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Organization Welcome Document
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          This document is automatically added when a new organization is
          created. Upload a PDF here only for organizations; it is completely
          separate from OnBoarding documents. Use &quot;Push to All
          Organizations&quot; to update existing organizations with the current
          file.
        </p>

        {loadingOrgDefaults ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Welcome Document (Organization only)
              </span>
              {hasWelcomeFile && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={pushWelcomeToAll}
                    disabled={loadingPush}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingPush ? "Pushing..." : "Push to All Organizations"}
                  </button>
                  {welcomeDefault?.file_url && (
                    <button
                      type="button"
                      onClick={() => setShowPdfViewer(true)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      View PDF
                    </button>
                  )}
                </div>
              )}
            </div>

            {hasWelcomeFile ? (
              <div className="text-sm text-gray-700 mb-3">
                Current: <strong>{displayName}</strong>
                <span className="ml-2 text-gray-500">(PDF)</span>
              </div>
            ) : (
              <div className="text-sm text-gray-600 mb-3">
                No Welcome document uploaded. New organizations will receive a
                default text placeholder. Upload a PDF below.
              </div>
            )}

            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto h-10 w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mt-2 text-gray-600 text-sm">
                  Drag and drop a PDF here, or click to select
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF only (max {MAX_FILE_SIZE_MB}MB)
                </p>
              </div>
              {pendingFile && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center text-sm">
                  <span className="truncate flex-1">{pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingFile(null);
                    }}
                    className="text-gray-500 hover:text-red-500 ml-2 shrink-0"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}
              {uploadError && (
                <div className="mt-2 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm">
                  {uploadError}
                </div>
              )}
              {uploading && (
                <p className="mt-2 text-sm text-gray-500">Uploading...</p>
              )}
            </div>

            <ConfirmFileDetailsModal
              isOpen={!!pendingFile && !uploading}
              onClose={closeConfirmModal}
              onConfirm={handleConfirmUpload}
              fileName={uploadFileName}
              fileType={uploadFileType}
              onFileNameChange={setUploadFileName}
              onFileTypeChange={setUploadFileType}
              pendingFiles={pendingFile ? [pendingFile] : []}
              documentTypeOptions={WELCOME_DOC_TYPE_OPTIONS}
              confirmButtonText="Save & Upload"
              title="Confirm Welcome Document Name"
              alwaysShowSingleForm
            />
          </div>
        )}
      </div>

      {showPdfViewer && welcomeDefault?.file_url && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl flex flex-col w-full max-w-4xl max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 shrink-0">
              <span className="text-sm font-medium text-gray-800">
                {displayName}
              </span>
              <button
                type="button"
                onClick={() => setShowPdfViewer(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-[60vh]">
              <DocumentViewer
                filePath={welcomeDefault.file_url}
                mimeType={welcomeDefault.mime_type || "application/pdf"}
                documentName={displayName}
                className="min-h-[60vh]"
                onOpenInNewTab={() =>
                  window.open(welcomeDefault.file_url ?? "", "_blank")
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
