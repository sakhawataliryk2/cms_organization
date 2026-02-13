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
}: FieldValueRendererProps) {
  const fieldType = (fieldInfo?.fieldType ?? "").toLowerCase();
  const label = (fieldInfo?.label || "").toLowerCase();

  const raw = value != null && value !== "" ? String(value).trim() : "";
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
