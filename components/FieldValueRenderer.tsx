"use client";

import React, { useState, useCallback } from "react";
import RecordNameResolver from "@/components/RecordNameResolver";

/** Placeholder when value is empty or N/A */
const DEFAULT_EMPTY = "—";

/** US phone pattern: (XXX) XXX-XXXX e.g. (112) 287-3112 */
const PHONE_PATTERN = /^\(\d{3}\)\s*\d{3}-\d{4}$/;

/** Matches common date formats so we don't treat them as phones (YYYY-MM-DD, MM/DD/YYYY, etc.) */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;

export interface FieldInfo {
  fieldType?: string;
  lookupType?: string;
  multiSelectLookupType?: string;
  label?: string;
  key?: string;
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
}: FieldValueRendererProps) {
  const [copied, setCopied] = useState(false);

  const fieldType = (fieldInfo?.fieldType ?? "").toLowerCase();
  const label = (fieldInfo?.label || "").toLowerCase();

  const rawOriginal = value != null && value !== "" ? String(value).trim() : "";
  let raw = rawOriginal;

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

      const findAddressField = (labels: string[]) =>
        allFields.find((f) => labels.some((l) => normalize(f.field_label || "") === normalize(l)));

      const addressField = findAddressField(["address", "address1"]);
      const address2Field = findAddressField(["address2", "address 2"]);
      const cityField = findAddressField(["city"]);
      const stateField = findAddressField(["state"]);
      const zipField = findAddressField(["zip", "zip code", "postal code"]);

      const getVal = (fld?: { field_name?: string; field_label?: string }) => {
        if (!fld) return "";
        const nameKey = fld.field_name;
        const labelKey = fld.field_label;

        if (nameKey && Object.prototype.hasOwnProperty.call(valuesRecord, nameKey)) {
          return String(valuesRecord[nameKey] ?? "").trim();
        }
        if (labelKey && Object.prototype.hasOwnProperty.call(valuesRecord, labelKey)) {
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

  const isEmpty = raw === "";
  const str = isEmpty ? emptyPlaceholder : raw;

  const isStatus = forceRenderAsStatus || fieldType === "status" || label === "status";

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const handleCopy = useCallback((text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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
              <span className="text-xs text-green-600">Copied!</span>
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
              <span className="text-xs text-green-600">Copied!</span>
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
