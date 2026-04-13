"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import DocumentMgmtTabs from "@/components/document-management/DocumentMgmtTabs";
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

  const getRecordStatus = (record: unknown): string | undefined => {
    const r = record as any;
    const status =
      r?.status ??
      r?.custom_fields?.status ??
      r?.custom_fields?.Status ??
      r?.custom_fields?.["Status"];
    return typeof status === "string" ? status : undefined;
  };

  const isArchived = (record: unknown): boolean => {
    return getRecordStatus(record)?.toLowerCase() === "archived";
  };

  useEffect(() => {
    const allowedOrgIds = new Set(
      organizations.filter((o) => !isArchived(o)).map((o) => String(o.id))
    );
    setSelectedOrgIds((prev) => new Set(Array.from(prev).filter((id) => allowedOrgIds.has(id))));
    setSelectedSingleOrgId((prev) => (prev && allowedOrgIds.has(prev) ? prev : null));
  }, [organizations]);

  useEffect(() => {
    const allowedHMIds = new Set(
      hiringManagers.filter((hm) => !isArchived(hm)).map((hm) => String(hm.id))
    );
    setSelectedHMIds((prev) => new Set(Array.from(prev).filter((id) => allowedHMIds.has(id))));
    setSelectedSingleHMId((prev) => (prev && allowedHMIds.has(prev) ? prev : null));
  }, [hiringManagers]);

  const filteredOrgs = organizations.filter((o) => !isArchived(o)).filter((o) => {
    const label = getOrgLabel(o).toLowerCase();
    const term = searchTerm.toLowerCase();
    return !term || label.includes(term);
  });

  const filteredHMs = hiringManagers.filter((hm) => !isArchived(hm)).filter((hm) => {
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
    <div className="bg-gray-200 min-h-screen p-4">
      <button
        onClick={() => router.push("/dashboard/admin/document-management")}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4"
      >
        <FiArrowLeft className="w-5 h-5" />
        Back to Document Management
      </button>

      <DocumentMgmtTabs />

      <div className="bg-white p-4 rounded shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Quotes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload quote documents for organizations or hiring managers. Choose a single record or multiple/all records. Quotes will appear in the Quotes tab on the respective view pages.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setUploadMode("single")}
                className={`px-3 py-2 text-sm font-medium ${
                  uploadMode === "single"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("multiple")}
                className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                  uploadMode === "multiple"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Multiple / All
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 border-b border-gray-200 pb-0">
          <button
            onClick={() => setActiveTab("organization")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "organization"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 hover:text-gray-800 border-transparent"
            }`}
          >
            ORGANIZATIONS
          </button>
          <button
            onClick={() => setActiveTab("hiring-manager")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "hiring-manager"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 hover:text-gray-800 border-transparent"
            }`}
          >
            HIRING MANAGERS
          </button>
        </div>

        <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {uploadMode === "single"
                  ? `Select ${activeTab === "organization" ? "Organization" : "Hiring Manager"}`
                  : `Select ${activeTab === "organization" ? "Organizations" : "Hiring Managers"} (or use Select All)`}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {activeTab === "organization"
                  ? `${filteredOrgs.length} available`
                  : `${filteredHMs.length} available`}
              </div>
            </div>

            {uploadMode === "multiple" && (
              <div className="text-sm text-gray-700">
                Selected{" "}
                {activeTab === "organization"
                  ? selectedOrgIds.size
                  : selectedHMIds.size}
              </div>
            )}
          </div>

          <div className="relative w-full max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "organization" ? "organizations" : "hiring managers"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-3 max-h-56 overflow-y-auto border border-gray-200 rounded bg-white divide-y divide-gray-200">
            {activeTab === "organization" && (
              <>
                {loadingOrgs ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading organizations...</div>
                ) : uploadMode === "multiple" && filteredOrgs.length > 0 ? (
                  <>
                    <div className="p-2 bg-gray-50 sticky top-0 z-10">
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
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
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
                      className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer ${
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
                    <div className="p-2 bg-gray-50 sticky top-0 z-10">
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
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
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
                      className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer ${
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

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Upload Quote (PDF)</div>
              <div className="text-xs text-gray-600 mt-1">
                {uploadMode === "single"
                  ? "Select one record, then upload a PDF."
                  : "Select multiple records (or Select All), then upload a PDF."}
              </div>
            </div>
            <div className="text-xs text-gray-600">Max {MAX_FILE_SIZE_MB}MB</div>
          </div>

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
            <p className="mt-2 text-gray-700 text-sm">Drag and drop a PDF here, or click to select</p>
            {!canUpload && (
              <p className="text-xs text-gray-500 mt-1">
                {activeTab === "organization"
                  ? "Select an organization to enable upload."
                  : "Select a hiring manager to enable upload."}
              </p>
            )}
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
