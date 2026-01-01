"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Document as PdfDoc, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


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
};

// Backend API base URL - must be set in .env.local
// Example: NEXT_PUBLIC_API_URL=http://localhost:8080
const API = process.env.API_BASE_URL || "http://localhost:8080";
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

  const storageKey = useMemo(() => `template_doc_fields_${id}`, [id]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API}/api/template-documents/${id}`);
      const data = await res.json();

      if (!res.ok || !data?.success) return;

      const fp = data.document?.file_path || data.document?.filePath;
      if (!fp) return setPdfUrl("");

      // Ensure file path starts with / and construct full backend URL
      // Backend stores paths like /uploads/template-documents/filename.pdf
      const normalizedPath = fp.startsWith('/') ? fp : '/' + fp;
      setPdfUrl(encodeURI(`${API}${normalizedPath}`));
    };

    if (id) load();
  }, [id, API]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      setFields(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  const measurePage = () => {
    if (!pageWrapRef.current) return;
    const pageEl = pageWrapRef.current.querySelector(
      ".react-pdf__Page"
    ) as HTMLElement | null;
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

  const createFieldAtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool || !pageWrapRef.current) return;

    const r = pageWrapRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    const defaultSize = {
      text: { w: 220, h: 44 },
      signature: { w: 240, h: 60 },
      date: { w: 160, h: 44 },
      checkbox: { w: 28, h: 28 },
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
      },
    ]);
  };

  const updateField = (id: string, patch: Partial<OverlayField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(fields));
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
                  onClick={() =>
                    setActivePage((p) => Math.min(numPages, p + 1))
                  }
                  className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            {!fileObj ? (
              <div className="text-sm text-gray-600">
                No PDF file found for this document.
              </div>
            ) : (
              <div
                ref={pageWrapRef}
                onClick={createFieldAtClick}
                className={`relative mx-auto w-fit ${
                  activeTool ? "cursor-crosshair" : "cursor-default"
                }`}
              >
                <PdfDoc
                  file={fileObj}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={() => {}}
                >
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
                          hPct: clamp(
                            ref.offsetHeight / pageRect.h,
                            0.02,
                            0.98
                          ),
                        });
                      }}
                      enableResizing={f.type !== "checkbox"}
                    >
                      <div className="w-full h-full border-2 border-blue-600 bg-blue-50/40 text-[11px] text-blue-900 flex items-center justify-center relative select-none">
                        <span className="px-2 text-center">{f.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(f.id);
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black text-white text-[10px] grid place-items-center"
                        >
                          ✕
                        </button>
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
        active
          ? "bg-black text-white border-black"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
