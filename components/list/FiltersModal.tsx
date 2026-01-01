"use client";

import React from "react";

type FilterField =
  | { key: string; label: string; type: "text" }
  | {
      key: string;
      label: string;
      type: "select";
      options: { label: string; value: string }[];
    }
  | { key: string; label: string; type: "date" };

export default function FiltersModal({
  open,
  onClose,
  fields,
  values,
  onChange,
  onApply,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  fields: FilterField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4">
        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
            <span className="text-2xl font-bold">×</span>
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {f.label}
              </label>

              {f.type === "text" && (
                <input
                  className="w-full px-3 py-2 border rounded text-sm"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}

              {f.type === "date" && (
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded text-sm"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}

              {f.type === "select" && (
                <select
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                >
                  <option value="">All</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button className="px-4 py-2 border rounded" onClick={onReset}>
            Reset
          </button>
          <button className="px-4 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
