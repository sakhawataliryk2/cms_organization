"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiPhone } from "react-icons/fi";
import { toast } from "sonner";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import { shouldShowClickToCallButton } from "@/lib/clickToCallPhoneField";
import {
  getLookupRegistryEntry,
  normalizeLookupType,
  type LookupRegistryEntry,
} from "@/lib/lookupEntityRegistry";

function getAuthHeaders(): HeadersInit {
  const token = document.cookie.replace(
    /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
    "$1"
  );
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function mergeCustomFieldsOnRecord(raw: Record<string, unknown>): Record<string, unknown> {
  let customFieldsObj: Record<string, unknown> = {};
  const existing = raw.customFields;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    customFieldsObj = { ...(existing as Record<string, unknown>) };
  }
  const cf = raw.custom_fields;
  if (cf != null) {
    try {
      const parsed =
        typeof cf === "string" ? (JSON.parse(cf) as unknown) : cf;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        customFieldsObj = { ...customFieldsObj, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      /* keep merged */
    }
  }
  return { ...raw, customFields: customFieldsObj };
}

function isValidNumericId(id: string | number | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  const s = String(id).trim();
  if (!s) return false;
  return /^\d+$/.test(s);
}

/** Panel configs use `custom:Field_N`; field defs use bare `field_name`. */
function bareFieldKey(key: string): string {
  return key.startsWith("custom:") ? key.slice("custom:".length) : key;
}

function stableFieldNameFromDef(f: Record<string, unknown>): string {
  return String(f.field_name ?? f.field_key ?? f.api_name ?? f.id ?? "");
}

function toZoomE164(rawNumber: string): string | null {
  const digitsOnly = String(rawNumber).replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length > 10 && !digitsOnly.startsWith("0")) return `+${digitsOnly}`;
  return digitsOnly;
}

function clickToCallEndpoint(lookupType: string): { url: string; idKey: string } | null {
  const n = normalizeLookupType(lookupType);
  if (n === "organizations" || n === "organization") {
    return { url: "/api/organizations/calls/start", idKey: "organizationId" };
  }
  if (n === "hiring-managers" || n === "hiringmanagers" || n === "hiring-manager") {
    return { url: "/api/hiring-managers/calls/start", idKey: "hiringManagerId" };
  }
  if (n === "job-seekers" || n === "jobseekers" || n === "job-seeker") {
    return { url: "/api/calls/start", idKey: "jobSeekerId" };
  }
  return null;
}

async function startLookupClickToCall(
  lookupType: string,
  recordId: string | number,
  phoneNumber: string,
  fieldName?: string,
) {
  const endpoint = clickToCallEndpoint(lookupType);
  if (!endpoint) {
    toast.error("Click-to-call is not available for this record type");
    return;
  }
  const normalized = toZoomE164(phoneNumber);
  if (!normalized) {
    toast.error("Phone number format is invalid for Zoom Phone");
    return;
  }

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [endpoint.idKey]: recordId,
        phoneNumber: normalized,
        fieldName: fieldName || null,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.message || "Failed to start Zoom call");
      return;
    }
    const dialUrl = data?.dialUrl;
    if (dialUrl && typeof window !== "undefined") {
      window.location.href = dialUrl;
      toast.success("Opening Zoom Phone...");
      return;
    }
    toast.error("No dial URL received. Please try again.");
  } catch (error) {
    console.error("Error starting Zoom Phone call:", error);
    toast.error("Unable to start Zoom call. Please try again.");
  }
}

export interface LookupEntityDetailsGridProps {
  lookupType: string;
  recordId: string | number | null | undefined;
  visibleKeys: string[];
  emptyPlaceholder?: string;
  className?: string;
}

export default function LookupEntityDetailsGrid({
  lookupType,
  recordId,
  visibleKeys,
  emptyPlaceholder = "-",
  className = "",
}: LookupEntityDetailsGridProps) {
  const normalizedType = useMemo(() => normalizeLookupType(lookupType), [lookupType]);
  const entry: LookupRegistryEntry | null = useMemo(
    () => getLookupRegistryEntry(lookupType),
    [lookupType]
  );

  const [fieldDefs, setFieldDefs] = useState<any[]>([]);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validId = isValidNumericId(recordId ?? null);

  useEffect(() => {
    if (!entry || !entry.supportsDetailsGrid || !validId) {
      setFieldDefs([]);
      setRecord(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const id = String(recordId).trim();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [defsRes, recordRes] = await Promise.all([
          fetch(`/api/admin/field-management/${entry?.fieldManagementEntityType}`, {
            headers: getAuthHeaders(),
          }),
          fetch(entry?.getByIdUrl(id) ?? "", { headers: getAuthHeaders() }),
        ]);

        const defsData = await defsRes.json().catch(() => ({}));
        const recordData = await recordRes.json().catch(() => ({}));

        if (cancelled) return;

        if (!defsRes.ok) {
          setError(String(defsData?.message || "Failed to load field definitions"));
          setFieldDefs([]);
          setRecord(null);
          return;
        }

        if (!recordRes.ok) {
          setError(String(recordData?.message || "Failed to load record"));
          setFieldDefs([]);
          setRecord(null);
          return;
        }

        const rawFields =
          defsData.customFields ||
          defsData.fields ||
          defsData.data?.fields ||
          defsData.data?.customFields ||
          [];
        const defs = Array.isArray(rawFields) ? rawFields : [];

        const extracted = entry?.extractRecord?.(recordData);
        if (!extracted) {
          setError("Record not found");
          setFieldDefs([]);
          setRecord(null);
          return;
        }

        setFieldDefs(defs);
        setRecord(mergeCustomFieldsOnRecord(extracted));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
          setFieldDefs([]);
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [entry, recordId, validId]);

  const visibleFieldDefs = useMemo(() => {
    return (fieldDefs || []).filter((f: any) => {
      const hidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !hidden;
    });
  }, [fieldDefs]);

  const catalogByKey = useMemo(() => {
    const m = new Map<string, { key: string; label: string }>();
    for (const f of visibleFieldDefs) {
      const bareKey = stableFieldNameFromDef(f);
      if (!bareKey) continue;
      const entry = {
        key: bareKey,
        label: String(f.field_label || f.field_name || f.field_key || bareKey),
      };
      m.set(bareKey, entry);
      m.set(`custom:${bareKey}`, entry);
    }
    return m;
  }, [visibleFieldDefs]);

  if (!entry) {
    return (
      <div className={`p-4 text-sm text-amber-800 bg-amber-50 rounded ${className}`}>
        Unknown lookup type: {lookupType} (normalized: {normalizedType})
      </div>
    );
  }

  if (!entry.supportsDetailsGrid) {
    return (
      <div className={`p-4 text-sm text-gray-600 ${className}`}>
        Related record details are not available for lookup type &quot;{lookupType}&quot;.
      </div>
    );
  }

  if (!validId) {
    return (
      <div className={`p-4 text-sm text-gray-500 italic ${className}`}>
        No related record selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-4 text-gray-500 text-sm ${className}`}>Loading details…</div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-sm text-red-600 ${className}`}>{error}</div>
    );
  }

  if (!record) {
    return (
      <div className={`p-4 text-sm text-gray-500 italic ${className}`}>
        No data.
      </div>
    );
  }

  const keys = Array.from(new Set(visibleKeys || []));
  const resolver = entry.resolveValue ?? ((_o, _k, _d, _l) => "-");

  return (
    <div className={`space-y-0 border border-gray-200 rounded ${className}`}>
      {keys.map((rowKey) => {
        const fieldKey = bareFieldKey(rowKey);
        const cat = catalogByKey.get(rowKey) ?? catalogByKey.get(fieldKey);
        const def = visibleFieldDefs.find((f: any) => {
          const stable = stableFieldNameFromDef(f);
          return stable === fieldKey || `custom:${stable}` === rowKey;
        });
        const label = String(
          def?.field_label || def?.fieldLabel || cat?.label || fieldKey,
        );
        const value = resolver(record, fieldKey, def, label);
        const fieldInfo = {
          key: fieldKey,
          label,
          name: def?.field_name ?? fieldKey,
          fieldType: def?.field_type ?? def?.fieldType,
          lookupType: def?.lookup_type ?? def?.lookupType,
          multiSelectLookupType:
            def?.multi_select_lookup_type ?? def?.multiSelectLookupType,
        };
        const showCallButton = shouldShowClickToCallButton(value, {
          label,
          key: fieldKey,
          fieldName: fieldInfo.name,
          fieldType: fieldInfo.fieldType,
        });
        return (
          <div
            key={rowKey}
            className="flex border-b border-gray-200 last:border-b-0"
          >
            <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">
              {label}:
            </div>
            <div className="flex-1 p-2 text-sm flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <FieldValueRenderer
                  value={value}
                  fieldInfo={fieldInfo}
                  allFields={visibleFieldDefs as any}
                  valuesRecord={record as any}
                  emptyPlaceholder={emptyPlaceholder}
                  clickable
                  entityType={lookupType}
                  recordId={recordId as string | number | undefined}
                />
              </div>
              {showCallButton && (
                <button
                  type="button"
                  onClick={() =>
                    startLookupClickToCall(
                      lookupType,
                      recordId as string | number,
                      value,
                      String(fieldInfo.name || ""),
                    )
                  }
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 shrink-0"
                  title="Call via Zoom Phone"
                >
                  <FiPhone className="mr-1 h-3 w-3" />
                  Call
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
