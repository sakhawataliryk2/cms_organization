"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import SignatureCanvas from "react-signature-canvas";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import { FiUpload, FiEdit, FiEye, FiRefreshCw } from "react-icons/fi";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

/* ─── Types ─────────────────────────────────────────────── */
type MappedField = {
  id?: number;
  field_name: string;
  field_label: string;
  field_type: string;
  x: number; y: number; w: number; h: number;
  page_number?: number;
};

type Doc = {
  id: number;
  status: string;
  document_name: string;
  sent_at?: string;
  template_document_id: number;
  file_url: string;
  completed_at?: string | null;
  mapped_fields: MappedField[];
  jobseekerData?: Record<string, string>;
  rejection_note?: string | null;
  item_id?: number;
  onboarding_item_id?: number;
};

type PageDim = { w: number; h: number };
export type DocumentViewerHandle = { submit: () => void };

/* ─── Status pill ────────────────────────────────────────── */
function StatusPill({ status, rejectionNote }: { status: string; rejectionNote?: string | null }) {
  const key = status.toUpperCase().trim();
  const colorMap: Record<string, string> = {
    SENT: "bg-blue-100 text-blue-800",
    SUBMITTED: "bg-amber-100 text-amber-800",
    APPROVED: "bg-green-100 text-green-800",
    COMPLETED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    PENDING_JOBSEEKER: "bg-blue-100 text-blue-800",
    PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-800",
  };
  const labelMap: Record<string, string> = {
    SENT: "Sent", SUBMITTED: "Submitted", APPROVED: "Approved",
    COMPLETED: "Completed", REJECTED: "Rejected",
    PENDING_JOBSEEKER: "Pending", PENDING_ADMIN_REVIEW: "Under Review",
  };
  return (
    <div>
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorMap[key] || "bg-slate-100 text-slate-700"}`}>
        {labelMap[key] || status}
      </span>
      {key === "REJECTED" && rejectionNote && (
        <p className="mt-1 text-xs italic text-red-600">Note: {rejectionNote}</p>
      )}
    </div>
  );
}

/* ─── Document Card ──────────────────────────────────────── */
function DocumentCard({
  doc, isSelected, onView, onAttach, onCreateAndSubmit,
}: {
  doc: Doc; isSelected: boolean;
  onView: () => void; onAttach: () => void; onCreateAndSubmit: () => void;
}) {
  const isPending = ["SENT", "PENDING_JOBSEEKER", "REJECTED"].includes(doc.status.toUpperCase());
  return (
    <div className={`bg-white rounded-lg border shadow-sm transition-all ${isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <StatusPill status={doc.status} rejectionNote={doc.rejection_note} />
          <button onClick={onView} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
            <FiEye size={12} /> VIEW
          </button>
        </div>
        <p className="mt-2 font-semibold text-gray-800 text-sm">{doc.document_name}</p>
        {doc.sent_at && (
          <p className="mt-1 text-xs text-gray-400">Sent: {new Date(doc.sent_at).toLocaleDateString()}</p>
        )}
        {doc.completed_at && (
          <p className="text-xs text-gray-400">Completed: {new Date(doc.completed_at).toLocaleDateString()}</p>
        )}
      </div>
      {isPending && (
        <div className="border-t border-gray-100 grid grid-cols-2">
          <button onClick={onAttach} className="py-2.5 text-xs font-semibold text-blue-600 hover:bg-gray-50 border-r border-gray-100 flex items-center justify-center gap-1">
            <FiUpload size={12} /> ATTACH
          </button>
          <button onClick={onCreateAndSubmit} className="py-2.5 text-xs font-semibold text-blue-600 hover:bg-gray-50 flex items-center justify-center gap-1">
            <FiEdit size={12} /> CREATE & SUBMIT
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── PDF Document Viewer with signing ──────────────────── */
const DocumentViewer = forwardRef<DocumentViewerHandle, {
  doc: Doc; jobseekerData: Record<string, string>;
  jobSeekerId?: number; onClose: () => void; onSubmitted: () => void;
}>(function DocumentViewer({ doc, jobseekerData, jobSeekerId, onClose, onSubmitted }, ref) {
  const [numPages, setNumPages] = useState(1);
  const [pageDims, setPageDims] = useState<Record<number, PageDim>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>(jobseekerData || {});
  const wrapRef = useRef<HTMLDivElement>(null);
  const [renderWidth, setRenderWidth] = useState(780);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigField, setSigField] = useState("");
  const sigRef = useRef<SignatureCanvas>(null);
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSig, setTypedSig] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormValues(jobseekerData || {});
  }, [doc.id, jobseekerData]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      setRenderWidth(Math.max(320, Math.min(900, wrapRef.current!.clientWidth)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const fieldsByPage = useMemo(() => {
    const map: Record<number, MappedField[]> = {};
    for (const f of doc.mapped_fields || []) {
      const pn = f.page_number || 1;
      (map[pn] = map[pn] || []).push(f);
    }
    return map;
  }, [doc.mapped_fields]);

  const openSignature = (fieldName: string) => {
    setSigField(fieldName); setSigOpen(true);
    setSigMode("draw"); setTypedSig("");
    setTimeout(() => sigRef.current?.clear(), 0);
  };

  const saveSignature = () => {
    if (sigMode === "draw") {
      const dataUrl = sigRef.current?.toDataURL("image/png");
      if (!dataUrl) return;
      setFormValues((p) => ({ ...p, [sigField]: dataUrl }));
    } else {
      const name = typedSig.trim();
      if (!name) return;
      setFormValues((p) => ({ ...p, [sigField]: `text:${name}` }));
    }
    setSigOpen(false);
  };

  const handleSubmit = async () => {
    const missing = (doc.mapped_fields || []).filter((f) => {
      const v = formValues[f.field_name];
      return !v || (f.field_type !== "Signature" && v.trim() === "");
    });
    if (missing.length) { toast.error("Please fill all required fields before submitting."); return; }

    setSubmitting(true);
    try {
      const itemId = doc.item_id ?? doc.onboarding_item_id ?? doc.id;
      const res = await fetch(`/api/portal/jobseeker/documents/${itemId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_seeker_id: jobSeekerId,
          submitted_fields: (doc.mapped_fields || []).map((f) => ({
            name: f.field_name,
            value: formValues[f.field_name] || "",
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) { toast.error(data?.message || "Submit failed"); return; }
      toast.success("Document submitted successfully!");
      onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div ref={wrapRef} className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="mx-auto w-full max-w-[950px]">
          <Document
            file={doc.file_url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="p-10 text-sm text-gray-500 bg-white rounded border text-center">Loading document...</div>}
            error={<div className="p-10 text-sm text-red-500 bg-white rounded border text-center">Failed to load PDF.</div>}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const pn = i + 1;
              const dim = pageDims[pn];
              const scaleX = dim ? renderWidth / dim.w : 1;
              const renderHeight = dim ? dim.h * scaleX : 0;
              const scaleY = dim && renderHeight ? renderHeight / dim.h : scaleX;
              return (
                <div key={pn} className="mb-6 bg-white shadow rounded overflow-hidden">
                  <div className="relative">
                    <Page
                      pageNumber={pn}
                      width={renderWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onLoadSuccess={(page) =>
                        setPageDims((p) => ({ ...p, [pn]: { w: page.originalWidth, h: page.originalHeight } }))
                      }
                    />
                    {dim && (fieldsByPage[pn] || []).map((field, idx) => {
                      const left = field.x * scaleX;
                      const top = field.y * scaleY;
                      const width = field.w * scaleX;
                      const height = field.h * scaleY;
                      const val = formValues[field.field_name] || "";
                      return (
                        <div key={`${pn}-${idx}`} style={{ position: "absolute", left, top, width, height }}>
                          {field.field_type === "Signature" ? (
                            <button
                              type="button"
                              onClick={() => openSignature(field.field_name)}
                              className="w-full h-full border border-blue-500 bg-blue-50/40 text-xs flex items-center justify-center"
                              title={field.field_label}
                            >
                              {val ? (
                                val.startsWith("data:image") ? (
                                  <img src={val} alt="sig" className="w-full h-full object-contain" />
                                ) : val.startsWith("text:") ? (
                                  <span style={{ fontFamily: "cursive", fontSize: 18, color: "#111" }}>
                                    {val.replace("text:", "")}
                                  </span>
                                ) : <span className="text-xs">Signed</span>
                              ) : "Click to Sign"}
                            </button>
                          ) : (
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => setFormValues((p) => ({ ...p, [field.field_name]: e.target.value }))}
                              className="w-full h-full text-xs border border-blue-500 bg-blue-50/40 focus:bg-white outline-none px-1"
                              title={field.field_label}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Document>
        </div>
      </div>

      {/* Signature modal */}
      {sigOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Signature</span>
              <button onClick={() => setSigOpen(false)} className="text-sm border px-3 py-1 rounded">Close</button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                {(["draw", "type"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setSigMode(m)}
                    className={`px-4 py-2 rounded border text-sm capitalize ${sigMode === m ? "bg-black text-white" : "bg-white"}`}>
                    {m}
                  </button>
                ))}
              </div>
              {sigMode === "draw" ? (
                <>
                  <div className="border rounded overflow-hidden">
                    <SignatureCanvas ref={sigRef} penColor="black"
                      canvasProps={{ width: 760, height: 220, className: "bg-white" }} />
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => sigRef.current?.clear()} className="border px-4 py-2 rounded" type="button">Clear</button>
                    <button onClick={saveSignature} className="bg-green-600 text-white px-4 py-2 rounded" type="button">Save Signature</button>
                  </div>
                </>
              ) : (
                <>
                  <input type="text" value={typedSig} onChange={(e) => setTypedSig(e.target.value)}
                    placeholder="Type your full name"
                    className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-black" />
                  <div className="mt-4 border rounded p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">Preview</p>
                    <div style={{ fontFamily: "cursive", fontSize: 28, color: "#111" }}>{typedSig || "Your Signature"}</div>
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => setTypedSig("")} className="border px-4 py-2 rounded" type="button">Clear</button>
                    <button onClick={saveSignature} className="bg-green-600 text-white px-4 py-2 rounded" type="button">Save Signature</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit bar */}
      <div className="p-3 border-t flex items-center justify-end gap-2 bg-white">
        <button onClick={handleSubmit} disabled={submitting}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded text-sm font-semibold">
          {submitting ? "Submitting..." : "Finalize & Submit"}
        </button>
        <button onClick={onClose} className="border px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>
  );
});

/* ─── Attach document modal ──────────────────────────────── */
function AttachModal({ doc, onClose, onAttached }: { doc: Doc; onClose: () => void; onAttached: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_id", String(doc.id));
      const res = await fetch(`/api/portal/jobseeker/documents/${doc.item_id ?? doc.id}/attach`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) { toast.error(data?.message || "Upload failed"); return; }
      toast.success("Document attached successfully!");
      onAttached();
      onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Attach Document</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Attach a file for: <strong>{doc.document_name}</strong></p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm border border-gray-300 rounded p-2"
          />
          {file && <p className="text-xs text-gray-500">Selected: {file.name}</p>}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="border px-4 py-2 rounded text-sm">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !file}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function JobSeekerDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [profile, setProfile] = useState<{ id: number; first_name: string; last_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [attachDoc, setAttachDoc] = useState<Doc | null>(null);
  const [docFilter, setDocFilter] = useState<"all" | "pending" | "done">("all");
  const viewerRef = useRef<DocumentViewerHandle>(null);

  const load = useCallback(async () => {
    setError(null);
    const [docRes, profileRes] = await Promise.all([
      fetch("/api/portal/jobseeker/documents", { cache: "no-store" }).catch(() => null),
      fetch("/api/portal/jobseeker/profile", { cache: "no-store" }).catch(() => null),
    ]);
    const docData = await docRes?.json().catch(() => ({}));
    const profileData = await profileRes?.json().catch(() => ({}));

    if (!docRes?.ok || !docData?.success) {
      setError(String(docData?.message || "Failed to load documents"));
    } else {
      setDocs(Array.isArray(docData.documents) ? docData.documents : []);
    }
    if (profileData?.success) {
      const p = profileData.profile;
      if (p?.id) setProfile({ id: p.id, first_name: p.first_name || "", last_name: p.last_name || "" });
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const pendingDocs = useMemo(
    () => docs.filter((d) => ["SENT", "PENDING_JOBSEEKER", "REJECTED"].includes(d.status.toUpperCase())),
    [docs]
  );
  const completedDocs = useMemo(
    () => docs.filter((d) => ["SUBMITTED", "PENDING_ADMIN_REVIEW", "APPROVED", "COMPLETED"].includes(d.status.toUpperCase())),
    [docs]
  );

  const visiblePending = docFilter === "done" ? [] : pendingDocs;
  const visibleCompleted = docFilter === "pending" ? [] : completedDocs;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-600">Review, sign, and submit your onboarding paperwork.</p>
        </div>
        <button type="button" onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <FiRefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "done"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setDocFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${docFilter === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}>
            {f === "done" ? "Completed" : f}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Two-column layout: card list + viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: document cards */}
        <div className="space-y-3">
          {visiblePending.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-700">Needs your signature</h2>
              {visiblePending.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDoc?.id === doc.id}
                  onView={() => setSelectedDoc(doc)}
                  onAttach={() => setAttachDoc(doc)}
                  onCreateAndSubmit={() => setSelectedDoc(doc)}
                />
              ))}
            </>
          )}

          {visibleCompleted.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-700 mt-4">Submitted / Approved</h2>
              {visibleCompleted.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDoc?.id === doc.id}
                  onView={() => setSelectedDoc(doc)}
                  onAttach={() => setAttachDoc(doc)}
                  onCreateAndSubmit={() => setSelectedDoc(doc)}
                />
              ))}
            </>
          )}

          {docs.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No onboarding documents found for this account.
            </div>
          )}
        </div>

        {/* Right: PDF viewer */}
        <div className="bg-white rounded-lg border border-gray-200 min-h-[520px] overflow-hidden flex flex-col">
          {selectedDoc ? (
            <DocumentViewer
              ref={viewerRef}
              doc={selectedDoc}
              jobseekerData={selectedDoc.jobseekerData || {}}
              jobSeekerId={profile?.id}
              onClose={() => setSelectedDoc(null)}
              onSubmitted={handleRefresh}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a document to view and sign.
            </div>
          )}
        </div>
      </div>

      {/* Attach modal */}
      {attachDoc && (
        <AttachModal
          doc={attachDoc}
          onClose={() => setAttachDoc(null)}
          onAttached={handleRefresh}
        />
      )}
    </div>
  );
}
