"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use CDN worker to avoid Next.js ESM bundling issues with pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type YesNo = "Yes" | "No";

type AvailableField = {
  id: number;
  entity_type: string;
  field_name: string;
  field_label: string;
  is_hidden?: boolean;
};

type FieldTypeUI =
  | "Text Input"
  | "Text Area"
  | "Number"
  | "Email"
  | "Phone"
  | "Date"
  | "Checkbox"
  | "Signature"
  | "Blank";

type FieldFormat = "None" | "Phone Number" | "SSN";

type MappedField = {
  id: string;
  source_field_name: string;
  source_field_label: string;

  // stored in "PDF coordinate space" (unscaled)
  x: number;
  y: number;
  w: number;
  h: number;

  whoFills: "Admin" | "Candidate";
  required: YesNo;
  fieldType: FieldTypeUI;
  maxChars: number | "";
  format: FieldFormat;
  populateWithData: YesNo;
  dataFlowBack: YesNo;
};

function getTokenFromCookie() {
  if (typeof document === "undefined") return "";
  return document.cookie.replace(
    /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
    "$1"
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TemplateDocEditorPage() {
  const params = useParams();
  const docId = String(params?.id || "");

  // LEFT
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");

  // PDF
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [numPages, setNumPages] = useState(1);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pagePx, setPagePx] = useState({ w: 0, h: 0 });

  // CANVAS
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [mappedFields, setMappedFields] = useState<MappedField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // UI
  const [saving, setSaving] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftField, setDraftField] = useState<MappedField | null>(null);

  const selectedField = useMemo(
    () => mappedFields.find((f) => f.id === selectedId) || null,
    [mappedFields, selectedId]
  );
    const isSignatureBox = draftField?.source_field_name === "signature_box";
    const isBlankBox = draftField?.source_field_name === "blank_box";
    const hideExtraOptions = isSignatureBox || isBlankBox;
  

  const extraFields: AvailableField[] = useMemo(
    () => [
      {
        id: -1001,
        entity_type: "system",
        field_name: "signature_box",
        field_label: "Signature Box",
        is_hidden: false,
      },
      {
        id: -1002,
        entity_type: "system",
        field_name: "blank_box",
        field_label: "Blank Box (Variable)",
        is_hidden: false,
      },
    ],
    []
  );

  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const token = getTokenFromCookie();

      const response = await fetch("/api/admin/field-management/job-seekers", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Failed to fetch available fields");
      const data = await response.json();

      const fields = (data.customFields || []).filter(
        (f: any) => f.is_hidden === false
      );

      setAvailableFields(fields);
    } catch (err: any) {
      console.error("Error fetching available fields:", err?.message || err);
      setAvailableFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  };

  const fetchDoc = async () => {
    setLoadingPdf(true);
    try {
      setPdfUrl(`/api/template-documents/${docId}/file`);
    } finally {
      setLoadingPdf(false);
    }
  };

  const fetchMappings = async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch(`/api/template-documents/${docId}/mappings`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setMappedFields([]);
        return;
      }

      const rows = data.fields || [];
      const mapped: MappedField[] = rows.map((r: any) => ({
        id: String(r.client_id || r.id || crypto.randomUUID()),
        source_field_name: r.field_name,
        source_field_label: r.field_label || r.field_name,

        x: Number(r.x ?? 20),
        y: Number(r.y ?? 20),
        w: Number(r.w ?? 220),
        h: Number(r.h ?? 44),

        whoFills: r.who_fills === "Admin" ? "Admin" : "Candidate",
        required: r.is_required ? "Yes" : "No",
        fieldType: (r.field_type as FieldTypeUI) || "Text Input",
        maxChars: r.max_characters ?? 255,
        format: (r.format as FieldFormat) || "None",
        populateWithData: r.populate_with_data ? "Yes" : "No",
        dataFlowBack: r.data_flow_back ? "Yes" : "No",
      }));

      setMappedFields(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    fetchAvailableFields();
    fetchDoc();
    fetchMappings();
    setSelectedId(null);
    setIsModalOpen(false);
    setDraftField(null);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // ✅ Merge extra fields + API fields, then filter by search
  const allAvailableFields = useMemo(() => {
    return [...extraFields, ...availableFields];
  }, [extraFields, availableFields]);

  const filteredAvailableFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return allAvailableFields;
    return allAvailableFields.filter((f) =>
      (f.field_label || f.field_name || "").toLowerCase().includes(q)
    );
  }, [allAvailableFields, fieldSearch]);

  const onDragStartField = (e: React.DragEvent, field: AvailableField) => {
    e.dataTransfer.setData("application/x-field", JSON.stringify(field));
    e.dataTransfer.effectAllowed = "copy";
  };

  const onDragOverCanvas = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const openModalForField = (id: string) => {
    const f = mappedFields.find((x) => x.id === id);
    if (!f) return;
    setSelectedId(id);
    const next = { ...f };

    if (next.source_field_name === "signature_box") {
      next.fieldType = "Signature";
    }

    if (next.source_field_name === "blank_box") {
      if (next.fieldType !== "Text Area") next.fieldType = "Text Input";
    }

    setDraftField(next);

    setDraftField({ ...f });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDraftField(null);
  };

  const applyDraftToState = () => {
    if (!draftField) return;
    const id = draftField.id;
    setMappedFields((prev) => prev.map((f) => (f.id === id ? draftField : f)));
    closeModal();
  };

  const updateDraft = (patch: Partial<MappedField>) => {
    setDraftField((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  const getUnscaledPageSize = () => {
    const pageW = scale ? pagePx.w / scale : 0;
    const pageH = scale ? pagePx.h / scale : 0;
    return { pageW, pageH };
  };

  const onDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();

    const raw = e.dataTransfer.getData("application/x-field");
    if (!raw) return;

    let src: AvailableField | null = null;
    try {
      src = JSON.parse(raw);
    } catch {
      return;
    }
    if (!src) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pageEl = canvas.querySelector(
      ".react-pdf__Page"
    ) as HTMLElement | null;
    if (!pageEl) return;

    const rect = pageEl.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;

    const x = Math.max(0, pxX / scale);
    const y = Math.max(0, pxY / scale);

    let w = 220;
    let h = 44;

   const inferredType: FieldTypeUI =
     src.field_name === "signature_box"
       ? "Signature"
       : src.field_name === "blank_box"
       ? "Text Input"
       : "Text Input";

   if (inferredType === "Signature") {
     w = 260;
     h = 80;
   }

   if (src.field_name === "blank_box") {
     w = 260;
     h = 44;
   }


    const newField: MappedField = {
      id: crypto.randomUUID(),
      source_field_name: src.field_name,
      source_field_label: src.field_label || src.field_name,
      x,
      y,
      w,
      h,

      whoFills: "Candidate",
      required: "No",
      fieldType: inferredType,
      maxChars: 255,
      format: "None",
      populateWithData: "No",
      dataFlowBack: "No",
    };

    setMappedFields((p) => [...p, newField]);

    // Open modal after drop
    setSelectedId(newField.id);
    setDraftField({ ...newField });
    setIsModalOpen(true);
  };

  const startDrag = (id: string, startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const target = mappedFields.find((f) => f.id === id);
    if (!target) return;

    const originX = target.x;
    const originY = target.y;

    const { pageW, pageH } = getUnscaledPageSize();

    const onMove = (ev: MouseEvent) => {
      const dxUnscaled = (ev.clientX - startX) / scale;
      const dyUnscaled = (ev.clientY - startY) / scale;

      setMappedFields((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;

          // keep within page bounds
          const nx = clamp(originX + dxUnscaled, 0, Math.max(0, pageW - f.w));
          const ny = clamp(originY + dyUnscaled, 0, Math.max(0, pageH - f.h));

          return { ...f, x: nx, y: ny };
        })
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ✅ Client requirement: drag-to-resize (no width/height number adjusters)
  const startResize = (id: string, startX: number, startY: number) => {
    const target = mappedFields.find((f) => f.id === id);
    if (!target) return;

    const originW = target.w;
    const originH = target.h;

    const { pageW, pageH } = getUnscaledPageSize();

    const onMove = (ev: MouseEvent) => {
      const dxUnscaled = (ev.clientX - startX) / scale;
      const dyUnscaled = (ev.clientY - startY) / scale;

      setMappedFields((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;

          const maxW = Math.max(20, pageW - f.x);
          const maxH = Math.max(20, pageH - f.y);

          const nw = clamp(originW + dxUnscaled, 20, maxW);
          const nh = clamp(originH + dyUnscaled, 20, maxH);

          return { ...f, w: nw, h: nh };
        })
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const removeField = (id: string) => {
    setMappedFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    if (draftField?.id === id) closeModal();
  };

  const saveMapping = async () => {
    try {
      setSaving(true);

      const payload = {
        fields: mappedFields.map((f, i) => ({
          field_id: null,
          field_name: f.source_field_name,
          field_label: f.source_field_label,
          field_type: f.fieldType,
          who_fills: f.whoFills,
          is_required: f.required === "Yes",
          max_characters: f.maxChars === "" ? null : Number(f.maxChars),
          format: f.format,
          populate_with_data: f.populateWithData === "Yes",
          data_flow_back: f.dataFlowBack === "Yes",
          sort_order: i,
          x: Math.round(f.x),
          y: Math.round(f.y),
          w: Math.round(f.w),
          h: Math.round(f.h),
        })),
      };

      const res = await fetch(`/api/template-documents/${docId}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Save failed");

      window.location.href = "/dashboard/admin/document-management";
    } catch (e: any) {
      console.error("Save mapping error:", e);
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };
  



  return (
    <div className="min-h-screen bg-gray-100">
      {/* TOP BAR */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">
          Template Document Editor{" "}
          <span className="text-gray-500">Doc ID: {docId}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))
            }
            className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-50"
            type="button"
          >
            Zoom -
          </button>
          <button
            onClick={() =>
              setScale((s) => Math.min(2, Number((s + 0.1).toFixed(2))))
            }
            className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-50"
            type="button"
          >
            Zoom +
          </button>

          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Next
          </button>

          <button
            onClick={saveMapping}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        {/* LEFT */}
        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Fields</div>
              <button
                onClick={fetchAvailableFields}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                disabled={isLoadingFields}
                type="button"
              >
                Refresh
              </button>
            </div>

            <input
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Search fields..."
              className="w-full px-3 py-2 text-sm border rounded mb-2 outline-none focus:ring-2 focus:ring-blue-500"
            />

            {isLoadingFields ? (
              <div className="text-xs text-gray-600">Loading fields...</div>
            ) : filteredAvailableFields.length === 0 ? (
              <div className="text-xs text-gray-600">No fields found.</div>
            ) : (
              <div className="max-h-[65vh] overflow-auto border rounded">
                {filteredAvailableFields.map((f) => (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={(e) => onDragStartField(e, f)}
                    className="px-3 py-2 text-sm border-b last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-gray-50 flex items-center justify-between"
                    title="Drag to canvas"
                  >
                    <span className="truncate">{f.field_label}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {f.field_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER */}
        <div className="col-span-9">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-600">
                Drag fields onto the PDF to map them
              </div>
              <div className="text-xs text-gray-500">
                {loadingMappings
                  ? "Loading..."
                  : `Mapped: ${mappedFields.length}`}
              </div>
            </div>

            <div
              ref={canvasRef}
              onDrop={onDropCanvas}
              onDragOver={onDragOverCanvas}
              className="relative w-full h-[75vh] bg-white border border-gray-200 rounded overflow-auto"
              onMouseDown={() => setSelectedId(null)}
            >
              {loadingPdf ? (
                <div className="absolute inset-0 grid place-items-center text-sm text-gray-500">
                  Loading PDF...
                </div>
              ) : pdfUrl ? (
                <div className="relative w-fit mx-auto p-3">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={(pdf) => {
                      setNumPages(pdf.numPages);
                      setPage((p) => Math.min(p, pdf.numPages));
                    }}
                    loading={
                      <div className="p-4 text-sm text-gray-500">
                        Loading...
                      </div>
                    }
                    error={
                      <div className="p-4 text-sm text-red-600">
                        Failed to load PDF
                      </div>
                    }
                  >
                    <Page
                      pageNumber={page}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      onRenderSuccess={() => {
                        const el = canvasRef.current;
                        if (!el) return;
                        const pageEl = el.querySelector(
                          ".react-pdf__Page"
                        ) as HTMLElement | null;
                        if (!pageEl) return;
                        const r = pageEl.getBoundingClientRect();
                        setPagePx({ w: r.width, h: r.height });
                      }}
                    />
                  </Document>

                  {/* OVERLAY aligned to PDF page */}
                  <div
                    className="absolute left-3 top-3"
                    style={{ width: pagePx.w, height: pagePx.h }}
                  >
                    {mappedFields.map((f) => {
                      const selected = f.id === selectedId;

                      return (
                        <div
                          key={f.id}
                          className={`absolute bg-white/90 border rounded shadow-sm ${
                            selected
                              ? "border-blue-600 ring-2 ring-blue-200"
                              : "border-gray-300"
                          }`}
                          style={{
                            left: f.x * scale,
                            top: f.y * scale,
                            width: f.w * scale,
                            height: f.h * scale,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedId(f.id);
                            startDrag(f.id, e.clientX, e.clientY);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openModalForField(f.id);
                          }}
                        >
                          <div className="h-full px-2 flex items-center justify-between gap-2 relative">
                            <button
                              type="button"
                              className="text-left flex-1 min-w-0"
                              title="Click to edit settings"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModalForField(f.id);
                              }}
                            >
                              <div className="text-xs font-semibold truncate">
                                {f.source_field_label}
                              </div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {f.source_field_name} • {f.fieldType}
                              </div>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(f.id);
                              }}
                              className="w-6 h-6 grid place-items-center text-xs border rounded hover:bg-gray-50"
                              title="Remove"
                              type="button"
                            >
                              ✕
                            </button>

                            {/* ✅ Resize handle (drag to size) */}
                            <div
                              title="Drag to resize"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedId(f.id);
                                startResize(f.id, e.clientX, e.clientY);
                              }}
                              className="absolute right-1 bottom-1 w-3 h-3 bg-gray-800/70 rounded cursor-se-resize"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm text-gray-500">
                  No PDF found (file_path missing).
                </div>
              )}
            </div>

            <div className="text-[11px] text-gray-500 mt-2">
              Tip: click a mapped field to open settings. Drag to reposition.
              Use bottom-right handle to resize.
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && draftField && (
        <div
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="absolute inset-0 bg-black/40" />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-800 text-white">
                <div className="text-sm font-semibold truncate">
                  Edit Field: {draftField.source_field_label}
                </div>
                <button
                  type="button"
                  className="w-8 h-8 grid place-items-center rounded hover:bg-white/10"
                  onClick={closeModal}
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* LEFT */}
                  <div className="space-y-4">
                    <div className="text-xs text-gray-500">
                      <div className="font-semibold text-gray-800">
                        {draftField.source_field_label}
                      </div>
                      <div>{draftField.source_field_name}</div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Who will fill field
                      </label>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={draftField.whoFills === "Admin"}
                            onChange={() => updateDraft({ whoFills: "Admin" })}
                          />
                          Admin
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={draftField.whoFills === "Candidate"}
                            onChange={() =>
                              updateDraft({ whoFills: "Candidate" })
                            }
                          />
                          Candidate
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Required
                      </label>
                      <div className="flex gap-2">
                        <ToggleBtn
                          active={draftField.required === "No"}
                          onClick={() => updateDraft({ required: "No" })}
                          label="No"
                        />
                        <ToggleBtn
                          active={draftField.required === "Yes"}
                          onClick={() => updateDraft({ required: "Yes" })}
                          label="Yes"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Field Type
                      </label>

                      {isSignatureBox ? (
                        <div className="w-full h-9 px-3 border rounded text-sm bg-gray-50 flex items-center">
                          Signature
                        </div>
                      ) : isBlankBox ? (
                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={draftField.fieldType === "Text Input"}
                              onChange={() =>
                                updateDraft({ fieldType: "Text Input" })
                              }
                            />
                            Text Input
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={draftField.fieldType === "Text Area"}
                              onChange={() =>
                                updateDraft({ fieldType: "Text Area" })
                              }
                            />
                            Text Area
                          </label>
                        </div>
                      ) : (
                        <select
                          value={draftField.fieldType}
                          onChange={(e) =>
                            updateDraft({
                              fieldType: e.target.value as FieldTypeUI,
                            })
                          }
                          className="w-full h-9 px-3 border rounded text-sm bg-white"
                        >
                          {[
                            "Text Input",
                            "Text Area",
                            "Number",
                            "Email",
                            "Phone",
                            "Date",
                            "Checkbox",
                            "Signature",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="space-y-4">
                    {!hideExtraOptions ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Max Characters
                          </label>
                          <input
                            value={draftField.maxChars}
                            onChange={(e) =>
                              updateDraft({
                                maxChars:
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                              })
                            }
                            type="number"
                            min={1}
                            className="w-full h-9 px-3 border rounded text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Format
                          </label>
                          <select
                            value={draftField.format}
                            onChange={(e) =>
                              updateDraft({
                                format: e.target.value as FieldFormat,
                              })
                            }
                            className="w-full h-9 px-3 border rounded text-sm bg-white"
                          >
                            {["None", "Phone Number", "SSN"].map((t) => (
                              <option key={t} value={t as FieldFormat}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Populate with Data?
                          </label>
                          <div className="flex gap-2">
                            <ToggleBtn
                              active={draftField.populateWithData === "No"}
                              onClick={() =>
                                updateDraft({ populateWithData: "No" })
                              }
                              label="No"
                            />
                            <ToggleBtn
                              active={draftField.populateWithData === "Yes"}
                              onClick={() =>
                                updateDraft({ populateWithData: "Yes" })
                              }
                              label="Yes"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Data Flow back?
                          </label>
                          <div className="flex gap-2">
                            <ToggleBtn
                              active={draftField.dataFlowBack === "No"}
                              onClick={() =>
                                updateDraft({ dataFlowBack: "No" })
                              }
                              label="No"
                            />
                            <ToggleBtn
                              active={draftField.dataFlowBack === "Yes"}
                              onClick={() =>
                                updateDraft({ dataFlowBack: "Yes" })
                              }
                              label="Yes"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-gray-500">
                        {/* Extra options are not needed for this field. */}
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500">
                      {/* Size is controlled by drag-to-resize handle on the field
                      itself. */}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedId) removeField(selectedId);
                  }}
                  className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  Remove Field
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyDraftToState}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs border rounded ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
