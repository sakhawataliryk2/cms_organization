"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

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
  | "Signature";

type FieldFormat = "None" | "Phone Number" | "SSN";

type MappedField = {
  id: string;
  source_field_name: string;
  source_field_label: string;

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

function mapDbTypeToUi(t: any): FieldTypeUI {
  const v = String(t || "").toLowerCase();
  if (v === "text_area") return "Text Area";
  if (v === "number") return "Number";
  if (v === "email") return "Email";
  if (v === "phone") return "Phone";
  if (v === "date") return "Date";
  if (v === "checkbox") return "Checkbox";
  if (v === "signature") return "Signature";
  return "Text Input";
}

function mapUiTypeToDb(t: FieldTypeUI) {
  switch (t) {
    case "Text Area":
      return "text_area";
    case "Number":
      return "number";
    case "Email":
      return "email";
    case "Phone":
      return "phone";
    case "Date":
      return "date";
    case "Checkbox":
      return "checkbox";
    case "Signature":
      return "signature";
    default:
      return "text_input";
  }
}

function mapDbFormatToUi(f: any): FieldFormat {
  const v = String(f || "").toLowerCase();
  if (v === "phone_number") return "Phone Number";
  if (v === "ssn") return "SSN";
  return "None";
}

function mapUiFormatToDb(f: FieldFormat) {
  if (f === "Phone Number") return "phone_number";
  if (f === "SSN") return "ssn";
  return "none";
}

export default function TemplateDocEditorPage() {
  const params = useParams();
  const docId = String(params?.id || "");

  // LEFT
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");

  // CANVAS
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [mappedFields, setMappedFields] = useState<MappedField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // UI
  const [saving, setSaving] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);

  const selectedField = useMemo(
    () => mappedFields.find((f) => f.id === selectedId) || null,
    [mappedFields, selectedId]
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

const fetchMappings = async () => {
  try {
    const res = await fetch(`/api/template-documents/${docId}/mappings`, {
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok || !data?.success) return;

    const rows = data.fields || [];

    const mapped: MappedField[] = rows.map((r: any) => ({
      id: String(r.client_id || r.id || crypto.randomUUID()),
      source_field_name: r.field_name,
      source_field_label: r.field_label,

      x: Number(r.x ?? 20),
      y: Number(r.y ?? 20),
      w: Number(r.w ?? 220),
      h: Number(r.h ?? 44),

      whoFills: r.who_fills === "Admin" ? "Admin" : "Candidate",
      required: r.required === true || r.required === "Yes" ? "Yes" : "No",
      fieldType: r.field_type_ui || "Text Input",
      maxChars: r.max_chars ?? 255,
      format: r.format_ui || "None",
      populateWithData: r.populate_with_data ? "Yes" : "No",
      dataFlowBack: r.data_flow_back ? "Yes" : "No",
    }));

    setMappedFields(mapped);
  } catch (e) {
    console.error(e);
  }
};
useEffect(() => {
  fetchAvailableFields();

  (async () => {
    try {
      const res = await fetch(`/api/template-documents/${docId}/mappings`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.fields)) {
        const loaded = data.fields.map((r: any) => ({
          id: crypto.randomUUID(),
          source_field_name: r.field_name,
          source_field_label: r.field_label || r.field_name,
          x: Number(r.x ?? 0),
          y: Number(r.y ?? 0),
          w: Number(r.w ?? 220),
          h: Number(r.h ?? 44),
          whoFills: r.who_fills === "Admin" ? "Admin" : "Candidate",
          required: r.is_required ? "Yes" : "No",
          fieldType: r.field_type || "Text Input",
          maxChars: r.max_characters ?? 255,
          format: r.format || "None",
          populateWithData: r.populate_with_data ? "Yes" : "No",
          dataFlowBack: r.data_flow_back ? "Yes" : "No",
        }));

        setMappedFields(loaded);
      }
    } catch {}
  })();
}, [docId]);

  const filteredAvailableFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return availableFields;
    return availableFields.filter((f) =>
      (f.field_label || f.field_name || "").toLowerCase().includes(q)
    );
  }, [availableFields, fieldSearch]);

  const onDragStartField = (e: React.DragEvent, field: AvailableField) => {
    e.dataTransfer.setData("application/x-field", JSON.stringify(field));
    e.dataTransfer.effectAllowed = "copy";
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

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(10, e.clientX - rect.left);
    const y = Math.max(10, e.clientY - rect.top);

    const newField: MappedField = {
      id: crypto.randomUUID(),
      source_field_name: src.field_name,
      source_field_label: src.field_label || src.field_name,
      x,
      y,
      w: 220,
      h: 44,

      whoFills: "Candidate",
      required: "No",
      fieldType: "Text Input",
      maxChars: 255,
      format: "None",
      populateWithData: "No",
      dataFlowBack: "No",
    };

    setMappedFields((p) => [...p, newField]);
    setSelectedId(newField.id);
  };

  const onDragOverCanvas = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const startDrag = (id: string, startX: number, startY: number) => {
    const target = mappedFields.find((f) => f.id === id);
    if (!target) return;

    const originX = target.x;
    const originY = target.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setMappedFields((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                x: Math.max(0, originX + dx),
                y: Math.max(0, originY + dy),
              }
            : f
        )
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const updateSelected = (patch: Partial<MappedField>) => {
    if (!selectedId) return;
    setMappedFields((prev) =>
      prev.map((f) => (f.id === selectedId ? { ...f, ...patch } : f))
    );
  };

  const removeField = (id: string) => {
    setMappedFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
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
        max_characters: f.maxChars === "" ? 255 : Number(f.maxChars),
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

    alert("Saved");
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">
          Template Document Editor{" "}
          <span className="text-gray-500">Doc ID: {docId}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveMapping}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Fields</div>
              <button
                onClick={fetchAvailableFields}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                disabled={isLoadingFields}
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

        <div className="col-span-6">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-600">
                Drag fields here to map them (blank editor canvas)
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
              className="relative w-full h-[70vh] bg-gray-50 border-2 border-dashed border-gray-300 rounded overflow-hidden"
              onMouseDown={() => setSelectedId(null)}
            >
              {mappedFields.map((f) => {
                const selected = f.id === selectedId;

                return (
                  <div
                    key={f.id}
                    className={`absolute bg-white border rounded shadow-sm ${
                      selected
                        ? "border-blue-600 ring-2 ring-blue-200"
                        : "border-gray-300"
                    }`}
                    style={{ left: f.x, top: f.y, width: f.w, height: f.h }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(f.id);
                      startDrag(f.id, e.clientX, e.clientY);
                    }}
                  >
                    <div className="h-full px-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold truncate">
                        {f.source_field_label}
                      </div>
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
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-gray-500 mt-2">
              Tip: click a mapped field to edit settings on the right.
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
            <div className="text-sm font-semibold mb-2">Field Settings</div>

            {!selectedField ? (
              <div className="text-xs text-gray-600">
                Select a placed field to edit
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-500">
                  <div className="font-semibold text-gray-800">
                    {selectedField.source_field_label}
                  </div>
                  <div>{selectedField.source_field_name}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Who will fill field
                  </label>
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selectedField.whoFills === "Admin"}
                        onChange={() => updateSelected({ whoFills: "Admin" })}
                      />
                      Admin
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selectedField.whoFills === "Candidate"}
                        onChange={() =>
                          updateSelected({ whoFills: "Candidate" })
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
                      active={selectedField.required === "No"}
                      onClick={() => updateSelected({ required: "No" })}
                      label="No"
                    />
                    <ToggleBtn
                      active={selectedField.required === "Yes"}
                      onClick={() => updateSelected({ required: "Yes" })}
                      label="Yes"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={selectedField.fieldType}
                    onChange={(e) =>
                      updateSelected({
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Characters
                  </label>
                  <input
                    value={selectedField.maxChars}
                    onChange={(e) =>
                      updateSelected({
                        maxChars:
                          e.target.value === "" ? "" : Number(e.target.value),
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
                    value={selectedField.format}
                    onChange={(e) =>
                      updateSelected({ format: e.target.value as FieldFormat })
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
                      active={selectedField.populateWithData === "No"}
                      onClick={() => updateSelected({ populateWithData: "No" })}
                      label="No"
                    />
                    <ToggleBtn
                      active={selectedField.populateWithData === "Yes"}
                      onClick={() =>
                        updateSelected({ populateWithData: "Yes" })
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
                      active={selectedField.dataFlowBack === "No"}
                      onClick={() => updateSelected({ dataFlowBack: "No" })}
                      label="No"
                    />
                    <ToggleBtn
                      active={selectedField.dataFlowBack === "Yes"}
                      onClick={() => updateSelected({ dataFlowBack: "Yes" })}
                      label="Yes"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <button
                    onClick={() => removeField(selectedField.id)}
                    className="w-full px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  >
                    Remove Field
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
