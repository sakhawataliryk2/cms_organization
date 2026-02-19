// app/dashboard/jobs/add/direct-hire/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
  isCustomFieldValueValid,
} from "@/components/CustomFieldRenderer";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";

// Define field type for typesafety
interface FormField {
  id: string;
  name: string;
  label: string;
  type:
  | "text"
  | "email"
  | "tel"
  | "date"
  | "select"
  | "textarea"
  | "file"
  | "number"
  | "url";
  required: boolean;
  visible: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  value: string;
}

interface MultiValueSearchTagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  onSearch?: (query: string) => void;
  placeholder?: string;
}

function MultiValueSearchTagInput({
  values,
  onChange,
  options,
  onSearch,
  placeholder = "Type to search and press Enter",
}: MultiValueSearchTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return [];
    return (options || [])
      .filter((opt) => {
        const normalized = String(opt || "").trim();
        if (!normalized) return false;
        if (values.includes(normalized)) return false;
        return normalized.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [inputValue, options, values]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const addValue = (val: string) => {
    const trimmed = String(val || "").trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        addValue(filteredOptions[0]);
      } else {
        addValue(inputValue);
      }
      return;
    }

    if (e.key === "Backspace" && inputValue === "" && values.length > 0) {
      onChange(values.slice(0, -1));
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      setIsOpen(true);
      return;
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="w-full min-h-[42px] p-2 border-b border-gray-300 focus-within:border-blue-500 flex flex-wrap gap-2 items-center">
        {values.map((v, idx) => (
          <span
            key={`${v}-${idx}`}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
          >
            {v}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            const next = e.target.value;
            setInputValue(next);
            setIsOpen(true);
            onSearch?.(next);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] outline-none border-none bg-transparent"
        />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
          {filteredOptions.map((opt, idx) => (
            <button
              key={`${String(opt)}-${idx}`}
              type="button"
              onClick={() => addValue(opt)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-800"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HiringManagerSearchSelectProps {
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string, opt: { id: string; name: string }) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  disabled?: boolean;
}

function HiringManagerSearchSelect({
  value,
  options,
  onChange,
  placeholder = "Search or select Hiring Manager",
  loading = false,
  className = "",
  disabled = false,
}: HiringManagerSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.id) === value);
  const displayValue = selectedOption?.name ?? "";

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) =>
      (opt.name || "").toLowerCase().includes(q)
    );
  }, [search, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [search, isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, isOpen]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredOptions[highlightIndex];
      if (opt) {
        onChange(opt.id, opt);
        setIsOpen(false);
        setSearch("");
      }
    }
  };

  const handleSelect = (opt: { id: string; name: string }) => {
    onChange(opt.id, opt);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className={`w-full max-w-md p-2 border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 flex items-center gap-2 bg-white ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
      >
        <input
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={displayValue ? "" : placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 outline-none bg-transparent"
          autoComplete="off"
        />
        <span className="text-gray-400 pointer-events-none shrink-0">
          {isOpen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </div>
      {loading && (
        <p className="text-sm text-gray-500 mt-1">Loading...</p>
      )}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 w-full max-w-md bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-auto"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No hiring managers match your search
            </div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                data-index={idx}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 ${idx === highlightIndex ? "bg-blue-50" : ""} ${String(opt.id) === value ? "font-medium text-blue-700" : ""}`}
              >
                {opt.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AddDirectHireJob() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const jobId = searchParams.get("id"); // Get job ID from URL if present (edit mode)
  const cloneFrom = searchParams.get("cloneFrom"); // Clone from this job ID (prefill, new job)
  const leadId = searchParams.get("leadId") || searchParams.get("lead_id");
  const organizationIdFromUrl = searchParams.get("organizationId") || searchParams.get("organization_id");
  const hiringManagerIdFromUrl = searchParams.get("hiringManagerId");
  const requireHiringManagerFromUrl = Boolean(organizationIdFromUrl || hiringManagerIdFromUrl);
  const hasPrefilledFromLeadRef = useRef(false);
  const hasPrefilledOrgRef = useRef(false);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [leadPrefillData, setLeadPrefillData] = useState<any>(null);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Add these state variables
  const [isEditMode, setIsEditMode] = useState(!!jobId);
  const [isLoadingJob, setIsLoadingJob] = useState(!!jobId || !!cloneFrom);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [jobStep, setJobStep] = useState<2 | 3>(jobId || cloneFrom ? 3 : 2);
  const [isHiringManagerModalOpen, setIsHiringManagerModalOpen] = useState(false);
  const [hiringManagerSearch, setHiringManagerSearch] = useState("");
  const [hiringManagerOptions, setHiringManagerOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isHiringManagerOptionsLoading, setIsHiringManagerOptionsLoading] = useState(false);

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [additionalSkillSuggestions, setAdditionalSkillSuggestions] = useState<string[]>([]);
  const additionalSkillSearchTimeoutRef = useRef<any>(null);

  // Use the custom fields hook with jobs-direct-hire entity type
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("jobs-direct-hire");

  const hiringManagerCustomField = useMemo(() => {
    return customFields.find((f) => {
      const label = String(f.field_label || "").trim().toLowerCase();
      return label === "hiring manager" || label.includes("hiring manager");
    });
  }, [customFields]);

  const hiringManagerValue =
    (hiringManagerCustomField
      ? (customFieldValues[hiringManagerCustomField.field_name] as string)
      : "") || "";

  const hiringManagerDisplayValue = useMemo(() => {
    const raw = String(hiringManagerValue || "");
    if (!raw) return "";
    const found = hiringManagerOptions.find((opt) => String(opt.id) === raw);
    return found?.name || raw;
  }, [hiringManagerOptions, hiringManagerValue]);

  // Pre-populate hiring manager from URL when redirected from jobs/add (org flow)
  useEffect(() => {
    if (!jobId && hiringManagerIdFromUrl && hiringManagerCustomField) {
      setCustomFieldValues((prev) => {
        if (prev[hiringManagerCustomField.field_name] === hiringManagerIdFromUrl) return prev;
        return { ...prev, [hiringManagerCustomField.field_name]: hiringManagerIdFromUrl };
      });
    }
  }, [jobId, hiringManagerIdFromUrl, hiringManagerCustomField, setCustomFieldValues]);

  useEffect(() => {
    setJobStep(jobId || cloneFrom ? 3 : 2);
  }, [jobId, cloneFrom]);

  useEffect(() => {
    if (isEditMode) {
      setJobStep(3);
      return;
    }
    // No HM step on this page (org HM is on main add page); always show form when adding
    if (!jobId) {
      setJobStep(3);
    }
  }, [jobId, isEditMode]);

  // Fetch HMs for form inline search select (and edit modal)
  const needHiringManagerOptions =
    jobStep === 3 && (organizationIdFromUrl || currentOrganizationId || !organizationIdFromUrl);
  useEffect(() => {
    if (!needHiringManagerOptions) return;

    const fetchHiringManagers = async () => {
      setIsHiringManagerOptionsLoading(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        // When URL or form has organization id, show only hiring managers under that organization
        // (same as organization view → contacts tab). Otherwise show all hiring managers.
        const orgId = currentOrganizationId || organizationIdFromUrl;
        const url = orgId
          ? `/api/hiring-managers?organization_id=${encodeURIComponent(orgId)}`
          : "/api/hiring-managers";

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setHiringManagerOptions([]);
          return;
        }

        const data = await response.json();
        const options = (data.hiringManagers || []).map((hm: any) => {
          const name =
            hm.full_name || `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.name || "";
          return {
            id: String(hm.id),
            name,
          };
        });

        setHiringManagerOptions(options.filter((o: any) => o.name));
      } catch (e) {
        console.error("Error fetching hiring managers:", e);
        setHiringManagerOptions([]);
      } finally {
        setIsHiringManagerOptionsLoading(false);
      }
    };

    fetchHiringManagers();
  }, [needHiringManagerOptions, currentOrganizationId, organizationIdFromUrl]);

  // Normalize label for matching admin-defined labels (case-insensitive, trim, collapse spaces)
  const normalizeLabel = (s: string) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  // Resolve Pay Rate, Mark-up %, and Client Bill Rate fields by admin center label (not hardcoded field_name)
  const billRateFieldRefs = useMemo(() => {
    if (!customFields.length) return { payRateField: null, markupField: null, clientBillRateField: null };
    const payRateLabels = ["pay rate", "pay rate:"];
    const markupLabels = ["mark-up %", "mark-up %:", "mark-up", "mark up %", "markup %", "markup"];
    const clientBillRateLabels = ["client bill rate", "client bill rate:"];
    const findByLabel = (labels: string[]) =>
      customFields.find((f) => {
        const L = normalizeLabel((f as any).field_label ?? (f as any).fieldLabel ?? "");
        return labels.some((l) => L === l || L === l.replace(":", ""));
      }) ?? null;
    return {
      payRateField: findByLabel(payRateLabels),
      markupField: findByLabel(markupLabels),
      clientBillRateField: findByLabel(clientBillRateLabels),
    };
  }, [customFields]);

  const { payRateField, markupField, clientBillRateField } = billRateFieldRefs;
  const payRateFieldName = payRateField?.field_name ?? "";
  const markupFieldName = markupField?.field_name ?? "";
  const clientBillRateFieldName = clientBillRateField?.field_name ?? "";

  // Calculate Client Bill Rate from Pay Rate and Mark-up % (formula)
  const calculateClientBillRate = (payRate: string, markupPercent: string): string => {
    const payRateNum = parseFloat(payRate);
    const markupNum = parseFloat(markupPercent);

    if (isNaN(payRateNum) || payRateNum <= 0) {
      return "";
    }

    if (isNaN(markupNum) || markupNum < 0) {
      return payRateNum.toString();
    }

    // Calculate: Client Bill Rate = Pay Rate * (1 + Mark-up % / 100)
    const clientBillRate = payRateNum * (1 + markupNum / 100);
    return clientBillRate.toFixed(2);
  };

  // Auto-calculate Client Bill Rate field (by admin label) when Pay Rate or Mark-up % (by admin label) changes
  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;
    if (!payRateFieldName || !clientBillRateFieldName) return;

    const payRate = customFieldValues[payRateFieldName] ?? "";
    const markupPercent = markupFieldName ? (customFieldValues[markupFieldName] ?? "") : "";

    if (payRate || markupPercent) {
      const calculatedBillRate = calculateClientBillRate(payRate, markupPercent);
      const current = customFieldValues[clientBillRateFieldName] ?? "";
      if (calculatedBillRate && calculatedBillRate !== current) {
        setCustomFieldValues((prev) => ({
          ...prev,
          [clientBillRateFieldName]: calculatedBillRate,
        }));
      }
    }
  }, [
    customFields,
    customFieldsLoading,
    payRateFieldName,
    markupFieldName,
    clientBillRateFieldName,
    customFieldValues[payRateFieldName],
    customFieldValues[markupFieldName],
    customFieldValues[clientBillRateFieldName],
    setCustomFieldValues,
  ]);

  // Enhanced handleCustomFieldChange that triggers calculation for Field_11 and Field_12/Field_512
  const handleCustomFieldChangeWithCalculation = (fieldName: string, value: string) => {
    // Update the field value
    handleCustomFieldChange(fieldName, value);
  };

  // Initialize with default fields
  useEffect(() => {
    initializeFields();
  }, []);

  // Fetch organization name if organizationId is provided
  // const fetchOrganizationName = async (orgId: string) => {
  //   try {
  //     const response = await fetch(`/api/organizations/${orgId}`);
  //     if (response.ok) {
  //       const data = await response.json();
  //       const orgName = data.organization?.name || "";
  //       setOrganizationName(orgName);
  //       setCurrentOrganizationId(orgId);
  //       // Prefill organizationId in form with organization name for display
  //       setFormFields((prev) =>
  //         prev.map((f) =>
  //           f.name === "organizationId"
  //             ? { ...f, value: orgName || orgId, locked: true }
  //             : f
  //         )
  //       );
  //     }
  //   } catch (error) {
  //     console.error("Error fetching organization:", error);
  //     // Still set the organizationId even if fetch fails
  //     setCurrentOrganizationId(orgId);
  //     setFormFields((prev) =>
  //       prev.map((f) =>
  //         f.name === "organizationId"
  //           ? { ...f, value: orgId, locked: true }
  //           : f
  //       )
  //     );
  //   }
  // };

  // Fetch organizations (used for syncing currentOrganizationId when Organization field value is name)
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations", {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      }
    };
    fetchOrganizations();
  }, []);

  // When organizationIdFromUrl is present, set Organization field to the ID only (no fetch, no name)
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!organizationIdFromUrl) return;
    if (customFieldsLoading || customFields.length === 0) return; // Wait for custom fields

    const orgField = customFields.find((f) => f.field_label.toLowerCase() === "organization");
    if (orgField) {
      setCustomFieldValues((prev) => {
        if (prev[orgField.field_name] === organizationIdFromUrl) return prev;
        return {
          ...prev,
          [orgField.field_name]: organizationIdFromUrl,
        };
      });
      setCurrentOrganizationId(organizationIdFromUrl);
    }
  }, [organizationIdFromUrl, jobId, customFieldsLoading, customFields, setCustomFieldValues]);

  // Auto-populate Field_507 (Account Manager) with logged-in user's name
  useEffect(() => {
    // Wait for customFields to load
    if (customFieldsLoading || customFields.length === 0) return;

    // Find Field_507 specifically
    const accountManagerField = customFields.find(
      (f) =>
        f.field_name === "Field_507" ||
        f.field_name === "field_507" ||
        f.field_name?.toLowerCase() === "field_507"
    );

    if (accountManagerField) {
      const currentValue = customFieldValues[accountManagerField.field_name];
      // Only auto-populate if field is empty (works in both create and edit mode)
      if (!currentValue || currentValue.trim() === "") {
        try {
          const userDataStr = getCookie("user");
          if (userDataStr) {
            const userData = JSON.parse(userDataStr as string);
            if (userData.name) {
              setCustomFieldValues((prev) => ({
                ...prev,
                [accountManagerField.field_name]: userData.name,
              }));
              console.log(
                "Auto-populated Field_507 (Account Manager) with current user:",
                userData.name
              );
            }
          }
        } catch (e) {
          console.error("Error parsing user data from cookie:", e);
        }
      }
    }
  }, [
    customFields,
    customFieldsLoading,
    customFieldValues,
    setCustomFieldValues,
  ]);

  // Auto-fill Date Added with today when creating a new job (so it's not stored as empty)
  useEffect(() => {
    if (jobId || cloneFrom) return; // edit or clone: don't override
    if (customFieldsLoading || customFields.length === 0) return;

    const dateAddedField = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "date added");
    if (!dateAddedField) return;

    const currentValue = customFieldValues[dateAddedField.field_name];
    if (currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== "") return;

    const today = new Date().toISOString().split("T")[0];
    setCustomFieldValues((prev) => ({
      ...prev,
      [dateAddedField.field_name]: today,
    }));
  }, [jobId, cloneFrom, customFields, customFieldsLoading, customFieldValues, setCustomFieldValues]);

  const organizationField = customFields.find((f) => f.field_label.toLowerCase() === "organization");
  // Sync currentOrganizationId with Organization field value when it changes
  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;
    if (!organizationField) return;
    const fieldValue = customFieldValues[organizationField.field_name] || "";
    if (!fieldValue) return;
    const selectedOrg = organizations.find(
      (org) => org.name === fieldValue || org.id.toString() === fieldValue
    );
    const newOrgId = selectedOrg ? selectedOrg.id.toString() : fieldValue;
    if (newOrgId && newOrgId !== currentOrganizationId) {
      setCurrentOrganizationId(newOrgId);
    }
  }, [customFieldValues[organizationField?.field_name || ""], organizations, customFields, customFieldsLoading, currentOrganizationId]);

  // Prefill Organization field from URL param with ID only (no fetch, value must be id per admin)
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!organizationIdFromUrl) return;
    if (hasPrefilledOrgRef.current) return;
    if (customFieldsLoading) return; // Wait for custom fields to load
    if (customFields.length === 0) return; // Wait for custom fields to be available

    hasPrefilledOrgRef.current = true;
    setCurrentOrganizationId(organizationIdFromUrl);

    const orgField = customFields.find((f) => f.field_label.toLowerCase() === "organization");
    if (orgField) {
      setCustomFieldValues((prev) => {
        if (prev[orgField.field_name] === organizationIdFromUrl) return prev;
        return {
          ...prev,
          [orgField.field_name]: organizationIdFromUrl,
        };
      });
    }
  }, [organizationIdFromUrl, jobId, customFieldsLoading, customFields, setCustomFieldValues]);

  // Prefill from lead when coming via Leads -> Convert (create mode only)
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!leadId) return;
    if (hasPrefilledFromLeadRef.current) return;
    if (formFields.length === 0) return;

    hasPrefilledFromLeadRef.current = true;

    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );

    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        const lead = data.lead;
        if (!lead) return;
        setLeadPrefillData(lead);

        const orgValue =
          lead.organization_id?.toString?.() ||
          lead.organization_id ||
          lead.organization_name_from_org ||
          "";

        const hiringManagerValue =
          lead.full_name ||
          `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
          "";

        const addressParts = [
          lead.address,
          [lead.city, lead.state].filter(Boolean).join(", "),
          lead.zip,
        ].filter(Boolean);
        const addressValue = addressParts.join(", ");

        // Prefill standard fields (only if empty)
        setFormFields((prev) =>
          prev.map((f) => {
            if (f.name === "organizationId" && !f.value) {
              return { ...f, value: orgValue };
            }
            if (f.name === "hiringManager" && !f.value) {
              return { ...f, value: hiringManagerValue };
            }
            if (f.name === "worksiteLocation" && !f.value) {
              return { ...f, value: addressValue };
            }
            return f;
          })
        );

        // Also prefill custom fields if present (labels-based)
        if (!customFieldsLoading && customFields.length > 0) {
          setCustomFieldValues((prev) => {
            const next = { ...prev };
            customFields.forEach((field) => {
              if (
                (field.field_label === "Organization" ||
                  field.field_label === "Organization ID") &&
                !next[field.field_name]
              ) {
                next[field.field_name] = orgValue;
              }
              if (
                field.field_label === "Hiring Manager" &&
                !next[field.field_name]
              ) {
                next[field.field_name] = hiringManagerValue;
              }
            });
            return next;
          });
        }
      } catch (e) {
        // Non-blocking prefill; ignore errors
        console.error("Lead prefill failed:", e);
      }
    })();
  }, [
    jobId,
    leadId,
    formFields.length,
    customFieldsLoading,
    customFields,
    setCustomFieldValues,
  ]);

  useEffect(() => {
    if (jobId) return; // edit mode me kuch override nahi
    if (!leadPrefillData) return;
    if (customFieldsLoading) return;
    if (customFields.length === 0) return;

    const lead = leadPrefillData;

    const orgValue =
      lead.organization_id?.toString?.() ||
      lead.organization_id ||
      lead.organization_name_from_org ||
      "";

    const hiringManagerValue =
      lead.full_name ||
      `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
      "";

    setCustomFieldValues((prev) => {
      const next = { ...prev };

      customFields.forEach((field) => {
        if (
          (field.field_label === "Organization" ||
            field.field_label === "Organization ID") &&
          !next[field.field_name]
        ) {
          next[field.field_name] = orgValue;
        }

        if (field.field_label === "Hiring Manager" && !next[field.field_name]) {
          next[field.field_name] = hiringManagerValue;
        }
      });

      return next;
    });
  }, [
    jobId,
    leadPrefillData,
    customFieldsLoading,
    customFields,
    setCustomFieldValues,
  ]);

  const initializeFields = () => {
    // These are the standard fields (not used for Direct Hire - only custom fields are used)
    const standardFields: FormField[] = [];
    setFormFields(standardFields);
  };

  // Load job data when in edit mode or clone mode
  useEffect(() => {
    const idToLoad = jobId || cloneFrom;
    if (idToLoad && formFields.length >= 0 && !customFieldsLoading) {
      fetchJobData(idToLoad, !!cloneFrom);
    }
  }, [jobId, cloneFrom, formFields.length, customFieldsLoading]);

  // Function to fetch job data. When isClone, Date Added is set to today.
  const fetchJobData = async (id: string, isClone?: boolean) => {
    setIsLoadingJob(true);
    setLoadError(null);

    try {
      console.log(`Fetching Direct Hire job data for ID: ${id}`);
      const response = await fetch(`/api/jobs/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch job details");
      }

      const data = await response.json();
      console.log("Job data received:", data);

      if (!data.job) {
        throw new Error("No job data received");
      }

      // Map API data to form fields
      const job = data.job;

      // Set current organization ID for contact lookup
      if (job.organization_id) {
        setCurrentOrganizationId(job.organization_id.toString());
      }

      // Parse existing custom fields from the job
      let existingCustomFields: Record<string, any> = {};
      if (job.custom_fields) {
        try {
          existingCustomFields =
            typeof job.custom_fields === "string"
              ? JSON.parse(job.custom_fields)
              : job.custom_fields;
        } catch (e) {
          console.error("Error parsing existing custom fields:", e);
        }
      }

      // Map custom fields from field_label (database key) to field_name (form key)
      const mappedCustomFieldValues: Record<string, any> = {};

      // First, map any existing custom field values from the database
      if (customFields.length > 0 && Object.keys(existingCustomFields).length > 0) {
        customFields.forEach((field) => {
          // Try to find the value by field_label (as stored in DB)
          const value = existingCustomFields[field.field_label];
          if (value !== undefined) {
            // Map to field_name for the form
            mappedCustomFieldValues[field.field_name] = value;
          }
        });
      }

      // Second, map standard job fields to custom fields based on field labels
      if (customFields.length > 0) {
        const standardFieldMapping: Record<string, string> = {
          "Job Title": job.job_title || "",
          "Title": job.job_title || "",
          "Category": job.category || "",
          "Organization": job.organization_name || job.organization_id?.toString() || "",
          "Hiring Manager": job.hiring_manager || "",
          "Status": job.status || "Open",
          "Priority": job.priority || "",
          "Employment Type": job.employment_type || "",
          "Start Date": job.start_date
            ? job.start_date.split("T")[0]
            : "",
          "Worksite Location": job.worksite_location || "",
          "Remote Option": job.remote_option || "",
          "Job Description": job.job_description || "",
          "Description": job.job_description || "",
          "Minimum Salary": job.min_salary ? job.min_salary.toString() : "",
          "Maximum Salary": job.max_salary ? job.max_salary.toString() : "",
          "Benefits": job.benefits || "",
          "Required Skills": job.required_skills || "",
          "Job Board Status": job.job_board_status || "Not Posted",
          "Owner": job.owner || "",
          "Date Added": isClone
            ? new Date().toISOString().split("T")[0]
            : (job.date_added ? job.date_added.split("T")[0] : ""),
        };

        customFields.forEach((field) => {
          // Only set if not already set from existingCustomFields
          if (mappedCustomFieldValues[field.field_name] === undefined) {
            // Try to find matching standard field by field_label
            const standardValue = standardFieldMapping[field.field_label];
            if (standardValue !== undefined && standardValue !== "") {
              mappedCustomFieldValues[field.field_name] = standardValue;
            }
          }
        });
      }

      console.log("Custom Field Values Loaded (mapped):", mappedCustomFieldValues);
      console.log("Original custom fields from DB:", existingCustomFields);
      console.log("Custom Fields Definitions:", customFields.map(f => ({ name: f.field_name, label: f.field_label })));

      // Set the mapped custom field values
      setCustomFieldValues(mappedCustomFieldValues);

      console.log("Direct Hire job data loaded successfully");
    } catch (err) {
      console.error("Error fetching job:", err);
      setLoadError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job details"
      );
    } finally {
      setIsLoadingJob(false);
    }
  };

  // Handle input change
  const handleChange = (id: string, value: string) => {
    setFormFields(
      formFields.map((field) => (field.id === id ? { ...field, value } : field))
    );
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setJobDescFile(e.target.files[0]);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requireHiringManager = !isEditMode && requireHiringManagerFromUrl;
    if (requireHiringManager) {
      if (!hiringManagerCustomField) {
        setError("Hiring Manager field is not configured in Field Management.");
        return;
      }
      if (!hiringManagerValue || String(hiringManagerValue).trim() === "") {
        setError("Hiring Manager is required.");
        return;
      }
    }

    // Validate required custom fields
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1) Standard fields (visible ones)
      const payload = formFields.reduce((acc, field) => {
        if (field.visible) acc[field.name] = field.value;
        return acc;
      }, {} as Record<string, any>);

      // 2) Custom fields from hook (keys are field_label)
      const customFieldsToSend = getCustomFieldsForSubmission();

      // 3) Build DB customFields object: every form/custom field goes into custom_fields (create and edit)
      const customFieldsForDB: Record<string, any> = {};
      Object.keys(customFieldsToSend).forEach((k) => {
        const v = customFieldsToSend[k];
        if (v !== undefined && v !== null) customFieldsForDB[k] = v;
      });

      // 4) Map only Job Title, Hiring Manager, Job Description for top-level payload (no hardcode for Status/Organization)
      const jobTitleLabel = customFields.find((f) => /^job\s*title$/i.test(String(f.field_label || "")))?.field_label || "Job Title";
      const titleLabel = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "title")?.field_label;
      const mappedJobTitle =
        customFieldsToSend[jobTitleLabel] ||
        (titleLabel ? customFieldsToSend[titleLabel] : undefined) ||
        payload.jobTitle ||
        "";

      const hiringManagerLabel = customFields.find((f) => String(f.field_label || "").toLowerCase().includes("hiring manager"))?.field_label || "Hiring Manager";
      const mappedHiringManager =
        customFieldsToSend[hiringManagerLabel] ||
        payload.hiringManager ||
        "";

      const jobDescLabel = customFields.find((f) => /^job\s*description$/i.test(String(f.field_label || "")))?.field_label;
      const descLabel = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "description")?.field_label;
      const mappedJobDescription =
        (jobDescLabel ? customFieldsToSend[jobDescLabel] : undefined) ||
        (descLabel ? customFieldsToSend[descLabel] : undefined) ||
        payload.jobDescription ||
        "";

      // Status and Organization: use form values only (no defaults, no overwrites). URL param only prefills the field; value is in customFieldsToSend.
      const statusLabel = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "status")?.field_label ?? "Status";
      const orgLabel = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "organization")?.field_label ?? "Organization";
      const statusValue = customFieldsToSend[statusLabel] ?? payload.status ?? "";
      const organizationValue = customFieldsToSend[orgLabel] ?? payload.organizationId ?? "";

      // Date Added: when creating a new job, default to today if form value is empty (so it's not stored as "")
      const dateAddedLabel = customFields.find((f) => String(f.field_label || "").trim().toLowerCase() === "date added")?.field_label;
      if (dateAddedLabel && !isEditMode) {
        const dateAddedValue = customFieldsToSend[dateAddedLabel];
        if (dateAddedValue === undefined || dateAddedValue === null || String(dateAddedValue).trim() === "") {
          customFieldsForDB[dateAddedLabel] = new Date().toISOString().split("T")[0];
        }
      }

      // Overwrite only Job Title, Hiring Manager, Job Description in custom_fields (Status and Organization stay as form values from step 3)
      const jobTitleKey = customFields.find((f) => /^job\s*title$/i.test(String(f.field_label || "")))?.field_label || jobTitleLabel;
      customFieldsForDB[jobTitleKey] = mappedJobTitle;
      customFieldsForDB[hiringManagerLabel] = mappedHiringManager;
      if (jobDescLabel) customFieldsForDB[jobDescLabel] = mappedJobDescription;
      else if (descLabel) customFieldsForDB[descLabel] = mappedJobDescription;

      // 5) Final payload - Status and Organization from form only (no finalOrganizationId / no status default)
      const finalPayload: Record<string, any> = {
        ...payload,
        jobTitle: mappedJobTitle,
        jobType: "direct-hire",
        hiringManager: mappedHiringManager,
        jobDescription: mappedJobDescription,
        status: statusValue,
        organizationId: organizationValue,
        entityType: "jobs-direct-hire",
        custom_fields: customFieldsForDB,
      };

      console.log(`${isEditMode ? "Updating" : "Creating"} Direct Hire job payload:`, finalPayload);

      const url = isEditMode ? `/api/jobs/${jobId}` : "/api/jobs";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(finalPayload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to ${isEditMode ? "update" : "create"} Direct Hire job`);
      }

      const resultId = isEditMode ? jobId : data.job?.id;
      // Navigate based on where we came from
      if (organizationIdFromUrl && !isEditMode) {
        router.push(`/dashboard/organizations/view?id=${organizationIdFromUrl}`);
      } else {
        router.push(resultId ? `/dashboard/jobs/view?id=${resultId}` : "/dashboard/jobs");
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} Direct Hire job:`, err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleGoBack = () => {
    router.back();
  };

  const isFormValid = useMemo(() => {
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) return false;
    if (!isEditMode) {
      if (!hiringManagerCustomField) return false;
      if (!hiringManagerValue || String(hiringManagerValue).trim() === "") return false;
    }
    return true;
  }, [customFieldValues, isEditMode, hiringManagerCustomField, hiringManagerValue, validateCustomFields]);

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <LoadingScreen
        message={isEditMode ? "Updating Direct Hire job..." : "Creating Direct Hire job..."}
      />
    );
  }

  // Show loading screen when loading existing job data or custom fields
  if (isLoadingJob || customFieldsLoading) {
    return <LoadingScreen message="Loading Direct Hire job form..." />;
  }

  // Show error if job loading fails
  if (loadError) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{loadError}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
        {/* Header with X button */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center">
            <Image
              src="/window.svg"
              alt="Direct Hire Job"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Direct Hire Job
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleGoBack}
              className="text-gray-500 hover:text-gray-700"
            >
              <span className="text-2xl font-bold">X</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p>{error}</p>
          </div>
        )}

        {/* Form: from org HM may be prefilled; from job overview HM is inline search select (no modal) */}
        {/* Hide HM selection when already selected from org flow (organizationId + hiringManagerId in URL); show in simple add and edit mode */}
        {(isEditMode || jobStep === 3) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* {!isEditMode && hiringManagerCustomField && !(organizationIdFromUrl && hiringManagerIdFromUrl) && (
                <div className="flex items-center mb-3">
                  <label className="w-48 font-medium flex items-center">
                    Hiring Manager:
                  </label>
                  <div className="flex-1">
                    <HiringManagerSearchSelect
                      value={hiringManagerValue}
                      options={hiringManagerOptions}
                      onChange={(id, opt) => {
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [hiringManagerCustomField.field_name]: id,
                        }));
                        setFormFields((prev) =>
                          prev.map((f) =>
                            f.name === "hiringManager" ? { ...f, value: opt.name } : f
                          )
                        );
                      }}
                      placeholder="Search or select Hiring Manager"
                      loading={isHiringManagerOptionsLoading}
                    />
                  </div>
                </div>
              )} */}
              {/* {isEditMode && (
                <div className="flex items-center mb-3">
                  <label className="w-48 font-medium flex items-center">
                    Hiring Manager:
                  </label>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 p-2 border-b border-gray-300 text-gray-800">
                      {hiringManagerDisplayValue}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHiringManagerModalOpen(true)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )} */}
              {/* Custom Fields Section - Only fields from Admin Center → Field Management → Jobs Direct Hire */}
              {customFields.length > 0 && (
                <>
                  {customFields.map((field) => {
                    // Don't render hidden fields at all
                    if (field.is_hidden) return null;

                    const isHiringManagerField =
                      field.field_label === "Hiring Manager" ||
                      (field.field_type === "lookup" && field.lookup_type === "hiring-managers");
                    if (isHiringManagerField && !isEditMode && requireHiringManagerFromUrl) {
                      return null;
                    }

                    const fieldValue = customFieldValues[field.field_name] || "";

                    const fieldLabelLower = String(field.field_label || "").toLowerCase();
                    const isAdditionalSkillsField =
                      fieldLabelLower.includes("additional") && fieldLabelLower.includes("skill");

                    if (isAdditionalSkillsField) {
                      const parseMultiValue = (val: any): string[] => {
                        if (!val) return [];
                        if (Array.isArray(val)) return val.filter((s) => s && String(s).trim());
                        if (typeof val === "string") {
                          return val
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s);
                        }
                        return [];
                      };

                      const selected = parseMultiValue(fieldValue);

                      let optionList: string[] = [];
                      if (Array.isArray((field as any).options)) {
                        optionList = (field as any).options.filter(
                          (opt: any): opt is string => typeof opt === "string"
                        );
                      } else if (typeof (field as any).options === "string") {
                        try {
                          const parsed = JSON.parse((field as any).options);
                          if (Array.isArray(parsed)) {
                            optionList = parsed
                              .map((x) => (typeof x === "string" ? x : x?.label || x?.value))
                              .filter((x): x is string => typeof x === "string");
                          }
                        } catch {
                          optionList = [];
                        }
                      }

                      const mergedOptions = Array.from(
                        new Set([...(optionList || []), ...(additionalSkillSuggestions || [])])
                      );

                      const fetchSkillSuggestions = (query: string) => {
                        const q = String(query || "").trim();
                        if (additionalSkillSearchTimeoutRef.current) {
                          clearTimeout(additionalSkillSearchTimeoutRef.current);
                        }
                        additionalSkillSearchTimeoutRef.current = setTimeout(async () => {
                          try {
                            if (!q) {
                              setAdditionalSkillSuggestions([]);
                              return;
                            }

                            const response = await fetch(
                              `/api/jobs/skills-suggestions?q=${encodeURIComponent(q)}&limit=20`
                            );
                            const data = await response.json();
                            if (response.ok) {
                              setAdditionalSkillSuggestions(data.suggestions || []);
                            }
                          } catch (e) {
                            console.error("Error fetching skill suggestions:", e);
                          }
                        }, 250);
                      };

                      const handleAdditionalSkillsChange = (skills: string[]) => {
                        const valueToSave = skills.length > 0 ? skills.join(", ") : "";
                        handleCustomFieldChange(field.field_name, valueToSave);
                      };

                      return (
                        <div key={field.id} className="flex items-start mb-3">
                          <label className="w-48 font-medium flex items-center pt-2">
                            {field.field_label}:
                            {field.is_required &&
                              (selected.length > 0 ? (
                                <span className="text-green-500 ml-1">✔</span>
                              ) : (
                                <span className="text-red-500 ml-1">*</span>
                              ))}
                          </label>
                          <div className="flex-1 relative">
                            <MultiValueSearchTagInput
                              values={selected}
                              onChange={handleAdditionalSkillsChange}
                              options={mergedOptions}
                              onSearch={fetchSkillSuggestions}
                              placeholder="Type to search skills and press Enter"
                            />
                          </div>
                        </div>
                      );
                    }

                    // Special handling for Pay Rate, Mark-up %, and Client Bill Rate (identified by admin center labels)
                    const isPayRateOrMarkupOrClientBill =
                      field.field_name === payRateFieldName ||
                      field.field_name === markupFieldName ||
                      field.field_name === clientBillRateFieldName;
                    if (isPayRateOrMarkupOrClientBill) {
                      const isCalculatedField = field.field_name === clientBillRateFieldName;
                      const payRateValue = payRateFieldName ? (customFieldValues[payRateFieldName] ?? "") : "";
                      const markupValue = markupFieldName ? (customFieldValues[markupFieldName] ?? "") : "";
                      const calculatedValue = calculateClientBillRate(payRateValue, markupValue);

                      return (
                        <div key={field.id} className="flex items-center mb-3">
                          <label className="w-48 font-medium flex items-center">
                            {field.field_label}:
                            {field.is_required &&
                              (isCustomFieldValueValid(field, fieldValue) ? (
                                <span className="text-green-500 ml-1">✔</span>
                              ) : (
                                <span className="text-red-500 ml-1">*</span>
                              ))}
                            {isCalculatedField && (
                              <span className="text-xs text-gray-500 ml-2">(Calculated)</span>
                            )}
                          </label>

                          <div className="flex-1 relative">
                            {isCalculatedField ? (
                              <input
                                type="text"
                                value={calculatedValue || fieldValue}
                                readOnly
                                className="w-full p-2 border-b border-gray-300 bg-gray-50 text-gray-700 cursor-not-allowed"
                                placeholder="Auto-calculated"
                              />
                            ) : (
                              <CustomFieldRenderer
                                field={field}
                                allFields={customFields}
                                values={customFieldValues}
                                value={fieldValue}
                                onChange={handleCustomFieldChangeWithCalculation}
                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                              />
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field.id} className="flex items-center mb-3">
                        <label className="w-48 font-medium flex items-center">
                          {field.field_label}:
                          {field.is_required &&
                            (isCustomFieldValueValid(field, fieldValue) ? (
                              <span className="text-green-500 ml-1">✔</span>
                            ) : (
                              <span className="text-red-500 ml-1">*</span>
                            ))}
                        </label>

                        <div className="flex-1 relative">
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            onChange={handleCustomFieldChange}
                            allFields={customFields}
                            values={customFieldValues}
                            context={{ organizationId: currentOrganizationId || organizationIdFromUrl || "" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="h-20" aria-hidden="true" />
            <div className="sticky bottom-0 left-0 right-0 z-10 -mx-4 -mb-4 px-4 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleGoBack}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className={`px-4 py-2 rounded ${isSubmitting || !isFormValid
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
              >
                {isEditMode ? "Update" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      {isHiringManagerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Select Hiring Manager</h2>
              <button
                type="button"
                onClick={() => setIsHiringManagerModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">X</span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <input
                type="text"
                value={hiringManagerSearch}
                onChange={(e) => setHiringManagerSearch(e.target.value)}
                placeholder="Search hiring manager"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />

              <div className="max-h-80 overflow-auto border border-gray-200 rounded">
                {isHiringManagerOptionsLoading ? (
                  <div className="p-3 text-sm text-gray-600">Loading...</div>
                ) : (
                  hiringManagerOptions
                    .filter((opt) => {
                      const q = hiringManagerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return opt.name.toLowerCase().includes(q);
                    })
                    .map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (!hiringManagerCustomField) {
                            setError("Hiring Manager field is not configured in Field Management.");
                            return;
                          }

                          setCustomFieldValues((prev) => ({
                            ...prev,
                            [hiringManagerCustomField.field_name]: opt.id,
                          }));
                          setIsHiringManagerModalOpen(false);
                          setHiringManagerSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-800 border-b border-gray-100"
                      >
                        {opt.name}
                      </button>
                    ))
                )}

                {!isHiringManagerOptionsLoading && hiringManagerOptions.length === 0 && (
                  <div className="p-3 text-sm text-gray-600">No hiring managers found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
