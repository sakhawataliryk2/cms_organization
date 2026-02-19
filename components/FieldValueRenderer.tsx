"use client";

import React from "react";
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
}: FieldValueRendererProps) {
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

  if (isEmpty) {
    return <span className={className}>{str}</span>;
  }

  // Lookup fields
  const isLookup = fieldType === "lookup" || fieldType === "multiselect_lookup";
  if (isLookup) {
    const lookupType = fieldInfo?.lookupType || fieldInfo?.multiSelectLookupType;
    const fallback = lookupFallback != null && lookupFallback !== "" ? lookupFallback : str;
    return (
      <span onClick={handleClick} className={className}>
        <RecordNameResolver
          id={raw || null}
          type={lookupType || ""}
          clickable
          fallback={fallback}
        />
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

  // Date: plain text
  if (fieldType === "date" || isDateFieldOrValue(fieldInfo?.label, fieldInfo?.key, raw)) {
    const formattedDate = formatToMMDDYYYY(raw);
    return <span className={className}>{formattedDate}</span>;
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

  // Email
  const isEmail = fieldType === "email" || str.includes("@");
  if (isEmail) {
    return (
      <a
        href={`mailto:${str}`}
        className={`text-blue-600 hover:underline ${className}`}
        onClick={handleClick}
      >
        {str}
      </a>
    );
  }

  // Phone
  const matchesPhoneFormat = PHONE_PATTERN.test(str);
  if (matchesPhoneFormat) {
    const digits = str.replace(/\D/g, "");
    return (
      <a
        href={`tel:${digits}`}
        className={`text-blue-600 hover:underline ${className}`}
        onClick={handleClick}
      >
        {str}
      </a>
    );
  }

  if (fieldType === "phone") {
    return <span className={className}>{str}</span>;
  }

  // Default: plain text
  return <span className={className}>{str}</span>;
}
