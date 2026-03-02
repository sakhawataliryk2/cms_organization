"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
  x: number;
  y: number;
  w: number;
  h: number;
  page_number?: number;
};
interface Props {
  doc: {
    id: number;
    document_name: string;
    file_url: string;
    mapped_fields: MappedField[];
  };
  jobseekerData: Record<string, string>;
  jobSeekerId?: number; 
  onClose: () => void;
}
type PageDim = { w: number; h: number };

// ✅ what parent can call
export type DocumentViewerHandle = {
  submit: () => void;
};

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
function DocumentViewer({ doc, jobseekerData, jobSeekerId, onClose }, ref) {
      const [pdfUrl, setPdfUrl] = useState<string>(doc.file_url);
      const [selectedJobSeekerId, setSelectedJobSeekerId] = useState<number | null>(null);
    const [numPages, setNumPages] = useState<number>(1);
    const [pageDims, setPageDims] = useState<Record<number, PageDim>>({});
    const [formValues, setFormValues] = useState<Record<string, string>>(
      jobseekerData || {}
    );

    // viewer width
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [renderWidth, setRenderWidth] = useState<number>(780);

    // signature modal
    const [sigOpen, setSigOpen] = useState(false);
    const [sigField, setSigField] = useState<string>("");
    const sigRef = useRef<SignatureCanvas | null>(null);

    const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
    const [typedSig, setTypedSig] = useState("");

    useEffect(() => {
      setPdfUrl(doc.file_url);
      setFormValues(jobseekerData || {});
    }, [doc.file_url, jobseekerData]);

    // ResizeObserver for accurate scaling
    useEffect(() => {
      if (!wrapRef.current) return;

      const el = wrapRef.current;
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        setRenderWidth(Math.max(320, Math.min(900, w)));
      });

      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const handleInputChange = (name: string, value: string) => {
      setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const openSignature = (fieldName: string) => {
      setSigField(fieldName);
      setSigOpen(true);

      setSigMode("draw");
      setTypedSig("");

      setTimeout(() => sigRef.current?.clear(), 0);
    };

    const saveSignature = () => {
      if (sigMode === "draw") {
        const dataUrl = sigRef.current?.toDataURL("image/png");
        if (!dataUrl) return;
        setFormValues((prev) => ({ ...prev, [sigField]: dataUrl }));
        setSigOpen(false);
        return;
      }

      const name = typedSig.trim();
      if (!name) return;

      setFormValues((prev) => ({ ...prev, [sigField]: `text:${name}` }));
      setSigOpen(false);
    };

    // ✅ Submit function (called from parent)
   const handleSubmit = async () => {
  const missingFields = doc.mapped_fields.filter((field) => {
    const value = formValues[field.field_name];
    if (field.field_type === "Signature") return !value;
    return !value || value.trim() === "";
  });

  if (missingFields.length) {
    alert("Please fill all required fields before submitting.");
    return;
  }

  const payload = {
  job_seeker_id: jobSeekerId,
  submitted_fields: doc.mapped_fields.map((f) => ({
    name: f.field_name,
    value: formValues[f.field_name] || "",
  })),
};

  const res = await fetch(`/api/job-seeker-portal/onboarding-items/${doc.id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    alert(data?.message || "Submit failed");
    return;
  }

  alert("Submitted successfully");
};

    // ✅ expose submit() to parent
    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
    }));

    // group fields per page
    const fieldsByPage = useMemo(() => {
      const map: Record<number, MappedField[]> = {};
      for (const f of doc.mapped_fields || []) {
        const pn = f.page_number || 1;
        map[pn] = map[pn] || [];
        map[pn].push(f);
      }
      return map;
    }, [doc.mapped_fields]);

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div ref={wrapRef} className="flex-1 overflow-auto bg-[#0b0b0b0d] p-4">
          <div className="mx-auto w-full max-w-[950px]">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={
                <div className="p-10 text-sm text-gray-600 bg-white rounded border">
                  Loading document...
                </div>
              }
            >
              {Array.from({ length: numPages }, (_, i) => {
                const pageNumber = i + 1;
                const dim = pageDims[pageNumber];

                const scaleX = dim ? renderWidth / dim.w : 1;
                const renderHeight = dim ? dim.h * scaleX : 0;
                const scaleY = dim && renderHeight ? renderHeight / dim.h : scaleX;

                return (
                  <div
                    key={pageNumber}
                    className="mb-6 bg-white shadow rounded overflow-hidden"
                  >
                    <div className="relative">
                      <Page
                        pageNumber={pageNumber}
                        width={renderWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={(page) => {
                          setPageDims((prev) => ({
                            ...prev,
                            [pageNumber]: {
                              w: page.originalWidth,
                              h: page.originalHeight,
                            },
                          }));
                        }}
                      />

                      {dim &&
                        (fieldsByPage[pageNumber] || []).map((field, idx) => {
                          const left = field.x * scaleX;
                          const top = field.y * scaleY;

                          const width = field.w * scaleX;
                          const height = field.h * scaleY;

                          const val = formValues[field.field_name] || "";

                          return (
                            <div
                              key={`${pageNumber}-${idx}`}
                              style={{
                                position: "absolute",
                                left,
                                top,
                                width,
                                height,
                              }}
                            >
                              {field.field_type === "Signature" ? (
                                <button
                                  type="button"
                                  onClick={() => openSignature(field.field_name)}
                                  className="w-full h-full border border-blue-500 bg-blue-50/40 text-xs flex items-center justify-center"
                                  title={field.field_label}
                                >
                                  {val ? (
                                    val.startsWith("data:image") ? (
                                      <img
                                        src={val}
                                        alt="signature"
                                        className="w-full h-full object-contain"
                                      />
                                    ) : val.startsWith("text:") ? (
                                      <span
                                        className="w-full text-center"
                                        style={{
                                          fontFamily: "cursive",
                                          fontSize: "18px",
                                          lineHeight: "1",
                                          color: "#111",
                                          padding: "2px",
                                        }}
                                      >
                                        {val.replace("text:", "")}
                                      </span>
                                    ) : (
                                      <span className="text-xs">Signed</span>
                                    )
                                  ) : (
                                    "Click to Sign"
                                  )}
                                </button>
                              ) : (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) =>
                                    handleInputChange(field.field_name, e.target.value)
                                  }
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

        {/* Signature Modal */}
        {sigOpen && (
          <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-semibold text-sm">Signature</div>
                <button
                  onClick={() => setSigOpen(false)}
                  className="text-sm border px-3 py-1 rounded"
                >
                  Close
                </button>
              </div>

              <div className="p-4">
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setSigMode("draw")}
                    className={`px-4 py-2 rounded border text-sm ${
                      sigMode === "draw" ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    Draw
                  </button>

                  <button
                    type="button"
                    onClick={() => setSigMode("type")}
                    className={`px-4 py-2 rounded border text-sm ${
                      sigMode === "type" ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    Type
                  </button>
                </div>

                {sigMode === "draw" && (
                  <>
                    <div className="border rounded overflow-hidden">
                      <SignatureCanvas
                        ref={(r) => {
                          sigRef.current = r;
                        }}
                        penColor="black"
                        canvasProps={{
                          width: 760,
                          height: 220,
                          className: "bg-white",
                        }}
                      />
                    </div>

                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        onClick={() => sigRef.current?.clear()}
                        className="border px-4 py-2 rounded"
                        type="button"
                      >
                        Clear
                      </button>

                      <button
                        onClick={saveSignature}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        type="button"
                      >
                        Save Signature
                      </button>
                    </div>
                  </>
                )}

                {sigMode === "type" && (
                  <>
                    <label className="text-sm font-medium text-gray-700">
                      Type your name
                    </label>
                    <input
                      type="text"
                      value={typedSig}
                      onChange={(e) => setTypedSig(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="mt-2 w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                    />

                    <div className="mt-4 border rounded p-4 bg-gray-50">
                      <div className="text-xs text-gray-500 mb-2">Preview</div>
                      <div
                        style={{
                          fontFamily: "cursive",
                          fontSize: "28px",
                          color: "#111",
                        }}
                      >
                        {typedSig || "Your Signature"}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        onClick={() => setTypedSig("")}
                        className="border px-4 py-2 rounded"
                        type="button"
                      >
                        Clear
                      </button>

                      <button
                        onClick={saveSignature}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        type="button"
                      >
                        Save Signature
                      </button>
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
);

export default DocumentViewer;