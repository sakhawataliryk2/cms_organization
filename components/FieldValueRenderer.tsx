"use client";

import React, { useState, useCallback, useEffect } from "react";
import RecordNameResolver from "@/components/RecordNameResolver";
import { CheckIcon, FileText } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import DescriptionModal from "@/components/DescriptionModal";
import { toast } from "sonner";
import { CopyrightIcon } from "lucide-react";
import {
  getEntityCustomFieldsPatchPath,
  getEntityUpdatePutPath,
  getMappedStatusFieldName,
} from "@/lib/entitySummaryFieldMaps";
import { ADDRESS_FIELD_NAMES } from "@/components/AddressGroupRenderer";

/** Placeholder when value is empty or N/A */
const DEFAULT_EMPTY = "—";

/** US phone pattern: (XXX) XXX-XXXX e.g. (112) 287-3112 */
const PHONE_PATTERN = /^\(\d{3}\)\s*\d{3}-\d{4}$/;

/** Matches common date formats so we don't treat them as phones (YYYY-MM-DD, MM/DD/YYYY, etc.) */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;

function extractFieldManagementFields(data: Record<string, unknown> | null): unknown[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const nested = d.data as Record<string, unknown> | undefined;
  const deep = nested && typeof nested === "object"
    ? (nested.data as Record<string, unknown> | undefined)
    : undefined;
  const candidates = [
    d.customFields,
    d.fields,
    nested?.customFields,
    nested?.fields,
    deep?.fields,
    d.organizationFields,
    d.hiringManagerFields,
    d.jobSeekerFields,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/** Parse admin field definition `options` into display strings for status select */
function parseStatusOptionsFromDefinition(options: unknown): string[] {
  if (options == null) return [];
  if (typeof options === "string") {
    try {
      return parseStatusOptionsFromDefinition(JSON.parse(options));
    } catch {
      return options
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  if (Array.isArray(options)) {
    return options
      .filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0)
      .map((opt) => opt.trim());
  }
  if (typeof options === "object") {
    return Object.values(options as Record<string, unknown>)
      .filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0)
      .map((opt) => opt.trim());
  }
  return [];
}

export interface FieldInfo {
  fieldType?: string;
  lookupType?: string;
  multiSelectLookupType?: string;
  label?: string;
  key?: string;
  name?: string;
}

export interface FieldValueRendererProps {
  value: string | number | null | undefined;
  fieldInfo?: FieldInfo | null;
  emptyPlaceholder?: string;
  clickable?: boolean;
  className?: string;
  stopPropagation?: boolean;
  statusVariant?: "default" | "archived" | "deletion" | "blue" | "gray";
  forceRenderAsStatus?: boolean;
  lookupFallback?: string;
  /** Optional: all custom fields for this record (used for Full Address fallback) */
  allFields?: Array<{ field_label?: string; field_name?: string } & Record<string, any>>;
  /** Optional: full values record for this entity (used for Full Address fallback) */
  valuesRecord?: Record<string, any>;
  /** Show relative time for dates (e.g. "3 days ago") */
  showRelativeDate?: boolean;
  /** Enable click-to-copy for phone and email */
  enableCopy?: boolean;
  /** Show domain badge for email (e.g. gmail.com) */
  showEmailDomain?: boolean;
  /** When true and value is empty, show placeholder in red with warning icon */
  required?: boolean;
  /** Entity type for context-specific rendering (e.g. 'job', 'hiring-managers') */
  entityType?: string;
  /** Record id for mapped status PUT (see statusMappings; field defs + options fetched inside this component) */
  recordId?: string | number;
}

function formatToMMDDYYYY(value: string): string {
  if (!value) return value;

  const date = new Date(value);

  if (isNaN(date.getTime())) return value; // fallback if invalid

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/** Returns relative string: "X days ago" or "In X days", or null if invalid */
function getRelativeDateString(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0 && diffDays > -365) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > 0 && diffDays < 365) return `In ${diffDays} days`;
  if (diffDays <= -365) return `${Math.abs(Math.floor(diffDays / 365))} year(s) ago`;
  if (diffDays >= 365) return `In ${Math.floor(diffDays / 365)} year(s)`;
  return null;
}

/** Format percentage: ensure single % suffix */
function formatPercentage(value: string): string {
  const cleaned = String(value).trim().replace(/%/g, "");
  if (cleaned === "" || isNaN(Number(cleaned))) return value;
  return `${cleaned}%`;
}

/** Extract domain from email (e.g. john@gmail.com -> gmail.com) */
function extractEmailDomain(email: string): string {
  const at = email.indexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

/** Parse numeric value from string (strips $ and commas) */
function parseNumericValue(value: string | number): number | null {
  if (typeof value === "number" && !isNaN(value)) return value;
  const s = String(value).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Checks if field is a date
function isDateFieldOrValue(label?: string, key?: string, value?: string): boolean {
  const l = (label ?? "").toLowerCase();
  const k = (key ?? "").toLowerCase();
  const hasDateInName = l.includes("date") || k.includes("date");
  const looksLikeDate = value != null && DATE_PATTERN.test(String(value).trim());
  return hasDateInName || looksLikeDate;
}

// Checks if field is Full Address
const isAddressField = (label?: string): boolean => {
  const normalize = (value?: string): string =>
    (value ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isCloseMatch = (word: string, target: string): boolean => {
    if (word === target) return true;
    if (Math.abs(word.length - target.length) > 1) return false;

    let mismatches = 0;
    for (let i = 0; i < Math.min(word.length, target.length); i++) {
      if (word[i] !== target[i]) mismatches++;
      if (mismatches > 1) return false;
    }

    return true;
  };

  const l = normalize(label);
  const words = l.split(" ").filter(Boolean);

  const hasFull = words.some(w => isCloseMatch(w, "full"));
  const hasAddress = words.some(w => isCloseMatch(w, "address"));

  return hasFull && hasAddress;
};

/** Copy icon (inline SVG) */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Warning icon (inline SVG) */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function FieldValueRenderer({
  value,
  fieldInfo,
  emptyPlaceholder = DEFAULT_EMPTY,
  clickable = true,
  className = "",
  stopPropagation = false,
  statusVariant = "default",
  forceRenderAsStatus = false,
  lookupFallback,
  allFields,
  valuesRecord,
  showRelativeDate = false,
  enableCopy = true,
  showEmailDomain = false,
  required = false,
  entityType,
  recordId,
}: FieldValueRendererProps) {
  const [copied, setCopied] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDefOptions, setStatusDefOptions] = useState<string[]>([]);
  const [statusStorageLabelResolved, setStatusStorageLabelResolved] = useState("");
  const [statusDefLoading, setStatusDefLoading] = useState(false);
  const [localStatusOverride, setLocalStatusOverride] = useState<string | null>(null);

  const fieldType = (fieldInfo?.fieldType ?? "").toLowerCase();
  const label = (fieldInfo?.label || "").toLowerCase();
  const fieldKey = (fieldInfo?.key || "").toLowerCase();
  let fieldName = (fieldInfo?.name || "").toLowerCase();

  // If fieldName is missing, try to extract it from the key (e.g., custom:Label:Name)
  if (!fieldName && fieldKey.startsWith("custom:")) {
    const parts = fieldKey.split(":");
    if (parts.length >= 3) {
      fieldName = parts[2].toLowerCase();
    } else if (parts.length === 2) {
      fieldName = parts[1].toLowerCase();
    }
  } else if (!fieldName) {
    fieldName = fieldKey;
  }

  const rawOriginal = value != null && value !== "" ? String(value).trim() : "";

  const mappedStatusName = getMappedStatusFieldName(entityType);
  const definitionFieldName = (fieldInfo?.name || fieldInfo?.key || "").trim();
  const matchesMappedStatus =
    Boolean(mappedStatusName) &&
    definitionFieldName.length > 0 &&
    definitionFieldName.toLowerCase() === mappedStatusName.toLowerCase();
  const customFieldsPatchPath =
    entityType && recordId != null && String(recordId) !== ""
      ? getEntityCustomFieldsPatchPath(entityType, recordId)
      : null;
  const legacyPutPath =
    entityType && recordId != null && String(recordId) !== ""
      ? getEntityUpdatePutPath(entityType, recordId)
      : null;
  const statusUpdateUrl = customFieldsPatchPath ?? legacyPutPath;
  const statusUpdateMethod = customFieldsPatchPath ? "PATCH" : "PUT";

  useEffect(() => {
    if (!matchesMappedStatus || !entityType || !mappedStatusName) {
      setStatusDefOptions([]);
      setStatusStorageLabelResolved("");
      setStatusDefLoading(false);
      return;
    }

    const ac = new AbortController();
    setStatusDefLoading(true);

    (async () => {
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );
        const res = await fetch(
          `/api/admin/field-management/${encodeURIComponent(entityType)}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: ac.signal,
          }
        );
        const text = await res.text();
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(text) as Record<string, unknown>;
        } catch {
          /* keep {} */
        }
        const fields = extractFieldManagementFields(data);
        const def = fields.find(
          (f) =>
            typeof f === "object" &&
            f !== null &&
            String((f as { field_name?: string }).field_name || "").toLowerCase() ===
            mappedStatusName.toLowerCase()
        ) as { field_label?: string; field_name?: string; options?: unknown } | undefined;

        const storageLabel = String(def?.field_label ?? def?.field_name ?? "").trim();
        const options = parseStatusOptionsFromDefinition(def?.options);

        if (!ac.signal.aborted) {
          setStatusStorageLabelResolved(storageLabel);
          setStatusDefOptions(options);
        }
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        if (!ac.signal.aborted) {
          setStatusStorageLabelResolved("");
          setStatusDefOptions([]);
        }
      } finally {
        if (!ac.signal.aborted) setStatusDefLoading(false);
      }
    })();

    return () => ac.abort();
  }, [matchesMappedStatus, entityType, mappedStatusName]);

  useEffect(() => {
    setLocalStatusOverride(null);
  }, [rawOriginal]);

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const handleCopy = useCallback((text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  }, []);

  let raw = rawOriginal;

  // Handle Field_6 (Job Description) - ONLY for job entity
  if (fieldName === "field_6" && entityType === "job") {
    return (
      <>
        <Tooltip text="Click to view description">
          <button
            type="button"
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              setIsDescriptionModalOpen(true);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-blue-600"
          >
            <FileText className="w-5 h-5" />
          </button>
        </Tooltip>
        <DescriptionModal
          isOpen={isDescriptionModalOpen}
          onClose={() => setIsDescriptionModalOpen(false)}
          content={rawOriginal}
          title={fieldInfo?.label || "Job Description"}
        />
      </>
    );
  }

  // Full Address fallback: if this is a Full Address field but its own value is empty/placeholder,
  // try to auto-combine Address, Address 2, City, State, Zip from the full values record.
  let autoCombinedAddress: string | null = null;

  // We intentionally use the original (non-lowercased) label so the matcher can normalize itself.
  const originalLabel = fieldInfo?.label;

  if (
    isAddressField(originalLabel) &&
    (rawOriginal === "" ||
      rawOriginal === "-" ||
      rawOriginal === "N/A" ||
      rawOriginal === emptyPlaceholder)
  ) {
    if (Array.isArray(allFields) && valuesRecord && typeof valuesRecord === "object") {
      const normalize = (s: string) => (s || "").toLowerCase().trim();

      // Find identifying mapping for the entity
      const mapping = ADDRESS_FIELD_NAMES.find(m => m.entity_type === entityType);

      const findAddressField = (labels: string[], mappedNames?: string[]) => {
        // First try the mapped Field_X names if we have a mapping
        if (mappedNames?.length) {
          const found = allFields.find(f => mappedNames.includes(f.field_name || ""));
          if (found) return found;
        }
        // Fallback to labels
        return allFields.find((f) => labels.some((l) => normalize(f.field_label || "") === normalize(l)));
      };

      const addressField = findAddressField(["address", "address1"], mapping?.address);
      const address2Field = findAddressField(["address2", "address 2"], mapping?.address2);
      const cityField = findAddressField(["city"], mapping?.city);
      const stateField = findAddressField(["state"], mapping?.state);
      const zipField = findAddressField(["zip", "zip code", "postal code"], mapping?.zip);

      const getVal = (fld?: { field_name?: string; field_label?: string }) => {
        if (!fld) return "";
        const nameKey = fld.field_name;
        const labelKey = fld.field_label;

        // Try access by nameKey first (Field_X)
        if (nameKey && valuesRecord[nameKey] !== undefined) {
          return String(valuesRecord[nameKey] ?? "").trim();
        }
        // Fallback to label
        if (labelKey && valuesRecord[labelKey] !== undefined) {
          return String(valuesRecord[labelKey] ?? "").trim();
        }
        return "";
      };

      const address = getVal(addressField);
      const address2 = getVal(address2Field);
      const city = getVal(cityField);
      const state = getVal(stateField);
      const zip = getVal(zipField);

      const cityState = [city, state].filter(Boolean).join(", ");
      const combinedParts = [address, address2, cityState, zip].filter(Boolean);
      const combined = combinedParts.join(", ");

      if (combined) {
        autoCombinedAddress = combined;
        raw = combined;
      }
    }
  }

  // Mapped status: fetch defs + select; save via unified PATCH custom-fields or legacy PUT
  if (matchesMappedStatus && statusUpdateUrl) {
    if (statusDefLoading) {
      return (
        <span
          className={`inline-flex items-center gap-2 text-sm text-gray-500 ${className}`}
        >
          <span
            className="inline-block h-3.5 w-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
            aria-hidden
          />
          Loading…
        </span>
      );
    }

    if (
      statusStorageLabelResolved &&
      Array.isArray(statusDefOptions) &&
      statusDefOptions.length > 0
    ) {
      const effectiveRaw = localStatusOverride ?? raw;
      const normalizedDisplay =
        effectiveRaw &&
          effectiveRaw !== emptyPlaceholder &&
          effectiveRaw !== "-" &&
          effectiveRaw !== "N/A" &&
          statusDefOptions.includes(effectiveRaw)
          ? effectiveRaw
          : statusDefOptions[0] || "";

      const saveStatus = async (next: string) => {
        setStatusSaving(true);
        try {
          const token = document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          );
          const res = await fetch(statusUpdateUrl, {
            method: statusUpdateMethod,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              customFields: { [statusStorageLabelResolved]: next },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              (data as { message?: string })?.message || "Failed to update status"
            );
          }
          setLocalStatusOverride(next);
          toast.success("Updated");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Update failed");
        } finally {
          setStatusSaving(false);
        }
      };

      return (
        <select
          value={normalizedDisplay}
          disabled={statusSaving}
          onChange={(e) => saveStatus(e.target.value)}
          className={`border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
        >
          {statusDefOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
  }

  const isEmpty = raw === "";
  const str = isEmpty ? emptyPlaceholder : raw;

  const isStatus =
    forceRenderAsStatus ||
    fieldType === "status" ||
    (label === "status" && !matchesMappedStatus);

  // Required field empty: red placeholder + warning icon
  if (isEmpty) {
    if (required) {
      return (
        <span className={`text-red-600 ${className}`} title="Required field">
          {str}
          <WarningIcon className="inline-block ml-1 align-middle text-red-500" aria-hidden />
        </span>
      );
    }
    return <span className={className}>{str}</span>;
  }

  // Lookup fields
  const isLookup = fieldType === "lookup" || fieldType === "multiselect_lookup";
  if (isLookup) {
    const lookupType = fieldInfo?.lookupType || fieldInfo?.multiSelectLookupType;
    const fallback = lookupFallback != null && lookupFallback !== "" ? lookupFallback : str;
    const showLookupWarning = Boolean(lookupFallback);
    return (
      <span onClick={handleClick} className={`inline-flex items-center gap-1 ${className}`}>
        <RecordNameResolver
          id={raw || null}
          type={lookupType || ""}
          clickable
          fallback={fallback}
        />
        {showLookupWarning && (
          <span title="Lookup fallback used" aria-label="Lookup may be missing">
            <WarningIcon className="shrink-0 text-amber-500" />
          </span>
        )}
      </span>
    );
  }

  // Status: badge
  if (isStatus) {
    const statusClass =
      statusVariant === "deletion"
        ? "bg-red-100 text-red-800"
        : statusVariant === "archived"
          ? "bg-amber-100 text-amber-800"
          : statusVariant === "blue"
            ? "bg-blue-100 text-blue-800"
            : statusVariant === "gray"
              ? "bg-gray-100 text-gray-800"
              : "bg-green-100 text-green-800";
    return (
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass} ${className}`}
      >
        {str}
      </span>
    );
  }

  // Percentage
  if (fieldType === "percentage") {
    const percentStr = formatPercentage(raw);
    return <span className={className}>{percentStr}</span>;
  }

  // Date: plain text + optional relative
  if (fieldType === "date" || isDateFieldOrValue(fieldInfo?.label, fieldInfo?.key, raw)) {
    const formattedDate = formatToMMDDYYYY(raw);
    const relative = showRelativeDate ? getRelativeDateString(raw) : null;
    return (
      <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
        <span>{formattedDate}</span>
        {relative && <span className="text-gray-500 text-sm">({relative})</span>}
      </span>
    );
  }

  // Full Address: clickable Google Maps link
  if (isAddressField(fieldInfo?.label) && str !== emptyPlaceholder) {
    const fullAddress = `${str}, USA`;
    const encodedAddress = encodeURIComponent(fullAddress);
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-blue-600 hover:underline ${className}`}
        onClick={handleClick}
      >
        {str}
      </a>
    );
  }

  // URL / link
  const isUrl =
    fieldType === "url" ||
    fieldType === "link" ||
    str.toLowerCase().includes("http://") ||
    str.toLowerCase().includes("https://") ||
    str.toLowerCase().startsWith("http") ||
    str.toLowerCase().startsWith("https");
  if (isUrl) {
    const href = str.startsWith("http") ? str : `https://${str}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-blue-600 hover:underline ${className}`}
        onClick={handleClick}
      >
        {str}
      </a>
    );
  }

  // Email: mailto + optional domain badge + optional copy (copy only when value is real email)
  const isEmail = fieldType === "email" || str.includes("@");
  if (isEmail) {
    const hasRealEmail = str !== emptyPlaceholder && str.includes("@");
    const domain = hasRealEmail && showEmailDomain ? extractEmailDomain(str) : "";
    const showCopy = enableCopy && hasRealEmail;
    return (
      <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <a
          href={hasRealEmail ? `mailto:${str}` : "#"}
          className={hasRealEmail ? "text-blue-600 hover:underline" : ""}
          onClick={hasRealEmail ? handleClick : (e) => e.preventDefault()}
        >
          {str}
        </a>
        {domain && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
            {domain}
          </span>
        )}
        {showCopy && (
          <button
            type="button"
            onClick={(e) => handleCopy(str, e)}
            className="inline-flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Copy email"
            title="Copy email"
          >
            {copied ? (
              <CheckIcon size={14} className="shrink-0 text-green-600" />
            ) : (
              <CopyIcon className="shrink-0" />
            )}
          </button>
        )}
      </span>
    );
  }

  // Phone: tel link + optional copy (copy only when value is real phone, not empty/placeholder)
  const matchesPhoneFormat = PHONE_PATTERN.test(str);
  if (matchesPhoneFormat) {
    const hasRealPhone = str !== emptyPlaceholder && raw !== "";
    const showCopy = enableCopy && hasRealPhone;
    const digits = str.replace(/\D/g, "");
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <a
          href={hasRealPhone ? `tel:${digits}` : "#"}
          className={hasRealPhone ? "text-blue-600 hover:underline" : ""}
          onClick={hasRealPhone ? handleClick : (e) => e.preventDefault()}
        >
          {str}
        </a>
        {showCopy && (
          <button
            type="button"
            onClick={(e) => handleCopy(str, e)}
            className="inline-flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Copy phone"
            title="Copy phone"
          >
            {copied ? (
              <CheckIcon size={14} className="shrink-0 text-green-600" />
            ) : (
              <CopyIcon className="shrink-0" />
            )}
          </button>
        )}
      </span>
    );
  }

  if (fieldType === "phone") {
    return <span className={className}>{str}</span>;
  }

  // Currency / Salary highlight: green + bold when > 100000
  const isCurrencyOrSalary = fieldType === "currency" || label.includes("salary");
  if (isCurrencyOrSalary) {
    const num = parseNumericValue(raw);
    if (num !== null && num > 100000) {
      return (
        <span className={`text-green-700 font-semibold ${className}`}>
          {str}
        </span>
      );
    }
  }

  // Default: plain text
  return <span className={className}>{str}</span>;
}
