"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Document as PdfDoc, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type FieldType = "text" | "signature" | "date" | "checkbox";

type OverlayField = {
  id: string;
  type: FieldType;
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  label?: string;
  value?: string;
  checked?: boolean;
};

export default function TemplateDocEditorPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [pdfUrl, setPdfUrl] = useState("");
  const fileObj = useMemo(() => (pdfUrl ? { url: pdfUrl } : null), [pdfUrl]);

  const [numPages, setNumPages] = useState(0);
  const [activeTool, setActiveTool] = useState<FieldType | null>(null);
  const [fields, setFields] = useState<OverlayField[]>([]);
  const [activePage, setActivePage] = useState(1);

  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const [pageRect, setPageRect] = useState({ w: 1, h: 1 });

  // ✅ always works local + live
  useEffect(() => {
    if (!id) return;
    setPdfUrl(`/api/template-documents/${id}/file`);
  }, [id]);

  // ✅ load fields from DB (fallback to localStorage if needed)
  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await fetch(`/api/template-documents/${id}/fields`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data.fields)) {
          setFields(data.fields);
          return;
        }
      } catch {}

      // fallback
      const raw = localStorage.getItem(`template_doc_fields_${id}`);
      if (!raw) return;
      try {
        setFields(JSON.parse(raw));
      } catch {}
    })();
  }, [id]);

  const measurePage = () => {
    if (!pageWrapRef.current) return;
    const pageEl = pageWrapRef.current.querySelector(".react-pdf__Page") as
      | HTMLElement
      | null;
    const target = pageEl || pageWrapRef.current;
    const r = target.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setPageRect({ w: r.width, h: r.height });
  };

  useEffect(() => {
    measurePage();
    window.addEventListener("resize", measurePage);
    return () => window.removeEventListener("resize", measurePage);
  }, [activePage, numPages, pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setActivePage(1);
  };

  // ✅ create only when click on "blank" pdf area, not on any field
  const createFieldAtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool || !pageWrapRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-overlay-field='true']")) return; // ✅ stop duplicates

    const r = pageWrapRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    const defaultSize = {
      text: { w: 260, h: 70 },
      signature: { w: 280, h: 90 },
      date: { w: 220, h: 70 },
      checkbox: { w: 60, h: 60 },
    }[activeTool];

    const xPct = clamp(x / r.width, 0, 0.98);
    const yPct = clamp(y / r.height, 0, 0.98);
    const wPct = clamp(defaultSize.w / r.width, 0.02, 0.9);
    const hPct = clamp(defaultSize.h / r.height, 0.02, 0.9);

    setFields((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        type: activeTool,
        page: activePage,
        xPct,
        yPct,
        wPct,
        hPct,
        label:
          activeTool === "text"
            ? "Text"
            : activeTool === "signature"
            ? "Signature"
            : activeTool === "date"
            ? "Date"
            : "✓",
        value: "",
        checked: false,
      },
    ]);
  };

  const updateField = (fid: string, patch: Partial<OverlayField>) => {
    setFields((prev) => prev.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  };

  const deleteField = (fid: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
  };

  // ✅ Save to DB + localStorage backup
  const save = async () => {
    localStorage.setItem(`template_doc_fields_${id}`, JSON.stringify(fields));

    const res = await fetch(`/api/template-documents/${id}/fields`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      alert(data?.message || "Failed to save fields");
      return;
    }
    alert("Saved!");
  };

  const pageFields = fields.filter((f) => f.page === activePage);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Template Document Editor</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTool(null)}
            className={`px-3 py-1.5 text-xs border rounded ${
              activeTool === null ? "bg-black text-white" : "bg-white"
            }`}
          >
            Cursor
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-9">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-600">
                Page {activePage} / {numPages || "…"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={activePage <= 1}
                  onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={activePage >= numPages}
                  onClick={() => setActivePage((p) => Math.min(numPages, p + 1))}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            {!fileObj ? (
              <div className="text-sm text-gray-600">No PDF file found.</div>
            ) : (
              <div
                ref={pageWrapRef}
                onMouseDownCapture={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("[data-overlay-field='true']")) return;
                }}
                onMouseDown={createFieldAtClick}
                className={`relative mx-auto w-fit ${
                  activeTool ? "cursor-crosshair" : "cursor-default"
                }`}
              >
                <PdfDoc file={fileObj} onLoadSuccess={onDocumentLoadSuccess}>
                  <Page
                    pageNumber={activePage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={measurePage}
                  />
                </PdfDoc>

                {pageFields.map((f) => {
                  const x = f.xPct * pageRect.w;
                  const y = f.yPct * pageRect.h;
                  const w = f.wPct * pageRect.w;
                  const h = f.hPct * pageRect.h;

                  return (
                    <Rnd
                      key={f.id}
                      size={{ width: w, height: h }}
                      position={{ x, y }}
                      bounds="parent"
                      dragHandleClassName="field-drag-handle"
                      style={{ zIndex: 50 }}
                      onDragStop={(_, d) => {
                        updateField(f.id, {
                          xPct: clamp(d.x / pageRect.w, 0, 0.98),
                          yPct: clamp(d.y / pageRect.h, 0, 0.98),
                        });
                      }}
                      onResizeStop={(_, __, ref, ___, pos) => {
                        updateField(f.id, {
                          xPct: clamp(pos.x / pageRect.w, 0, 0.98),
                          yPct: clamp(pos.y / pageRect.h, 0, 0.98),
                          wPct: clamp(ref.offsetWidth / pageRect.w, 0.02, 0.98),
                          hPct: clamp(ref.offsetHeight / pageRect.h, 0.02, 0.98),
                        });
                      }}
                      enableResizing={true}
                    >
                      <div
                        data-overlay-field="true"
                        className="w-full h-full bg-white border-2 border-blue-600 rounded-sm overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* drag bar */}
                        <div className="field-drag-handle h-6 bg-blue-600 text-white text-[11px] px-2 flex items-center justify-between cursor-move">
                          <span className="truncate">{f.label}</span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(f.id);
                            }}
                            className="ml-2 w-5 h-5 rounded-full bg-black text-white text-[10px] grid place-items-center"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>

                        {/* content */}
                        <div className="h-[calc(100%-24px)] p-1">
                          {f.type === "text" && (
                            <input
                              value={f.value || ""}
                              onChange={(e) =>
                                updateField(f.id, { value: e.target.value })
                              }
                              placeholder="Type..."
                              className="w-full h-full px-2 text-[12px] outline-none border border-gray-200 rounded"
                            />
                          )}

                          {f.type === "date" && (
                            <input
                              type="date"
                              value={f.value || ""}
                              onChange={(e) =>
                                updateField(f.id, { value: e.target.value })
                              }
                              className="w-full h-full px-2 text-[12px] outline-none border border-gray-200 rounded"
                            />
                          )}

                          {f.type === "checkbox" && (
                            <div className="w-full h-full flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={!!f.checked}
                                onChange={(e) =>
                                  updateField(f.id, { checked: e.target.checked })
                                }
                                className="w-5 h-5"
                              />
                            </div>
                          )}

                          {f.type === "signature" && (
                            <div className="w-full h-full flex items-center justify-center text-[12px] text-gray-600 border border-gray-200 rounded">
                              Signature Here
                            </div>
                          )}
                        </div>
                      </div>
                    </Rnd>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="text-sm font-semibold mb-3">Fields</div>
            <div className="space-y-2">
              <ToolButton
                label="Text"
                active={activeTool === "text"}
                onClick={() => setActiveTool("text")}
              />
              <ToolButton
                label="Signature"
                active={activeTool === "signature"}
                onClick={() => setActiveTool("signature")}
              />
              <ToolButton
                label="Date"
                active={activeTool === "date"}
                onClick={() => setActiveTool("date")}
              />
              <ToolButton
                label="Checkbox"
                active={activeTool === "checkbox"}
                onClick={() => setActiveTool("checkbox")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm border rounded ${
        active ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
