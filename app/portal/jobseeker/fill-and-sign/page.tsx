"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import SignatureCanvas from "react-signature-canvas";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type MappedField = {
  id?: number; field_name: string; field_label: string; field_type: string;
  x: number; y: number; w: number; h: number; page_number?: number;
};
type DocItem = {
  id: number; document_name: string; file_url: string;
  mapped_fields: MappedField[]; jobseekerData?: Record<string, string>;
  job_seeker_id?: number;
};

function FillAndSignInner() {
  const params = useSearchParams();
  const itemId = params?.get("itemId") || "";
  const [docItem, setDocItem] = useState<DocItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [renderWidth, setRenderWidth] = useState(780);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigField, setSigField] = useState("");
  const sigRef = useRef<SignatureCanvas>(null);
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSig, setTypedSig] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!itemId) { setError("No document item ID provided."); setLoading(false); return; }
    fetch(`/api/portal/jobseeker/documents`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const docs: DocItem[] = Array.isArray(data?.documents) ? data.documents : [];
        const found = docs.find((d) => String(d.id) === String(itemId) ||
          String((d as any).item_id) === String(itemId) ||
          String((d as any).onboarding_item_id) === String(itemId));
        if (!found) { setError("Document not found."); return; }
        setDocItem(found);
        setFormValues(found.jobseekerData || {});
      })
      .catch(() => setError("Failed to load document."))
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      setRenderWidth(Math.max(320, Math.min(900, wrapRef.current!.clientWidth)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const fieldsByPage = (docItem?.mapped_fields || []).reduce<Record<number, MappedField[]>>((acc, f) => {
    const pn = f.page_number || 1;
    (acc[pn] = acc[pn] || []).push(f);
    return acc;
  }, {});

  const openSignature = (fieldName: string) => {
    setSigField(fieldName); setSigOpen(true); setSigMode("draw"); setTypedSig("");
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
    if (!docItem) return;
    const missing = (docItem.mapped_fields || []).filter((f) => {
      const v = formValues[f.field_name];
      return !v || (f.field_type !== "Signature" && v.trim() === "");
    });
    if (missing.length) { toast.error("Please fill all required fields."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/jobseeker/documents/${itemId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_seeker_id: docItem.job_seeker_id,
          submitted_fields: (docItem.mapped_fields || []).map((f) => ({
            name: f.field_name, value: formValues[f.field_name] || "",
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) { toast.error(data?.message || "Submit failed"); return; }
      toast.success("Document submitted successfully!");
      window.history.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!docItem) return null;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{docItem.document_name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill in all fields and sign where required.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="border px-4 py-2 rounded text-sm">Back</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60">
            {submitting ? "Submitting..." : "Finalize & Submit"}
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="bg-gray-100 rounded-lg p-4 overflow-auto">
        <div className="mx-auto w-full max-w-[950px]">
          <Document
            file={docItem.file_url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="p-10 text-center text-sm text-gray-500 bg-white rounded border">Loading PDF...</div>}
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
                    <Page pageNumber={pn} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false}
                      onLoadSuccess={(page) => setPageDims((p) => ({ ...p, [pn]: { w: page.originalWidth, h: page.originalHeight } }))} />
                    {dim && (fieldsByPage[pn] || []).map((field, idx) => {
                      const val = formValues[field.field_name] || "";
                      return (
                        <div key={idx} style={{ position: "absolute", left: field.x * scaleX, top: field.y * scaleY, width: field.w * scaleX, height: field.h * scaleY }}>
                          {field.field_type === "Signature" ? (
                            <button type="button" onClick={() => openSignature(field.field_name)}
                              className="w-full h-full border border-blue-500 bg-blue-50/40 text-xs flex items-center justify-center">
                              {val ? (val.startsWith("data:image") ? <img src={val} alt="sig" className="w-full h-full object-contain" /> :
                                val.startsWith("text:") ? <span style={{ fontFamily: "cursive", fontSize: 18 }}>{val.replace("text:", "")}</span> :
                                  "Signed") : "Click to Sign"}
                            </button>
                          ) : (
                            <input type="text" value={val}
                              onChange={(e) => setFormValues((p) => ({ ...p, [field.field_name]: e.target.value }))}
                              className="w-full h-full text-xs border border-blue-500 bg-blue-50/40 focus:bg-white outline-none px-1"
                              title={field.field_label} />
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
                    className={`px-4 py-2 rounded border text-sm capitalize ${sigMode === m ? "bg-black text-white" : "bg-white"}`}>{m}</button>
                ))}
              </div>
              {sigMode === "draw" ? (
                <>
                  <div className="border rounded overflow-hidden">
                    <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ width: 760, height: 220, className: "bg-white" }} />
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => sigRef.current?.clear()} className="border px-4 py-2 rounded" type="button">Clear</button>
                    <button onClick={saveSignature} className="bg-green-600 text-white px-4 py-2 rounded" type="button">Save</button>
                  </div>
                </>
              ) : (
                <>
                  <input type="text" value={typedSig} onChange={(e) => setTypedSig(e.target.value)} placeholder="Type your full name"
                    className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-black" />
                  <div className="mt-4 border rounded p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">Preview</p>
                    <div style={{ fontFamily: "cursive", fontSize: 28, color: "#111" }}>{typedSig || "Your Signature"}</div>
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => setTypedSig("")} className="border px-4 py-2 rounded" type="button">Clear</button>
                    <button onClick={saveSignature} className="bg-green-600 text-white px-4 py-2 rounded" type="button">Save</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FillAndSignPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <FillAndSignInner />
    </Suspense>
  );
}
