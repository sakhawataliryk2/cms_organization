"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use CDN worker to avoid Next.js ESM bundling issues with pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type AvailableField = {
  id: number;
  entity_type: string;
  field_name: string;
  field_label: string;
  is_hidden?: boolean;
  field_type?: string;
};

type MappedFieldConfig = {
  concat_field_names?: string[];
  separator?: string;
};

type MappedField = {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  required: boolean;
  who_fills: "admin" | "job_seeker";
  is_auto_populated: boolean;
  source: "system" | "custom_field" | "external";
  x: number;
  y: number;
  page: number;
  w: number;
  h: number;
  config?: MappedFieldConfig;
};

const SYSTEM_FIELD_NAMES = new Set([
  "signature_box",
  "blank_box",
  "todays_date",
  "concat_box",
]);

function isConcatField(field: Pick<MappedField, "field_name" | "field_type">) {
  return (
    field.field_name === "concat_box" ||
    String(field.field_name || "").startsWith("concat_") ||
    field.field_type === "concat"
  );
}

function isTodaysDateField(field: Pick<MappedField, "field_name">) {
  return (
    field.field_name === "todays_date" ||
    String(field.field_name || "").startsWith("todays_date")
  );
}

function formatTodaysDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const year = today.getFullYear();
  return `${month}/${day}/${year}`;
}

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


  const extraFields: AvailableField[] = useMemo(
    () => [
      {
        id: -1001,
        entity_type: "system",
        field_name: "signature_box",
        field_label: "Signature Box",
        is_hidden: false,
        field_type: "e_signature",
      },
      {
        id: -1002,
        entity_type: "system",
        field_name: "blank_box",
        field_label: "Blank Box (Variable)",
        is_hidden: false,
        field_type: "text",
      },
      {
        id: -1003,
        entity_type: "system",
        field_name: "todays_date",
        field_label: "Today's Date",
        is_hidden: false,
        field_type: "text",
      },
      {
        id: -1004,
        entity_type: "system",
        field_name: "concat_box",
        field_label: "Concatenated Field (2 text fields)",
        is_hidden: false,
        field_type: "text",
      },
    ],
    []
  );

  /** Job-seeker text fields eligible as concat sources (max 2). */
  const concatSourceFields = useMemo(() => {
    return availableFields.filter((f) => {
      if (!f.field_name || SYSTEM_FIELD_NAMES.has(f.field_name)) return false;
      const t = String(f.field_type || "text").toLowerCase();
      return t === "text";
    });
  }, [availableFields]);

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

      const fields = (data.customFields || [])
        .filter((f: any) => f.is_hidden === false)
        .map((f: any) => ({
          ...f,
          field_type: f.field_type || "text",
        }));

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
        field_name: r.field_name,
        field_label: r.field_label || r.field_name,
        field_type: r.field_type || "text",
        required: !!r.required,
        who_fills: r.who_fills === "admin" ? "admin" : "job_seeker",
        is_auto_populated: !!r.is_auto_populated,
        source: (r.source as any) || "system",
        page: Number(r.page || 1),
        x: Number(r.x ?? 20),
        y: Number(r.y ?? 20),
        w: Number(r.w ?? 220),
        h: Number(r.h ?? 44),
        config:
          typeof r.config === "string"
            ? JSON.parse(r.config || "{}")
            : r.config || {},
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
    const next: MappedField = { ...f, config: { ...(f.config || {}) } };

    if (next.field_name === "signature_box") {
      next.field_type = "e_signature";
    }

    if (next.field_name === "blank_box") {
      if (next.field_type !== "textarea") next.field_type = "text";
    }

    if (isTodaysDateField(next)) {
      next.field_type = "text";
      next.is_auto_populated = true;
    }

    if (isConcatField(next)) {
      next.field_type = "text";
      next.is_auto_populated = true;
      const names = Array.isArray(next.config?.concat_field_names)
        ? next.config!.concat_field_names!.filter(Boolean).slice(0, 2)
        : [];
      next.config = {
        ...next.config,
        concat_field_names: names,
        separator:
          typeof next.config?.separator === "string"
            ? next.config.separator
            : " ",
      };
    }

    setDraftField(next);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDraftField(null);
  };

  const applyDraftToState = () => {
    if (!draftField) return;

    if (isConcatField(draftField)) {
      const names = (draftField.config?.concat_field_names || [])
        .filter(Boolean)
        .slice(0, 2);
      if (names.length !== 2) {
        toast.error("Select exactly 2 text fields to concatenate");
        return;
      }
      if (names[0] === names[1]) {
        toast.error("Choose two different text fields");
        return;
      }
      if (draftField.field_type !== "text") {
        toast.error("Concatenated field type must be text");
        return;
      }
    }

    const id = draftField.id;
    setMappedFields((prev) => prev.map((f) => (f.id === id ? draftField : f)));
    closeModal();
  };

  const updateDraft = (patch: Partial<MappedField>) => {
    setDraftField((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  const updateConcatSource = (index: 0 | 1, fieldName: string) => {
    setDraftField((cur) => {
      if (!cur) return cur;
      const current = [...(cur.config?.concat_field_names || [])];
      while (current.length < 2) current.push("");
      current[index] = fieldName;
      const selected = current.filter(Boolean).slice(0, 2);
      const labels = selected.map(
        (name) =>
          concatSourceFields.find((f) => f.field_name === name)?.field_label ||
          name
      );
      return {
        ...cur,
        field_type: "text",
        is_auto_populated: true,
        field_label:
          labels.length === 2
            ? `${labels[0]} + ${labels[1]}`
            : cur.field_label || "Concatenated Field",
        config: {
          ...(cur.config || {}),
          concat_field_names: selected,
          separator:
            typeof cur.config?.separator === "string"
              ? cur.config.separator
              : " ",
        },
      };
    });
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
    let field_type = "text";
    let field_name = src.field_name;
    let field_label = src.field_label || src.field_name;
    let is_auto_populated = false;
    let config: MappedFieldConfig = {};

    if (src.field_name === "signature_box") {
      field_type = "e_signature";
      w = 260;
      h = 80;
    } else if (src.field_name === "blank_box") {
      field_type = "text";
      w = 260;
      h = 44;
    } else if (src.field_name === "todays_date") {
      field_type = "text";
      is_auto_populated = true;
      field_label = "Today's Date";
      w = 160;
      h = 36;
    } else if (src.field_name === "concat_box") {
      field_type = "text";
      is_auto_populated = true;
      field_name = `concat_${crypto.randomUUID().slice(0, 8)}`;
      field_label = "Concatenated Field";
      config = { concat_field_names: [], separator: " " };
      w = 280;
      h = 44;
    }

    const newField: MappedField = {
      id: crypto.randomUUID(),
      field_name,
      field_label,
      field_type,
      required: false,
      who_fills: "job_seeker",
      is_auto_populated,
      source: src.entity_type === "system" ? "system" : "custom_field",
      page: page,
      x,
      y,
      w,
      h,
      config,
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
      const invalidConcat = mappedFields.find((f) => {
        if (!isConcatField(f)) return false;
        const names = (f.config?.concat_field_names || []).filter(Boolean);
        return names.length !== 2 || f.field_type !== "text";
      });
      if (invalidConcat) {
        toast.error(
          `Concatenated field "${invalidConcat.field_label}" must use field type text and exactly 2 text fields`
        );
        return;
      }

      setSaving(true);

      const payload = {
        fields: mappedFields.map((f, i) => ({
          field_id: null,
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          who_fills: f.who_fills,
          required: !!f.required,
          is_auto_populated: !!f.is_auto_populated,
          source: f.source,
          page: f.page || 1,
          sort_order: i,
          x: Math.round(f.x),
          y: Math.round(f.y),
          w: Math.round(f.w),
          h: Math.round(f.h),
          config: f.config || {},
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
                                {f.field_label}
                              </div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {f.field_name} • {f.field_type}
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
          className="fixed inset-0 z-999"
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
                  Edit Field: {draftField.field_label}
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
                        {draftField.field_label}
                      </div>
                      <div>{draftField.field_name}</div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Who Fills?
                      </label>
                      <div className="flex gap-2">
                        <ToggleBtn
                          active={draftField.who_fills === "job_seeker"}
                          onClick={() => updateDraft({ who_fills: "job_seeker" })}
                          label="Job Seeker"
                        />
                        <ToggleBtn
                          active={draftField.who_fills === "admin"}
                          onClick={() => updateDraft({ who_fills: "admin" })}
                          label="Admin"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Required?
                      </label>
                      <div className="flex gap-2">
                        <ToggleBtn
                          active={!draftField.required}
                          onClick={() => updateDraft({ required: false })}
                          label="No"
                        />
                        <ToggleBtn
                          active={!!draftField.required}
                          onClick={() => updateDraft({ required: true })}
                          label="Yes"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Auto Populated?
                      </label>
                      <div className="flex gap-2">
                        <ToggleBtn
                          active={!draftField.is_auto_populated}
                          onClick={() => updateDraft({ is_auto_populated: false })}
                          label="No"
                        />
                        <ToggleBtn
                          active={!!draftField.is_auto_populated}
                          onClick={() => updateDraft({ is_auto_populated: true })}
                          label="Yes"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Source
                      </label>
                      <select
                        value={draftField.source}
                        onChange={(e) =>
                          updateDraft({
                            source: e.target.value as any,
                          })
                        }
                        className="w-full h-9 px-3 border rounded text-sm bg-white"
                      >
                        <option value="system">System</option>
                        <option value="custom_field">Custom Field</option>
                        <option value="external">External</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Field Type
                      </label>
                      <select
                        value={draftField.field_type}
                        onChange={(e) =>
                          updateDraft({
                            field_type: e.target.value,
                          })
                        }
                        disabled={
                          isConcatField(draftField) ||
                          isTodaysDateField(draftField) ||
                          draftField.field_name === "signature_box"
                        }
                        className="w-full h-9 px-3 border rounded text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="text">Text Input</option>
                        <option value="textarea">Text Area</option>
                        <option value="e_signature">E-Signature</option>
                        <option value="optional_note">Optional Note</option>
                      </select>
                      {(isConcatField(draftField) ||
                        isTodaysDateField(draftField)) && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          This field type is locked to text.
                        </div>
                      )}
                    </div>

                    {isTodaysDateField(draftField) && (
                      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                        Auto-fills with today&apos;s date ({formatTodaysDate()}).
                      </div>
                    )}

                    {isConcatField(draftField) && (
                      <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-800">
                          Concatenate 2 text fields (max 2)
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Field 1
                          </label>
                          <select
                            value={draftField.config?.concat_field_names?.[0] || ""}
                            onChange={(e) =>
                              updateConcatSource(0, e.target.value)
                            }
                            className="w-full h-9 px-3 border rounded text-sm bg-white"
                          >
                            <option value="">Select text field…</option>
                            {concatSourceFields.map((f) => (
                              <option
                                key={`c1-${f.field_name}`}
                                value={f.field_name}
                                disabled={
                                  f.field_name ===
                                  draftField.config?.concat_field_names?.[1]
                                }
                              >
                                {f.field_label} ({f.field_name})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Field 2
                          </label>
                          <select
                            value={draftField.config?.concat_field_names?.[1] || ""}
                            onChange={(e) =>
                              updateConcatSource(1, e.target.value)
                            }
                            className="w-full h-9 px-3 border rounded text-sm bg-white"
                          >
                            <option value="">Select text field…</option>
                            {concatSourceFields.map((f) => (
                              <option
                                key={`c2-${f.field_name}`}
                                value={f.field_name}
                                disabled={
                                  f.field_name ===
                                  draftField.config?.concat_field_names?.[0]
                                }
                              >
                                {f.field_label} ({f.field_name})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Separator
                          </label>
                          <input
                            type="text"
                            value={
                              typeof draftField.config?.separator === "string"
                                ? draftField.config.separator
                                : " "
                            }
                            onChange={(e) =>
                              updateDraft({
                                config: {
                                  ...(draftField.config || {}),
                                  concat_field_names:
                                    draftField.config?.concat_field_names || [],
                                  separator: e.target.value,
                                },
                              })
                            }
                            className="w-full h-9 px-3 border rounded text-sm bg-white"
                            placeholder="Space"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT */}
                  <div className="space-y-4">
                    <div className="text-[11px] text-gray-500">
                      Page: {draftField.page}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Position: X={Math.round(draftField.x)}, Y={Math.round(draftField.y)}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Size: W={Math.round(draftField.w)}, H={Math.round(draftField.h)}
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
