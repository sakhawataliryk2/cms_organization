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
  /** Field type from admin: url, link, email, phone, status, lookup, multiselect_lookup, text, number */
  fieldType?: string;
  /** Lookup entity type for RecordNameResolver (e.g. "organizations", "job") */
  lookupType?: string;
  /** Multi-select lookup entity type */
  multiSelectLookupType?: string;
  /** Display label (e.g. "Status") – used to treat as status when key is status */
  label?: string;
  /** Column/key name (e.g. "status") */
  key?: string;
}

/** Parts for combined address: Address, Address 2, City, State, Zip */
export interface AddressParts {
  address?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface FieldValueRendererProps {
  /** Raw value to render */
  value: string | number | null | undefined;
  /** Field metadata for type-based rendering */
  fieldInfo?: FieldInfo | null;
  /** When field is Address/Full Address, use these to build "Address, Address 2, City, State, Zip" (overrides value when present) */
  addressParts?: AddressParts | null;
  /** Placeholder when value is empty */
  emptyPlaceholder?: string;
  /** For lookup: make RecordNameResolver clickable */
  clickable?: boolean;
  /** Optional class for the wrapper (e.g. text-sm font-medium) */
  className?: string;
  /** Optional: stop propagation on inner links (e.g. in table row click) */
  stopPropagation?: boolean;
  /** Status badge variant: "default" (green), "archived" (amber), "deletion" (red), "blue", "gray" */
  statusVariant?: "default" | "archived" | "deletion" | "blue" | "gray";
  /** When true, render value as status badge (e.g. for archive_reason column) */
  forceRenderAsStatus?: boolean;
  /** For lookup: fallback text when resolution fails (defaults to value) */
  lookupFallback?: string;
}

/**
 * Renders a field value according to its type (url, email, phone, status, lookup, text).
 * Use in overview headers and list table cells for consistent behavior.
 */
/** Build combined address: Address, Address 2, City, State, Zip (only non-empty parts) */
function formatCombinedAddress(parts: AddressParts): string {
  const a = (parts.address ?? "").trim();
  const a2 = (parts.address2 ?? "").trim();
  const city = (parts.city ?? "").trim();
  const state = (parts.state ?? "").trim();
  const zip = (parts.zip ?? "").trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  const combined = [a, a2, cityState, zip].filter(Boolean).join(", ");
  return combined;
}

/** True when field is Address or Full Address (combined line), not Address 2 alone */
function isAddressField(label?: string, key?: string): boolean {
  const l = (label ?? "").toLowerCase().replace(/\s+/g, " ");
  const k = (key ?? "").toLowerCase().replace(/\s+/g, " ");
  return (
    l === "address" ||
    l === "full address" ||
    k === "address" ||
    k === "full_address" ||
    k === "__full_address__"
  );
}

/** True when field is a date (by label/key) or value looks like a date so we never render as phone/link */
function isDateFieldOrValue(label?: string, key?: string, value?: string): boolean {
  const l = (label ?? "").toLowerCase();
  const k = (key ?? "").toLowerCase();
  const hasDateInName = l.includes("date") || k.includes("date");
  const looksLikeDate = value != null && DATE_PATTERN.test(String(value).trim());
  return hasDateInName || looksLikeDate;
}

export default function FieldValueRenderer({
  value,
  fieldInfo,
  addressParts,
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
  
  // Address: use addressParts when provided and field is address-type
  const isAddress = isAddressField(fieldInfo?.label, fieldInfo?.key);
  const useCombinedAddress = isAddress && addressParts;
  const combinedAddressStr = useCombinedAddress ? formatCombinedAddress(addressParts) : "";

  const raw =
    useCombinedAddress && combinedAddressStr
      ? combinedAddressStr
      : value != null && value !== ""
        ? String(value).trim()
        : "";
  const isEmpty = raw === "";
  const str = isEmpty ? emptyPlaceholder : raw;

  const isStatus =
    forceRenderAsStatus ||
    fieldType === "status" ||
    label === "status";

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  // Empty value: show placeholder (no links)
  if (isEmpty) {
    return <span className={className}>{str}</span>;
  }

  // Address / Full Address: always plain text (combined from addressParts or value)
  if (isAddress) {
    return <span className={className}>{str}</span>;
  }

  const isLookup =
    fieldType === "lookup" || fieldType === "multiselect_lookup";

  if (isLookup) {
    const lookupType =
      fieldInfo?.lookupType ||
      fieldInfo?.multiSelectLookupType;
    const fallback = lookupFallback != null && lookupFallback !== "" ? lookupFallback : str;
    return (
      <span onClick={handleClick} className={className}>
        <RecordNameResolver
          id={raw || null}
          type={lookupType || ''}
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

  // Date: always plain text (never link as phone/url)
  if (fieldType === "date" || isDateFieldOrValue(fieldInfo?.label, fieldInfo?.key, raw)) {
    return <span className={className}>{str}</span>;
  }

  // URL / link: fieldType or value pattern
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

  // Email: fieldType or value contains @
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

  // Phone: only (XXX) XXX-XXXX format gets tel: link so dates like 2026-02-05 stay plain
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
