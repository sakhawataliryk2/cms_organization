"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import SignatureCanvas from "react-signature-canvas";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type MappedField = {
  id?: number;
  field_name: string;
  field_label: string;
  field_type: string;
  required?: boolean;
  who_fills?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page?: number;
  page_number?: number;
  value_key?: string;
  syncable?: boolean;
  config?: Record<string, unknown>;
};

type PacketDoc = {
  item_id: number;
  template_document_id: number;
  document_name: string;
  file_url: string;
  status: string;
  mapped_fields: MappedField[];
};

function isSignatureField(field: MappedField) {
  const t = String(field.field_type || "").toLowerCase();
  const n = String(field.field_name || "").toLowerCase();
  return (
    t === "e_signature" ||
    t === "signature" ||
    n === "signature_box" ||
    n === "e_signature" ||
    n === "signature"
  );
}

function fieldValueKey(field: MappedField) {
  if (field.value_key) return field.value_key;
  if (field.syncable === false || isSignatureField(field)) {
    return field.id != null ? `inst:${field.id}` : `inst:${field.field_name}`;
  }
  return field.field_name;
}

export default function PublicOnboardingPacketPage() {
  const params = useParams();
  const token = String(params?.token || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PacketDoc[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [seekerName, setSeekerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const [numPages, setNumPages] = useState(1);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});
  const [renderWidth, setRenderWidth] = useState(780);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);

  const [sigOpen, setSigOpen] = useState(false);
  const [sigKey, setSigKey] = useState("");
  const sigRef = useRef<SignatureCanvas>(null);
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSig, setTypedSig] = useState("");

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const loadPacket = useCallback(async () => {
    if (!token) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/public/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setErrorCode(data?.code || null);
        setError(data?.message || "Unable to open this onboarding packet.");
        return;
      }
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setValues(data.values && typeof data.values === "object" ? data.values : {});
      setExpiresAt(data.expires_at || null);
      const fn = data.job_seeker?.first_name || "";
      const ln = data.job_seeker?.last_name || "";
      setSeekerName(`${fn} ${ln}`.trim());
      setActiveIdx(0);
    } catch {
      setError("Failed to load onboarding packet.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPacket();
  }, [loadPacket]);

  const activeDoc = documents[activeIdx] || null;

  // Load PDF: prefer direct public blob URL (CORS *), fallback to same-origin proxy
  useEffect(() => {
    if (!token || !activeDoc?.item_id) {
      setPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const proxyUrl = `/api/onboarding/public/${encodeURIComponent(token)}/document/${activeDoc.item_id}`;
    const directUrl = activeDoc.file_url ? String(activeDoc.file_url).trim() : "";

    const loadFromResponse = async (res: Response, label: string) => {
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const data = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
        throw new Error(
          data?.message || `Failed to load PDF via ${label} (${res.status})`
        );
      }
      const blob = await res.blob();
      if (cancelled) return null;
      if (!blob.size) {
        throw new Error(`PDF file is empty (via ${label})`);
      }
      // Ensure browser treats it as PDF even if remote content-type is odd
      const pdfBlob =
        blob.type.includes("pdf") || blob.type === "application/octet-stream"
          ? blob
          : new Blob([await blob.arrayBuffer()], { type: "application/pdf" });
      return URL.createObjectURL(pdfBlob);
    };

    (async () => {
      setPdfLoading(true);
      setPdfError(null);
      setPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setNumPages(1);
      setPageDims({});

      try {
        let objectUrl: string | null = null;
        let lastError: unknown = null;

        // 1) Direct blob URL (public Vercel blob has ACAO *)
        if (directUrl && /^https?:\/\//i.test(directUrl)) {
          try {
            const res = await fetch(directUrl, {
              cache: "no-store",
              signal: controller.signal,
              mode: "cors",
            });
            objectUrl = await loadFromResponse(res, "blob");
          } catch (e) {
            lastError = e;
            if (e instanceof DOMException && e.name === "AbortError") throw e;
            console.warn("[onboarding] direct PDF fetch failed, trying proxy", e);
          }
        }

        // 2) Same-origin proxy fallback
        if (!objectUrl && !cancelled) {
          try {
            const res = await fetch(proxyUrl, {
              cache: "no-store",
              signal: controller.signal,
            });
            objectUrl = await loadFromResponse(res, "proxy");
          } catch (e) {
            lastError = e;
            if (e instanceof DOMException && e.name === "AbortError") throw e;
          }
        }

        if (cancelled) return;
        if (!objectUrl) {
          const msg =
            lastError instanceof Error ? lastError.message : "Failed to load PDF";
          const blocked = /Failed to fetch|NetworkError|blocked|ERR_BLOCKED/i.test(
            msg
          );
          throw new Error(
            blocked
              ? "Could not load the PDF. Disable ad blockers/privacy extensions for this site and refresh."
              : msg
          );
        }

        setPdfObjectUrl(objectUrl);
      } catch (e: unknown) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        const msg = e instanceof Error ? e.message : "Failed to load PDF";
        setPdfError(msg);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, activeDoc?.item_id, activeDoc?.file_url, pdfReloadKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const updateWidth = () => {
      const node = wrapRef.current;
      if (!node) return;
      setRenderWidth(Math.max(320, Math.min(900, node.clientWidth)));
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeIdx, documents.length, pdfObjectUrl, pdfLoading, pdfError]);

  // Autosave draft every 8s when values change
  useEffect(() => {
    if (!token || submitted || error) return;
    const handle = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await fetch(`/api/onboarding/public/${encodeURIComponent(token)}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: valuesRef.current }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 8000);
    return () => window.clearTimeout(handle);
  }, [values, token, submitted, error]);

  const fieldsByPage = useMemo(() => {
    return (activeDoc?.mapped_fields || []).reduce<Record<number, MappedField[]>>((acc, f) => {
      const pn = f.page_number || f.page || 1;
      (acc[pn] = acc[pn] || []).push(f);
      return acc;
    }, {});
  }, [activeDoc]);

  const setFieldValue = (field: MappedField, next: string) => {
    const key = fieldValueKey(field);
    if (!key) return;
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const openSignature = (field: MappedField) => {
    setSigKey(fieldValueKey(field));
    setSigOpen(true);
    setSigMode("draw");
    setTypedSig("");
    setTimeout(() => sigRef.current?.clear(), 0);
  };

  const saveSignature = () => {
    if (!sigKey) return;
    if (sigMode === "draw") {
      const dataUrl = sigRef.current?.toDataURL("image/png");
      if (!dataUrl) return;
      setValues((p) => ({ ...p, [sigKey]: dataUrl }));
    } else {
      const name = typedSig.trim();
      if (!name) return;
      setValues((p) => ({ ...p, [sigKey]: `text:${name}` }));
    }
    setSigOpen(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/public/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (Array.isArray(data?.missing) && data.missing.length) {
          toast.error(
            `Missing: ${data.missing
              .slice(0, 3)
              .map((m: { field_label?: string }) => m.field_label)
              .join(", ")}`
          );
        } else {
          toast.error(data?.message || "Submit failed");
        }
        return;
      }
      setSubmitted(true);
      toast.success("Packet submitted successfully");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white border rounded-lg p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-slate-600">{error}</p>
          {errorCode && (
            <p className="text-xs text-slate-400 mt-3 uppercase tracking-wide">{errorCode}</p>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white border rounded-lg p-6 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Thank you</h1>
          <p className="text-sm text-slate-600">
            Your onboarding packet has been submitted. You can close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Onboarding Packet</h1>
            <p className="text-xs text-slate-500">
              {seekerName ? `${seekerName} · ` : ""}
              No login required
              {expiresAt ? ` · Link expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
              {saveState === "saving"
                ? " · Saving…"
                : saveState === "saved"
                  ? " · Draft saved"
                  : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !documents.length}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit packet"}
          </button>
        </div>
        {documents.length > 1 && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
            {documents.map((doc, idx) => (
              <button
                key={doc.item_id}
                type="button"
                onClick={() => {
                  setActiveIdx(idx);
                  setNumPages(1);
                  setPageDims({});
                }}
                className={`whitespace-nowrap px-3 py-1.5 rounded text-xs border ${
                  idx === activeIdx
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {idx + 1}. {doc.document_name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 pb-16">
        {!activeDoc ? (
          <div className="bg-white rounded border p-6 text-sm text-slate-600">
            No documents in this packet.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {activeDoc.document_name}
                </h2>
                <p className="text-xs text-slate-500">
                  Fields with the same name sync across all documents in this packet.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={activeIdx <= 0}
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  className="border px-3 py-1.5 rounded text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={activeIdx >= documents.length - 1}
                  onClick={() => setActiveIdx((i) => Math.min(documents.length - 1, i + 1))}
                  className="border px-3 py-1.5 rounded text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <div ref={wrapRef} className="bg-gray-200 rounded-lg p-3 overflow-auto">
              <div className="mx-auto w-full max-w-[950px]">
                {pdfLoading && (
                  <div className="p-10 text-center text-sm text-gray-500 bg-white rounded border">
                    Loading PDF…
                  </div>
                )}
                {pdfError && (
                  <div className="p-6 text-sm text-red-700 bg-white rounded border space-y-2">
                    <p>{pdfError}</p>
                    <button
                      type="button"
                      className="border px-3 py-1.5 rounded text-xs"
                      onClick={() => setPdfReloadKey((k) => k + 1)}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!pdfLoading && !pdfError && pdfObjectUrl && (
                <Document
                  file={pdfObjectUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={
                    <div className="p-10 text-center text-sm text-gray-500 bg-white rounded border">
                      Rendering PDF…
                    </div>
                  }
                  error={
                    <div className="p-10 text-center text-sm text-red-600 bg-white rounded border">
                      Failed to render PDF.
                    </div>
                  }
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
                              setPageDims((p) => ({
                                ...p,
                                [pn]: { w: page.originalWidth, h: page.originalHeight },
                              }))
                            }
                          />
                          {dim &&
                            (fieldsByPage[pn] || []).map((field, idx) => {
                              const key = fieldValueKey(field);
                              const val = values[key] || "";
                              return (
                                <div
                                  key={`${key}-${idx}`}
                                  style={{
                                    position: "absolute",
                                    left: field.x * scaleX,
                                    top: field.y * scaleY,
                                    width: field.w * scaleX,
                                    height: field.h * scaleY,
                                  }}
                                >
                                  {isSignatureField(field) ? (
                                    <button
                                      type="button"
                                      onClick={() => openSignature(field)}
                                      className="w-full h-full border border-blue-500 bg-blue-50/40 text-xs flex items-center justify-center"
                                    >
                                      {val ? (
                                        val.startsWith("data:image") ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={val}
                                            alt="signature"
                                            className="w-full h-full object-contain"
                                          />
                                        ) : val.startsWith("text:") ? (
                                          <span style={{ fontFamily: "cursive", fontSize: 18 }}>
                                            {val.replace("text:", "")}
                                          </span>
                                        ) : (
                                          "Signed"
                                        )
                                      ) : (
                                        "Click to Sign"
                                      )}
                                    </button>
                                  ) : (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => setFieldValue(field, e.target.value)}
                                      className="w-full h-full text-xs border border-blue-500 bg-blue-50/40 focus:bg-white outline-none px-1"
                                      title={field.field_label || field.field_name}
                                      placeholder={field.field_label || field.field_name}
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
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {sigOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Signature</span>
              <button
                type="button"
                onClick={() => setSigOpen(false)}
                className="text-sm border px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                {(["draw", "type"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSigMode(m)}
                    className={`px-4 py-2 rounded border text-sm capitalize ${
                      sigMode === m ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {sigMode === "draw" ? (
                <div className="border rounded bg-slate-50">
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{ className: "w-full h-48" }}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={typedSig}
                  onChange={(e) => setTypedSig(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ fontFamily: "cursive", fontSize: 22 }}
                />
              )}
              <div className="flex justify-end gap-2 mt-4">
                {sigMode === "draw" && (
                  <button
                    type="button"
                    onClick={() => sigRef.current?.clear()}
                    className="border px-4 py-2 rounded text-sm"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveSignature}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
                >
                  Save signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
