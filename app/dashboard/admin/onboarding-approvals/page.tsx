"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FiRefreshCw, FiEye, FiX, FiCheck, FiAlertCircle, FiDownload } from "react-icons/fi";
import RecordNameResolver from "@/components/RecordNameResolver";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type SubmittedField = { field_name?: string; name?: string; value: string };
type NormalizedField = { field_name: string; value: string };

interface PendingApproval {
  item_id: number;
  status: string;
  sent_at: string;
  completed_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  job_seeker_id: number;
  job_id: number;
  first_name: string;
  last_name: string;
  jobseeker_email: string;
  job_title: string;
  document_name: string;
  template_document_id: number;
  file_url: string | null;
  submission: {
    submitted_fields: SubmittedField[];
    created_at: string;
  } | null;
  signature: {
    signature_value: string;
    timestamp: string;
    ip_address: string;
  } | null;
  uploaded_documents: Array<{
    id: number;
    document_name: string;
    file_url: string;
    created_at: string;
  }> | null;
  mapped_fields: Array<{
    field_name: string;
    field_label: string;
    field_type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    page?: number;
    page_number?: number;
  }> | null;
}

type TabKey =
  | "ALL"
  | "SUBMITTED"
  | "PENDING_ADMIN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "IN_PROGRESS"
  | "SENT";

const TAB_LABELS: Record<TabKey, string> = {
  ALL: "All",
  SUBMITTED: "Submitted",
  PENDING_ADMIN_REVIEW: "Pending Admin Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
  IN_PROGRESS: "In Progress",
  SENT: "Sent",
};

function normalizeSubmissionFields(input: unknown): NormalizedField[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((f) => {
      const raw = f as SubmittedField;
      return {
        field_name: String(raw?.field_name || raw?.name || "").trim(),
        value: String(raw?.value ?? ""),
      };
    })
    .filter((f) => f.field_name);
}

function normalizeApproval(raw: PendingApproval): PendingApproval {
  const submissionFields = normalizeSubmissionFields(raw.submission?.submitted_fields ?? []);
  return {
    ...raw,
    status: String(raw.status || "").toUpperCase(),
    submission: raw.submission
      ? { ...raw.submission, submitted_fields: submissionFields }
      : { submitted_fields: [], created_at: raw.sent_at } as any,
  };
}

function getProxyUrl(url: string): string {
  return `/api/documents/proxy?url=${encodeURIComponent(url)}`;
}

function MappedPdfPreview({
  approval,
  submittedMap,
}: {
  approval: PendingApproval;
  submittedMap: Record<string, string>;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});
  const [renderWidth, setRenderWidth] = useState(760);

  if (!approval.file_url) {
    return <div className="text-sm text-gray-500">No template PDF available for preview.</div>;
  }

  return (
    <div className="w-full border rounded bg-gray-100 p-3">
      <div className="mb-2 text-xs text-gray-600">Mapped PDF preview (read-only)</div>
      <div className="max-h-[60vh] overflow-auto">
        <Document
          file={getProxyUrl(approval.file_url)}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() => toast.error("Failed to load PDF preview")}
          loading={<div className="p-6 text-sm text-gray-500">Loading document preview...</div>}
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNumber = i + 1;
            const dim = pageDims[pageNumber];
            const scaleX = dim ? renderWidth / dim.w : 1;
            const scaleY = scaleX;
            const fields = (approval.mapped_fields || []).filter((f) => {
              const pn = Number((f.page_number ?? f.page ?? 1) || 1);
              return pn === pageNumber;
            });

            return (
              <div key={pageNumber} className="relative mb-4 bg-white shadow rounded overflow-hidden mx-auto" style={{ width: renderWidth }}>
                <Page
                  pageNumber={pageNumber}
                  width={renderWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={(page) => {
                    setPageDims((prev) => ({
                      ...prev,
                      [pageNumber]: { w: page.originalWidth, h: page.originalHeight },
                    }));
                  }}
                />
                {dim &&
                  fields.map((field, idx) => {
                    const fieldName = field.field_name;
                    const value = submittedMap[fieldName] ?? "";
                    return (
                      <div
                        key={`${pageNumber}-${fieldName}-${idx}`}
                        style={{
                          position: "absolute",
                          left: Number(field.x || 0) * scaleX,
                          top: Number(field.y || 0) * scaleY,
                          width: Math.max(60, Number(field.w || 120) * scaleX),
                          minHeight: Math.max(20, Number(field.h || 24) * scaleY),
                          zIndex: 10 + idx,
                        }}
                        className="border border-gray-400 bg-transparent text-[14px] font-medium text-black px-1 py-0.5 overflow-hidden whitespace-pre-wrap"
                        title={field.field_label || field.field_name}
                      >
                        {value || " "}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}

export default function OnboardingApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [approvingItemId, setApprovingItemId] = useState<number | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null);
  const [downloadingItemId, setDownloadingItemId] = useState<number | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/onboarding/approvals", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const normalized = Array.isArray(data.approvals)
          ? data.approvals.map((a: PendingApproval) => normalizeApproval(a))
          : [];
        setApprovals(normalized);
      } else {
        toast.error(data.message || "Failed to fetch approvals");
      }
    } catch {
      toast.error("Error fetching approvals");
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: TabKey[] = [
    "ALL",
    "SUBMITTED",
    "PENDING_ADMIN_REVIEW",
    "APPROVED",
    "REJECTED",
    "COMPLETED",
    "IN_PROGRESS",
    "SENT",
  ];

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      ALL: approvals.length,
      SUBMITTED: 0,
      PENDING_ADMIN_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      COMPLETED: 0,
      IN_PROGRESS: 0,
      SENT: 0,
    };
    approvals.forEach((a) => {
      const key = (a.status || "").toUpperCase() as TabKey;
      if (key in c) c[key] += 1;
    });
    return c;
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    if (activeTab === "ALL") return approvals;
    return approvals.filter((a) => a.status === activeTab);
  }, [approvals, activeTab]);

  const submittedMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (selectedApproval?.submission?.submitted_fields || []).forEach((f) => {
      const name = String((f as any).field_name || "");
      map[name] = String((f as any).value ?? "");
    });
    if (selectedApproval?.signature?.signature_value) {
      map.e_signature = selectedApproval.signature.signature_value;
    }
    return map;
  }, [selectedApproval]);

  const fieldLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (selectedApproval?.mapped_fields || []).forEach((f) => {
      map[f.field_name] = f.field_label || f.field_name;
    });
    return map;
  }, [selectedApproval]);

  const handleApprove = async (itemId: number) => {
    if (!confirm("Are you sure you want to approve this document?")) return;
    setApprovingItemId(itemId);
    try {
      const res = await fetch(`/api/onboarding/items/${itemId}/admin-approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success("Document approved successfully");
        await fetchApprovals();
        setIsViewDialogOpen(false);
      } else {
        toast.error(data.message || "Failed to approve document");
      }
    } catch {
      toast.error("Error approving document");
    } finally {
      setApprovingItemId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval || !rejectionNote.trim()) {
      toast.error("Rejection note is required");
      return;
    }
    setRejectingItemId(selectedApproval.item_id);
    try {
      const res = await fetch(`/api/onboarding/items/${selectedApproval.item_id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success("Document rejected");
        await fetchApprovals();
        setIsRejectDialogOpen(false);
        setIsViewDialogOpen(false);
        setRejectionNote("");
      } else {
        toast.error(data.message || "Failed to reject document");
      }
    } catch {
      toast.error("Error rejecting document");
    } finally {
      setRejectingItemId(null);
    }
  };

  const handleDownloadMappedPdf = async (approval: PendingApproval) => {
    if (!approval.file_url) {
      toast.error("No template file found for this approval.");
      return;
    }
    setDownloadingItemId(approval.item_id);
    try {
      const response = await fetch(getProxyUrl(approval.file_url), { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch source PDF");
      const bytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const submitted: Record<string, string> = {};
      normalizeSubmissionFields(approval.submission?.submitted_fields ?? []).forEach((f) => {
        submitted[f.field_name] = f.value;
      });
      if (approval.signature?.signature_value) {
        submitted.e_signature = approval.signature.signature_value;
      }

      for (const field of approval.mapped_fields || []) {
        const rawValue = submitted[field.field_name] ?? "";
        const value = String(rawValue || "").trim();
        if (!value) continue;

        const pageIndex = Math.max(0, Number((field.page_number ?? field.page ?? 1) || 1) - 1);
        const page = pdfDoc.getPage(pageIndex);
        if (!page) continue;

        const pageHeight = page.getHeight();
        const x = Number(field.x || 0);
        const yTop = Number(field.y || 0);
        const h = Math.max(8, Number(field.h || 18));
        const y = Math.max(2, pageHeight - yTop - h + 2);
        const fontSize = Math.max(8, Math.min(12, h - 2));

        page.drawText(value, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: Math.max(40, Number(field.w || 140)),
        });
      }

      const out = await pdfDoc.save();
      const pdfBytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      // Re-wrap bytes to ensure ArrayBuffer-backed view for BlobPart typing.
      const blobSafeBytes = new Uint8Array(pdfBytes);
      const blob = new Blob([blobSafeBytes], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${approval.document_name || "onboarding"}-mapped.pdf`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success("Mapped PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download mapped PDF");
    } finally {
      setDownloadingItemId(null);
    }
  };

  const openViewDialog = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setRejectionNote("");
    setIsViewDialogOpen(true);
  };

  const canTakeActionOnSelected = (selectedApproval?.status || "") === "SENT";

  return (
    <div className="bg-gray-200 min-h-screen p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Onboarding Approvals</h2>
          <p className="text-gray-600 mt-1">Review all onboarding records by status and approve/reject when needed.</p>
        </div>
        <button
          onClick={fetchApprovals}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition ${
              activeTab === tab
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {TAB_LABELS[tab]} ({counts[tab]})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-300">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-300">
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Job Seeker</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Document</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Job</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Submitted At</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Loading approvals...
                </td>
              </tr>
            ) : filteredApprovals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No records found for this tab.
                </td>
              </tr>
            ) : (
              filteredApprovals.map((approval) => (
                <tr key={approval.item_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 border border-gray-200 text-gray-700 font-semibold">
                      {approval.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-500 mb-1">ID: {approval.job_seeker_id}</div>
                    <div className="font-medium text-gray-900">
                      <RecordNameResolver id={approval.job_seeker_id} type="job-seekers" clickable />
                    </div>
                    <div className="text-xs text-gray-500">{approval.jobseeker_email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{approval.document_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="text-xs text-gray-500 mb-1">ID: {approval.job_id}</div>
                    <RecordNameResolver id={approval.job_id} type="jobs" clickable />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {approval.submission?.created_at
                      ? new Date(approval.submission.created_at).toLocaleString()
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openViewDialog(approval)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                    >
                      <FiEye /> Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isViewDialogOpen && selectedApproval && (
        <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Review Onboarding Document</h3>
              <button onClick={() => setIsViewDialogOpen(false)} className="text-gray-500 hover:text-gray-700">
                <FiX size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Status</label>
                  <div className="font-semibold text-gray-800">{selectedApproval.status}</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Job Seeker</label>
                  <div className="font-semibold text-gray-800">
                    <RecordNameResolver id={selectedApproval.job_seeker_id} type="job-seekers" clickable />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Job</label>
                  <div className="font-semibold text-gray-800">
                    <RecordNameResolver id={selectedApproval.job_id} type="jobs" clickable />
                  </div>
                </div>
              </div>

              <MappedPdfPreview approval={selectedApproval} submittedMap={submittedMap} />

              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                  <FiEye className="text-blue-600" /> Submitted Field Values
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {(selectedApproval.submission?.submitted_fields || []).map((f, i) => {
                    const fieldName = String((f as any).field_name || "");
                    const label = fieldLabelMap[fieldName] || fieldName.replace(/_/g, " ");
                    const value = String((f as any).value ?? "");
                    return (
                      <div key={`${fieldName}-${i}`} className="border-b border-gray-100 pb-2">
                        <label className="text-[10px] text-gray-400 block uppercase font-bold">
                          {label}
                        </label>
                        <div className="text-sm text-gray-700">
                          {value || <span className="text-gray-300 italic">Empty</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedApproval.signature && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <FiCheck className="text-emerald-600" /> Digital Signature
                  </h4>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div className="text-3xl font-serif italic mb-4 text-center py-6 text-gray-800 border-b border-gray-200">
                      {selectedApproval.signature.signature_value}
                    </div>
                    <div className="text-[10px] text-gray-400 flex justify-between font-mono">
                      <span>IP: {selectedApproval.signature.ip_address}</span>
                      <span>{new Date(selectedApproval.signature.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedApproval.uploaded_documents && selectedApproval.uploaded_documents.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <FiEye className="text-amber-600" /> Additional Uploaded Documents
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedApproval.uploaded_documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200 hover:bg-gray-100 transition">
                        <span className="text-sm font-medium text-gray-700">{doc.document_name}</span>
                        <button
                          onClick={() => window.open(doc.file_url, "_blank")}
                          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 transition"
                        >
                          View File
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              {canTakeActionOnSelected ? (
                <>
                  <button
                    onClick={() => handleDownloadMappedPdf(selectedApproval)}
                    disabled={downloadingItemId === selectedApproval.item_id}
                    className="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <FiDownload />
                    {downloadingItemId === selectedApproval.item_id ? "Preparing PDF..." : "Download Mapped PDF"}
                  </button>

                  <button
                    onClick={() => setIsRejectDialogOpen(true)}
                    disabled={rejectingItemId === selectedApproval.item_id}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 transition disabled:opacity-60"
                  >
                    {rejectingItemId === selectedApproval.item_id ? "Rejecting..." : "Reject Document"}
                  </button>
                  <button
                    onClick={() => handleApprove(selectedApproval.item_id)}
                    disabled={approvingItemId === selectedApproval.item_id}
                    className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {approvingItemId === selectedApproval.item_id ? "Approving..." : "Approve & Complete"}
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-500 font-medium">
                  Actions are only available while status is SENT.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRejectDialogOpen && (
        <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50 flex items-center gap-2">
              <FiAlertCircle className="text-red-600" />
              <h3 className="text-lg font-bold text-red-800">Reject Document Submission</h3>
            </div>
            <div className="p-6">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Rejection Reason</label>
              <p className="text-xs text-gray-400 mb-3">
                This note will be shown to the job seeker. Be specific about what needs correction.
              </p>
              <textarea
                placeholder="e.g. Please provide your full middle name and a clearer signature."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none resize-none transition"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setIsRejectDialogOpen(false)}
                disabled={!!rejectingItemId}
                className="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!rejectingItemId}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 transition disabled:opacity-60"
              >
                {rejectingItemId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
