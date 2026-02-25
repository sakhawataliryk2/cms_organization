"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiX } from "react-icons/fi";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import { formatRecordId } from "@/lib/recordIdFormatter";

const QUOTE_DOC_TYPE = { value: "Quote", label: "Quote" };
const MAX_FILE_SIZE_MB = 25;

type TabId = "organization" | "hiring-manager";
type UploadMode = "single" | "multiple";

type OrgRecord = { id: string | number; name?: string; [key: string]: unknown };
type HMRecord = { id: string | number; name?: string; organization_name?: string; custom_fields?: Record<string, unknown>; [key: string]: unknown };

export default function DocumentManagementQuotesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>("organization");
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  const [organizations, setOrganizations] = useState<OrgRecord[]>([]);
  const [hiringManagers, setHiringManagers] = useState<HMRecord[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingHMs, setLoadingHMs] = useState(false);

  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [selectedHMIds, setSelectedHMIds] = useState<Set<string>>(new Set());

  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedSingleOrgId, setSelectedSingleOrgId] = useState<string | null>(null);
  const [selectedSingleHMId, setSelectedSingleHMId] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      if (res.ok && data?.organizations) {
        setOrganizations(data.organizations);
      } else {
        setOrganizations([]);
      }
    } catch {
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const fetchHiringManagers = async () => {
    setLoadingHMs(true);
    try {
      const res = await fetch("/api/hiring-managers");
      const data = await res.json();
      if (res.ok && data?.hiringManagers) {
        setHiringManagers(data.hiringManagers);
      } else {
        setHiringManagers([]);
      }
    } catch {
      setHiringManagers([]);
    } finally {
      setLoadingHMs(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (activeTab === "hiring-manager") {
      fetchHiringManagers();
    }
  }, [activeTab]);

  const getOrgLabel = (o: OrgRecord): string => {
    const name =
      (o.name as string) ||
      (o as any).organization_name ||
      "";
    const prefix = formatRecordId(
      (o as any).record_number ?? o.id,
      "organization"
    );
    return name ? `${prefix} - ${name}` : prefix || `Record ${o.id}`;
  };

  const getHMLabel = (hm: HMRecord): string => {
    const baseName =
      (hm.name as string) ||
      `${(hm as any).first_name || ""} ${(hm as any).last_name || ""}`.trim() ||
      `${hm.custom_fields?.["First Name"] || ""} ${hm.custom_fields?.["Last Name"] || ""}`.trim() ||
      "";
    const prefix = formatRecordId(
      (hm as any).record_number ?? hm.id,
      "hiringManager"
    );
    return baseName ? `${prefix} - ${baseName}` : `${prefix} - Hiring Manager`;
  };

  const filteredOrgs = organizations.filter((o) => {
    const label = getOrgLabel(o).toLowerCase();
    const term = searchTerm.toLowerCase();
    return !term || label.includes(term);
  });

  const filteredHMs = hiringManagers.filter((hm) => {
    const label = getHMLabel(hm).toLowerCase();
    const term = searchTerm.toLowerCase();
    return !term || label.includes(term);
  });

  const toggleOrgSelection = (id: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleHMSelection = (id: string) => {
    setSelectedHMIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (uploadMode !== "multiple") return;
    if (activeTab === "organization") {
      setSelectAll(filteredOrgs.length > 0 && filteredOrgs.every((o) => selectedOrgIds.has(String(o.id))));
    } else {
      setSelectAll(filteredHMs.length > 0 && filteredHMs.every((hm) => selectedHMIds.has(String(hm.id))));
    }
  }, [uploadMode, activeTab, filteredOrgs, filteredHMs, selectedOrgIds, selectedHMIds]);

  const handleSelectAllOrgs = () => {
    if (selectAll) {
      setSelectedOrgIds(new Set());
    } else {
      setSelectedOrgIds(new Set(filteredOrgs.map((o) => String(o.id))));
    }
  };

  const handleSelectAllHMs = () => {
    if (selectAll) {
      setSelectedHMIds(new Set());
    } else {
      setSelectedHMIds(new Set(filteredHMs.map((hm) => String(hm.id))));
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
      setUploadFileName(file.name.replace(/\.pdf$/i, "") || "Quote Document");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!validateFile(file)) return;
    setPendingFile(file);
    setUploadFileName(file.name.replace(/\.pdf$/i, "") || "Quote Document");
  };

  const getTargetIds = (): string[] => {
    if (uploadMode === "single") {
      if (activeTab === "organization" && selectedSingleOrgId) return [selectedSingleOrgId];
      if (activeTab === "hiring-manager" && selectedSingleHMId) return [selectedSingleHMId];
      return [];
    }
    if (activeTab === "organization") return Array.from(selectedOrgIds);
    return Array.from(selectedHMIds);
  };

  const handleConfirmUpload = async (details: { name: string; type: string }) => {
    if (!pendingFile) return;
    const targetIds = getTargetIds();
    if (targetIds.length === 0) {
      toast.error(
        activeTab === "organization"
          ? "Please select at least one organization."
          : "Please select at least one hiring manager."
      );
      return;
    }
    const name = details.name.trim() || pendingFile.name.replace(/\.pdf$/i, "") || "Quote Document";
    setUploading(true);
    setUploadError(null);
    let successCount = 0;
    let failCount = 0;
    const baseUrl = activeTab === "organization" ? "/api/organizations" : "/api/hiring-managers";
    for (const id of targetIds) {
      try {
        const fd = new FormData();
        fd.append("file", pendingFile);
        fd.append("document_name", name);
        fd.append("document_type", "Quote");
        const res = await fetch(`${baseUrl}/${id}/documents/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data?.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setUploading(false);
    setPendingFile(null);
    setUploadFileName("");
    if (successCount > 0) {
      toast.success(`Quote uploaded to ${successCount} ${successCount === 1 ? "record" : "records"}.`);
      if (failCount > 0) toast.error(`Failed for ${failCount} records.`);
    } else {
      toast.error("Upload failed for all selected records.");
    }
  };

  const closeConfirmModal = () => {
    setPendingFile(null);
    setUploadFileName("");
    setUploadError(null);
  };

  const canUpload =
    pendingFile &&
    (uploadMode === "single"
      ? activeTab === "organization"
        ? !!selectedSingleOrgId
        : !!selectedSingleHMId
      : activeTab === "organization"
        ? selectedOrgIds.size > 0
        : selectedHMIds.size > 0);

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
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Quotes</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload quote documents for organizations or hiring managers. Choose a single record or multiple/all records. Quotes will appear in the Quotes tab on the respective view pages.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("organization")}
            className={`px-4 py-2 text-sm font-medium rounded-t ${
              activeTab === "organization" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setActiveTab("hiring-manager")}
            className={`px-4 py-2 text-sm font-medium rounded-t ${
              activeTab === "hiring-manager" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Hiring Manager
          </button>
        </div>

        {/* Upload mode */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === "single"}
              onChange={() => setUploadMode("single")}
              className="text-blue-600"
            />
            <span className="text-sm">Upload for single record</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === "multiple"}
              onChange={() => setUploadMode("multiple")}
              className="text-blue-600"
            />
            <span className="text-sm">Upload for multiple or all records</span>
          </label>
        </div>

        {/* Record selector */}
        <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {uploadMode === "single"
              ? `Select ${activeTab === "organization" ? "Organization" : "Hiring Manager"}`
              : `Select ${activeTab === "organization" ? "Organizations" : "Hiring Managers"} (or use Select All)`}
          </h3>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm mb-3"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded bg-white">
            {activeTab === "organization" && (
              <>
                {loadingOrgs ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading organizations...</div>
                ) : uploadMode === "multiple" && filteredOrgs.length > 0 ? (
                  <>
                    <div className="p-2 border-b bg-gray-50 sticky top-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAllOrgs}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium">Select All ({filteredOrgs.length})</span>
                      </label>
                    </div>
                    {filteredOrgs.map((org) => (
                      <label
                        key={org.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrgIds.has(String(org.id))}
                          onChange={() => toggleOrgSelection(String(org.id))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{getOrgLabel(org)}</span>
                      </label>
                    ))}
                  </>
                ) : uploadMode === "single" ? (
                  filteredOrgs.map((org) => (
                    <label
                      key={org.id}
                      className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                        selectedSingleOrgId === String(org.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="singleOrg"
                        checked={selectedSingleOrgId === String(org.id)}
                        onChange={() => setSelectedSingleOrgId(String(org.id))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{getOrgLabel(org)}</span>
                    </label>
                  ))
                ) : (
                  <div className="p-4 text-sm text-gray-500">No organizations found</div>
                )}
              </>
            )}
            {activeTab === "hiring-manager" && (
              <>
                {loadingHMs ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading hiring managers...</div>
                ) : uploadMode === "multiple" && filteredHMs.length > 0 ? (
                  <>
                    <div className="p-2 border-b bg-gray-50 sticky top-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAllHMs}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium">Select All ({filteredHMs.length})</span>
                      </label>
                    </div>
                    {filteredHMs.map((hm) => (
                      <label
                        key={hm.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedHMIds.has(String(hm.id))}
                          onChange={() => toggleHMSelection(String(hm.id))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{getHMLabel(hm)}</span>
                      </label>
                    ))}
                  </>
                ) : uploadMode === "single" ? (
                  filteredHMs.map((hm) => (
                    <label
                      key={hm.id}
                      className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                        selectedSingleHMId === String(hm.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="singleHM"
                        checked={selectedSingleHMId === String(hm.id)}
                        onChange={() => setSelectedSingleHMId(String(hm.id))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{getHMLabel(hm)}</span>
                    </label>
                  ))
                ) : (
                  <div className="p-4 text-sm text-gray-500">No hiring managers found</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Upload zone */}
        <div className="border border-gray-200 rounded-lg p-4">
          <span className="text-sm font-semibold text-gray-700 block mb-3">Upload Quote (PDF)</span>
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
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-gray-600 text-sm">Drag and drop a PDF here, or click to select</p>
            <p className="text-xs text-gray-500 mt-1">PDF only (max {MAX_FILE_SIZE_MB}MB)</p>
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
          {uploading && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
        </div>

        <ConfirmFileDetailsModal
          isOpen={!!pendingFile && !uploading}
          onClose={closeConfirmModal}
          onConfirm={handleConfirmUpload}
          fileName={uploadFileName}
          fileType="Quote"
          onFileNameChange={setUploadFileName}
          onFileTypeChange={() => {}}
          pendingFiles={pendingFile ? [pendingFile] : []}
          documentTypeOptions={[QUOTE_DOC_TYPE]}
          confirmButtonText="Upload Quote"
          title="Confirm Quote Document Name"
          alwaysShowSingleForm
        />
      </div>
    </div>
  );
}
