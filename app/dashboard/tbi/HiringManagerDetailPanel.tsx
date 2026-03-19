"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

type TabId = "edit" | "audit";

type AuditEvent = {
  id: number | string;
  action: string;
  performed_at: string;
  performed_by_name?: string | null;
  details?: unknown;
};

type FieldDefinition = {
  id?: number | string;
  field_name?: string;
  field_key?: string;
  api_name?: string;
  field_label?: string;
  field_type?: string;
  options?: unknown;
  hidden?: boolean;
  is_hidden?: boolean;
  isHidden?: boolean;
  [key: string]: unknown;
};

type HiringManagerRecord = Record<string, unknown> & {
  id?: number | string;
  status?: string;
  custom_fields?: Record<string, unknown> | string | null;
};

type Props = {
  hiringManagerId: string;
  onClose: () => void;
  onSave?: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
};

const STANDARD_HM_KEYS = new Set([
  "first_name",
  "last_name",
  "full_name",
  "title",
  "email",
  "email2",
  "phone",
  "mobile_phone",
  "direct_line",
  "department",
  "reports_to",
  "owner",
  "secondary_owners",
  "linkedin_url",
  "status",
  "organization_id",
]);

function parseOptions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v ?? "").trim())
          .filter((v) => v.length > 0);
      }
    } catch {
      return raw
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
  }
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function toCustomFieldsMap(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export default function HiringManagerDetailPanel({
  hiringManagerId,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("edit");
  const [hiringManager, setHiringManager] = useState<HiringManagerRecord | null>(
    null,
  );
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const visibleFields = useMemo(
    () =>
      fieldDefinitions.filter(
        (f) => f.is_hidden !== true && f.hidden !== true && f.isHidden !== true,
      ),
    [fieldDefinitions],
  );

  const getFieldKey = useCallback((f: FieldDefinition): string => {
    return String(f.field_name ?? f.field_key ?? f.api_name ?? f.id ?? "");
  }, []);

  const getFieldLabel = useCallback((f: FieldDefinition): string => {
    return String(
      f.field_label ?? f.field_name ?? f.field_key ?? f.api_name ?? f.id ?? "",
    );
  }, []);

  const getRecordValue = useCallback(
    (record: HiringManagerRecord, field: FieldDefinition): string => {
      const key = getFieldKey(field);
      const label = getFieldLabel(field);
      const custom = toCustomFieldsMap(record.custom_fields);
      const direct = record[key];
      const camel = record[toCamelCase(key)];
      const byLabel = custom[label];
      const byKey = custom[key];
      const val =
        direct ?? camel ?? byLabel ?? byKey ?? (key === "status" ? record.status : "");
      if (val == null) return "";
      return String(val);
    },
    [getFieldKey, getFieldLabel],
  );

  const fetchHiringManager = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hiring-managers/${hiringManagerId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.hiringManager) {
        throw new Error(data?.message || "Failed to load hiring manager");
      }
      setHiringManager(data.hiringManager as HiringManagerRecord);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load hiring manager",
      );
      setHiringManager(null);
    } finally {
      setLoading(false);
    }
  }, [hiringManagerId]);

  const fetchFields = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/field-management/hiring-managers");
      const data = await response.json().catch(() => ({}));
      const fields =
        data.customFields ??
        data.fields ??
        data.data?.fields ??
        data.hiringManagerFields ??
        [];
      setFieldDefinitions(Array.isArray(fields) ? fields : []);
    } catch {
      setFieldDefinitions([]);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/hiring-managers/${hiringManagerId}/history`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to load history");
      }
      const data = await response.json().catch(() => ({}));
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load history",
      );
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [hiringManagerId]);

  useEffect(() => {
    fetchHiringManager();
    fetchFields();
    fetchHistory();
  }, [fetchHiringManager, fetchFields, fetchHistory]);

  useEffect(() => {
    if (!hiringManager || visibleFields.length === 0) return;
    const nextValues: Record<string, string> = {};
    for (const field of visibleFields) {
      nextValues[getFieldKey(field)] = getRecordValue(hiringManager, field);
    }
    setFormValues(nextValues);
  }, [hiringManager, visibleFields, getFieldKey, getRecordValue]);

  const handleSave = useCallback(async () => {
    if (!hiringManager) return;
    setSaving(true);
    try {
      const nextCustomFields = {
        ...toCustomFieldsMap(hiringManager.custom_fields),
      } as Record<string, unknown>;
      const payload: Record<string, unknown> = {};

      for (const field of visibleFields) {
        const key = getFieldKey(field);
        const label = getFieldLabel(field);
        const value = formValues[key] ?? "";
        if (STANDARD_HM_KEYS.has(key)) {
          payload[key] = value;
          if (key === "status") payload.status = value;
        } else {
          nextCustomFields[label] = value;
        }
      }

      payload.customFields = nextCustomFields;

      const response = await fetch(`/api/hiring-managers/${hiringManagerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save hiring manager");
      }
      onSave?.(payload);
      await fetchHiringManager();
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    hiringManager,
    visibleFields,
    getFieldKey,
    getFieldLabel,
    formValues,
    hiringManagerId,
    onSave,
    fetchHiringManager,
    fetchHistory,
  ]);

  const title =
    (hiringManager?.full_name as string) ||
    `${String(hiringManager?.first_name ?? "")} ${String(hiringManager?.last_name ?? "")}`.trim() ||
    `Hiring Manager ${hiringManagerId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-[#f4a037] text-white flex items-center justify-between px-6 py-4">
          <h2 className="text-xl font-semibold truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded border border-white/80 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="shrink-0 bg-[#b77728] flex">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`px-6 py-3 text-sm font-medium uppercase ${
              activeTab === "edit"
                ? "bg-[#9f6722] text-white border-b-2 border-white/80"
                : "text-white/90 hover:bg-[#9f6722]/70"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-6 py-3 text-sm font-medium uppercase ${
              activeTab === "audit"
                ? "bg-[#9f6722] text-white border-b-2 border-white/80"
                : "text-white/90 hover:bg-[#9f6722]/70"
            }`}
          >
            Audit Trail
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {error && <div className="px-6 pt-4 text-sm text-red-600">{error}</div>}

          {activeTab === "edit" && (
            <div className="px-6 py-6 space-y-4">
              {loading && (
                <div className="text-sm text-gray-500">Loading hiring manager...</div>
              )}
              {!loading && visibleFields.length === 0 && (
                <div className="text-sm text-gray-500">
                  No visible fields configured for Hiring Manager.
                </div>
              )}
              {!loading &&
                visibleFields.map((field) => {
                  const key = getFieldKey(field);
                  const label = getFieldLabel(field);
                  const type = String(field.field_type ?? "text").toLowerCase();
                  const options = parseOptions(field.options);
                  const value = formValues[key] ?? "";
                  const isLongText = type.includes("textarea");
                  const isSelect = type.includes("select") || options.length > 0;
                  const isDate = type.includes("date");

                  return (
                    <div key={key} className="flex items-start gap-4">
                      <label className="w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-2">
                        {label}
                      </label>
                      <div className="flex-1 border-b border-gray-300 pb-1">
                        {isSelect ? (
                          <select
                            value={value}
                            onChange={(e) =>
                              setFormValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-1"
                          >
                            <option value="">Select</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : isLongText ? (
                          <textarea
                            value={value}
                            onChange={(e) =>
                              setFormValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-1 resize-y"
                          />
                        ) : (
                          <input
                            type={isDate ? "date" : "text"}
                            value={value}
                            onChange={(e) =>
                              setFormValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-1"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

              <div className="flex justify-end gap-3 pt-6 pb-4">
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm uppercase rounded"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-medium text-sm uppercase rounded"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="px-6 py-6 space-y-4 text-sm">
              {historyLoading && (
                <div className="text-gray-500 text-center">Loading history...</div>
              )}
              {historyError && (
                <div className="text-red-600 text-center">{historyError}</div>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <div className="text-gray-500 text-center">
                  No history records available.
                </div>
              )}
              {!historyLoading &&
                !historyError &&
                history.map((event) => {
                  let detailsText: string | null = null;
                  if (
                    event.details &&
                    typeof event.details === "object" &&
                    "summary" in (event.details as Record<string, unknown>)
                  ) {
                    detailsText = String(
                      (event.details as Record<string, unknown>).summary,
                    );
                  }
                  return (
                    <div
                      key={event.id}
                      className="border rounded px-3 py-2 bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-medium text-blue-700">
                          {event.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {event.performed_at
                            ? new Date(event.performed_at).toLocaleString()
                            : "Unknown date"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        By: {event.performed_by_name || "Unknown"}
                      </div>
                      {detailsText && (
                        <div className="text-xs text-gray-700">{detailsText}</div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
