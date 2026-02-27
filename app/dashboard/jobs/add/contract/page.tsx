// app/dashboard/jobs/add/contract/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
  isCustomFieldValueValid,
} from "@/components/CustomFieldRenderer";
import AddressGroupRenderer, {
  getAddressFields,
  isAddressGroupValid,
} from "@/components/AddressGroupRenderer";
import Tooltip from "@/components/Tooltip";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";
import { FiInfo } from "react-icons/fi";

// Map admin field labels to backend columns; unmapped labels go to custom_fields JSONB
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Job Title": "jobTitle", Title: "jobTitle",
  "Hiring Manager": "hiringManager", "Hiring Manager Name": "hiringManager",
  "Job Description": "jobDescription", Description: "jobDescription",
  "Status": "status", "Job Status": "status",
  "Organization": "organizationId", "Organization Name": "organizationId", Company: "organizationId",
};

/** Normalize label for comparison: lowercase, collapse spaces, normalize % and punctuation */
function normalizeLabelForMatch(label: string | null | undefined): string {
  if (label == null) return "";
  return String(label)
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/[_\s]+/g, " ")
    .trim();
}

/** Find the custom field whose label best matches one of the candidate labels (exact > includes > word overlap). */
function findFieldByLabelMatch<T extends { field_label?: string | null }>(
  fields: T[],
  ...candidateLabels: string[]
): T | null {
  if (!fields?.length || !candidateLabels.length) return null;
  const normalizedCandidates = candidateLabels.map(normalizeLabelForMatch).filter(Boolean);
  if (!normalizedCandidates.length) return null;

  let best: { field: T; score: number } | null = null;

  for (const field of fields) {
    const fieldNorm = normalizeLabelForMatch(field.field_label);
    if (!fieldNorm) continue;
    for (const cand of normalizedCandidates) {
      if (fieldNorm === cand) {
        return field; // exact match wins
      }
      let score = 0;
      if (fieldNorm.includes(cand) || cand.includes(fieldNorm)) score = 0.8;
      else {
        const fieldWords = new Set(fieldNorm.split(/\s+/).filter(Boolean));
        const candWords = cand.split(/\s+/).filter(Boolean);
        const overlap = candWords.filter((w) => fieldWords.has(w)).length;
        if (candWords.length) score = overlap / candWords.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { field, score };
      }
    }
  }
  return best?.field ?? null;
}

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
    return options
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
          {filteredOptions.map((opt) => (
            <button
              key={opt}
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

export default function AddJob() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const jobId = searchParams.get("id"); // Get job ID from URL if present (edit mode)
  const cloneFrom = searchParams.get("cloneFrom"); // Clone from this job ID (prefill, new job)
  const jobType = searchParams.get("type") || "contract"; // Contract page - always contract
  const leadId = searchParams.get("leadId") || searchParams.get("lead_id");
  const organizationIdFromUrl =
    searchParams.get("organizationId") || searchParams.get("organization_id");
  const hiringManagerIdFromUrl = searchParams.get("hiringManagerId");
  const hasPrefilledFromLeadRef = useRef(false);
  const hasPrefilledOrgRef = useRef(false);
  const [selectedJobType, setSelectedJobType] = useState<string>("");
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
  const [orgHmStepCompleted, setOrgHmStepCompleted] = useState(false);

  // Handle job type selection and redirect
  const handleJobTypeSelect = (type: string) => {
    setSelectedJobType(type);
    // Preserve all params from URL and state when switching type
    const params = new URLSearchParams();
    if (leadId) params.append("leadId", leadId);
    if (organizationIdFromUrl) params.append("organizationId", organizationIdFromUrl);
    const hmId = hiringManagerIdFromUrl?.trim() || hiringManagerValue?.trim() || "";
    if (hmId) params.append("hiringManagerId", hmId);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";

    if (type === "direct-hire") {
      router.push(`/dashboard/jobs/add/direct-hire${query}`);
    } else if (type === "executive-search") {
      router.push(`/dashboard/jobs/add/executive-search${query}`);
    } else if (type === "contract") {
      router.push(`/dashboard/jobs/add/contract${query}`);
    }
  };

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When URL has organizationId or hiringManagerId, user must select HM in first step; we then hide the HM custom field on the form.
  const requireHiringManagerFromUrl = Boolean(organizationIdFromUrl || hiringManagerIdFromUrl);
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues, // ✅ Extract setCustomFieldValues
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("jobs");

  const hiringManagerCustomField = useMemo(() => {
    return customFields.find((f) => {
      const label = String(f.field_label || "").trim().toLowerCase();
      return label === "hiring manager" || label.includes("hiring manager");
    });
  }, [customFields]);

  // Resolve the Organization custom field once (prefer label match, fallback to legacy Field_3)
  const organizationField = useMemo(
    () =>
      customFields.find(
        (f) => String(f.field_label || "").trim().toLowerCase() === "organization"
      ) || customFields.find((f) => f.field_name === "Field_3"),
    [customFields]
  );

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

  // From organization view (Add Job in dropdown): require HM first, then type selection. No modal.
  const fromOrganizationAddJob = Boolean(organizationIdFromUrl && !jobId);
  const showOrgHmFirstStep =
    fromOrganizationAddJob && !jobType && !orgHmStepCompleted;

  // Show landing (type selection) when creating new job and not on org HM-first step
  const showLandingPage = !jobId && !jobType && !showOrgHmFirstStep;

  useEffect(() => {
    setJobStep(jobId || cloneFrom ? 3 : 2);
  }, [jobId, cloneFrom]);

  // Always show the form on the Contract page once we're not in a loading state.
  // The Hiring Manager + type selection flow happens on the main Add Job page,
  // so this route should not gate the form on organization/hiring manager params.
  useEffect(() => {
    if (isEditMode) {
      setJobStep(3);
      return;
    }
    if (!jobId) {
      setJobStep(3);
    }
  }, [jobId, isEditMode]);

  // Fetch HMs for: (1) org HM-first step, (2) form inline dropdown / modal (add and edit mode)
  const needHiringManagerOptions =
    showOrgHmFirstStep || (jobStep === 3 && (organizationIdFromUrl || currentOrganizationId || !organizationIdFromUrl));
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
          console.error("Failed to fetch hiring managers:", response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          console.error("Error details:", errorData);
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
  }, [
    needHiringManagerOptions,
    currentOrganizationId,
    organizationIdFromUrl,
  ]);



  // Sort custom fields by sort_order
  const sortedCustomFields = useMemo(
    () =>
      [...customFields].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      ),
    [customFields]
  );

  // Calculate address fields once using useMemo
  const addressFields = useMemo(
    () => getAddressFields(customFields as any),
    [customFields]
  );
  const addressAnchorId = useMemo(
    () => (addressFields.length ? addressFields[0].id : null),
    [addressFields]
  );

  // Resolve Pay Rate, Mark-up %, and Client Bill Rate by label match (closest match)
  const payRateField = useMemo(
    () => findFieldByLabelMatch(customFields, "Pay Rate", "pay rate"),
    [customFields]
  );
  const markUpField = useMemo(
    () =>
      findFieldByLabelMatch(
        customFields,
        "Mark-up %",
        "Mark-up",
        "Mark up",
        "Mark up %",
        "mark up percent",
        "Markup %",
        "Markup"
      ),
    [customFields]
  );
  const clientBillRateField = useMemo(
    () =>
      findFieldByLabelMatch(
        customFields,
        "Client Bill Rate",
        "client bill rate"
      ),
    [customFields]
  );

  // Compute Client Bill Rate from Pay Rate × (1 + Mark-up % / 100) and sync to form
  useEffect(() => {
    if (!clientBillRateField || !payRateField || !markUpField) return;
    const payRaw = customFieldValues[payRateField.field_name];
    const markUpRaw = customFieldValues[markUpField.field_name];
    const payNum = parseFloat(String(payRaw ?? "").trim());
    const markUpNum = parseFloat(String(markUpRaw ?? "").replace(/%/g, "").trim());
    if (Number.isNaN(payNum) || Number.isNaN(markUpNum)) {
      return;
    }
    const computed = payNum * (1 + markUpNum / 100);
    const formatted =
      computed % 1 === 0
        ? String(Math.round(computed))
        : computed.toFixed(2);
    const current = customFieldValues[clientBillRateField.field_name];
    if (current === formatted) return;
    setCustomFieldValues((prev) => ({
      ...prev,
      [clientBillRateField.field_name]: formatted,
    }));
  }, [
    clientBillRateField,
    payRateField,
    markUpField,
    customFieldValues[payRateField?.field_name ?? ""],
    customFieldValues[markUpField?.field_name ?? ""],
    setCustomFieldValues,
  ]);

  // Helper to normalize a label into a canonical address role
  const getAddressRoleFromLabel = (
    label: string | null | undefined
  ):
    | "address"
    | "address2"
    | "city"
    | "state"
    | "zip"
    | null => {
    const n = (label || "").toLowerCase().trim();
    if (!n) return null;
    if (n === "address" || n === "address1" || n === "street address") return "address";
    if (n === "address2" || n === "address 2") return "address2";
    if (n === "city") return "city";
    if (n === "state" || n === "state/province" || n === "province") return "state";
    if (n === "zip" || n === "zip code" || n === "postal code" || n === "postcode") return "zip";
    return null;
  };

  // Initialize with default fields
  useEffect(() => {
    initializeFields();
  }, []);

  // Fetch organization name if organizationId is provided
  const fetchOrganizationName = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        const orgName = data.organization?.name || "";
        setOrganizationName(orgName);
        setCurrentOrganizationId(orgId);
        // Prefill organizationId in form with organization name for display
        setFormFields((prev) =>
          prev.map((f) =>
            f.name === "organizationId"
              ? { ...f, value: orgName || orgId, locked: true }
              : f
          )
        );
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
      // Still set the organizationId even if fetch fails
      setCurrentOrganizationId(orgId);
      setFormFields((prev) =>
        prev.map((f) =>
          f.name === "organizationId"
            ? { ...f, value: orgId, locked: true }
            : f
        )
      );
    }
  };

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

  // Set Organization custom field when organizations load if organizationIdFromUrl is present.
  // This is a backup in case organizations load before the API call in prefill effect completes.
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!organizationIdFromUrl) return;
    if (organizations.length === 0) return; // Wait for organizations to load
    if (customFieldsLoading || !organizationField) return; // Wait for custom fields / org field

    // Find organization by ID
    const foundOrg = organizations.find(
      (org) => org.id.toString() === organizationIdFromUrl
    );

    if (foundOrg && foundOrg.name) {
      setCustomFieldValues((prev) => {
        // Only set if not already set (don't override if already set by prefill effect or user)
        if (prev[organizationField.field_name]) return prev;

        const fieldType = String((organizationField as any).field_type || "").toLowerCase();
        const lookupType = String((organizationField as any).lookup_type || "").toLowerCase();
        // For lookup-to-organizations fields, store the ID; for plain selects, store the label so validation passes.
        const storedValue =
          fieldType === "lookup" || lookupType === "organizations"
            ? organizationIdFromUrl
            : foundOrg.name;

        return {
          ...prev,
          [organizationField.field_name]: storedValue,
        };
      });
      setOrganizationName(foundOrg.name);
      setCurrentOrganizationId(organizationIdFromUrl);
    }
  }, [organizations, organizationIdFromUrl, jobId, customFieldsLoading, organizationField, setCustomFieldValues]);

  // Auto-populate Field_507 (Account Manager) with logged-in user's name
  // useEffect(() => {
  //   // Wait for customFields to load
  //   if (customFieldsLoading || customFields.length === 0) return;

  //   // Find Field_507 specifically
  //   const accountManagerField = customFields.find(
  //     (f) =>
  //       f.field_name === "Field_507" ||
  //       f.field_name === "field_507" ||
  //       f.field_name?.toLowerCase() === "field_507"
  //   );

  //   if (accountManagerField) {
  //     const currentValue = customFieldValues[accountManagerField.field_name];
  //     // Only auto-populate if field is empty (works in both create and edit mode)
  //     if (!currentValue || currentValue.trim() === "") {
  //       try {
  //         const userDataStr = getCookie("user");
  //         if (userDataStr) {
  //           const userData = JSON.parse(userDataStr as string);
  //           if (userData.name) {
  //             setCustomFieldValues((prev) => ({
  //               ...prev,
  //               [accountManagerField.field_name]: userData.name,
  //             }));
  //             console.log(
  //               "Auto-populated Field_507 (Account Manager) with current user:",
  //               userData.name
  //             );
  //           }
  //         }
  //       } catch (e) {
  //         console.error("Error parsing user data from cookie:", e);
  //       }
  //     }
  //   }
  // }, [
  //   customFields,
  //   customFieldsLoading,
  //   customFieldValues,
  //   setCustomFieldValues,
  // ]);

  // Sync currentOrganizationId with Organization custom field value when it changes
  useEffect(() => {
    if (customFieldsLoading || !organizationField) return;
    const fieldValue = customFieldValues[organizationField.field_name] || "";
    if (!fieldValue) return;
    // Lookup stores org id; legacy select may store name or id
    const selectedOrg = organizations.find(
      (org) => org.name === fieldValue || org.id.toString() === fieldValue
    );
    const newOrgId = selectedOrg ? selectedOrg.id.toString() : fieldValue;
    if (newOrgId && newOrgId !== currentOrganizationId) {
      setCurrentOrganizationId(newOrgId);
    }
  }, [
    customFieldValues[organizationField?.field_name ?? ""],
    organizations,
    customFieldsLoading,
    organizationField,
    currentOrganizationId,
  ]);

  // When selected organization changes (from URL or from form), fetch org and auto-fill address; address stays editable
  useEffect(() => {
    if (!currentOrganizationId || addressFields.length === 0) return;

    const fetchOrgAndPrefillAddress = async () => {
      try {
        const response = await fetch(`/api/organizations/${currentOrganizationId}`);
        if (!response.ok) return;
        const data = await response.json();
        const org = data.organization;
        if (!org) return;

        const orgAddress: {
          address?: string;
          address2?: string;
          city?: string;
          state?: string;
          zip?: string;
        } = {};

        if (org.address) {
          orgAddress.address = String(org.address);
        }

        if (org.custom_fields) {
          let orgCustomFields: Record<string, any> = {};
          try {
            orgCustomFields =
              typeof org.custom_fields === "string"
                ? JSON.parse(org.custom_fields)
                : org.custom_fields;
          } catch (e) {
            console.error("Error parsing organization custom_fields for address prefill:", e);
          }
          Object.entries(orgCustomFields).forEach(([label, value]) => {
            const role = getAddressRoleFromLabel(label);
            if (!role) return;
            if (orgAddress[role]) return;
            if (value === undefined || value === null) return;
            const v = String(value).trim();
            if (!v) return;
            orgAddress[role] = v;
          });
        }

        setCustomFieldValues((prev) => {
          const next = { ...prev };
          addressFields.forEach((addrField) => {
            const role = getAddressRoleFromLabel(addrField.field_label);
            if (!role) return;
            const value = orgAddress[role];
            if (value != null && String(value).trim() !== "") {
              next[addrField.field_name] = value;
            }
          });
          return next;
        });
      } catch (e) {
        console.error("Error fetching organization for address prefill:", e);
      }
    };

    fetchOrgAndPrefillAddress();
  }, [currentOrganizationId, addressFields, setCustomFieldValues]);

  // Prefill organizationId from URL if provided (create mode only)
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!organizationIdFromUrl) return;
    if (hasPrefilledOrgRef.current) return;
    if (formFields.length === 0) return;
    if (customFieldsLoading) return; // Wait for custom fields to load
    if (customFields.length === 0) return; // Wait for custom fields to be available

    hasPrefilledOrgRef.current = true;
    // Set currentOrganizationId immediately so hiring manager fetch works
    setCurrentOrganizationId(organizationIdFromUrl);

    // Fetch organization name and set both formFields and Organization custom field
    const fetchAndSetOrganization = async () => {
      try {
        const response = await fetch(`/api/organizations/${organizationIdFromUrl}`);
        if (response.ok) {
          const data = await response.json();
          const orgName = data.organization?.name || "";
          const org = data.organization;
          setOrganizationName(orgName);

          // Address is prefilled by the "when selected organization changes" effect below

          // Set Organization custom field if it exists.
          // For lookup fields, store the ID; for plain selects, store the label.
          if (organizationField) {
            setCustomFieldValues((prev) => {
              // Only set if not already set (don't override user input)
              if (prev[organizationField.field_name]) return prev;
              const fieldType = String((organizationField as any).field_type || "").toLowerCase();
              const lookupType = String((organizationField as any).lookup_type || "").toLowerCase();
              const storedValue =
                fieldType === "lookup" || lookupType === "organizations"
                  ? organizationIdFromUrl
                  : orgName || organizationIdFromUrl;
              return {
                ...prev,
                [organizationField.field_name]: storedValue,
              };
            });
          }

          // Also set the old formFields for backward compatibility
          setFormFields((prev) =>
            prev.map((f) =>
              f.name === "organizationId"
                ? { ...f, value: orgName || organizationIdFromUrl, locked: true }
                : f
            )
          );
        } else {
          // If fetch fails, try to find organization in already-loaded organizations list
          if (organizations.length > 0) {
            const foundOrg = organizations.find(
              (org) => org.id.toString() === organizationIdFromUrl
            );
            if (foundOrg && foundOrg.name) {
              if (organizationField) {
                setCustomFieldValues((prev) => {
                  if (prev[organizationField.field_name]) return prev;
                  const fieldType = String((organizationField as any).field_type || "").toLowerCase();
                  const lookupType = String((organizationField as any).lookup_type || "").toLowerCase();
                  const storedValue =
                    fieldType === "lookup" || lookupType === "organizations"
                      ? organizationIdFromUrl
                      : foundOrg.name;
                  return {
                    ...prev,
                    [organizationField.field_name]: storedValue,
                  };
                });
              }
              setOrganizationName(foundOrg.name);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching organization:", error);
        // Still set the organizationId even if fetch fails
        setCurrentOrganizationId(organizationIdFromUrl);
        setFormFields((prev) =>
          prev.map((f) =>
            f.name === "organizationId"
              ? { ...f, value: organizationIdFromUrl, locked: true }
              : f
          )
        );
      }
    };

    fetchAndSetOrganization();
  }, [organizationIdFromUrl, jobId, formFields.length, customFieldsLoading, customFields, organizations, setCustomFieldValues]);

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
    // These are the standard fields
    const standardFields: FormField[] = [
      {
        id: "jobTitle",
        name: "jobTitle",
        label: "Job Title",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "category",
        name: "category",
        label: "Category",
        type: "select",
        required: false,
        visible: true,
        options: [
          "Payroll",
          "IT",
          "Finance",
          "Marketing",
          "Human Resources",
          "Operations",
          "Sales",
        ],
        value: "Payroll",
      },
      {
        id: "organization",
        name: "organizationId",
        label: "Organization",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "hiringManager",
        name: "hiringManager",
        label: "Hiring Manager",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "status",
        name: "status",
        label: "Status",
        type: "select",
        required: false,
        visible: true,
        options: ["Open", "On Hold", "Filled", "Closed"],
        value: "Open",
      },
      {
        id: "priority",
        name: "priority",
        label: "Priority",
        type: "select",
        required: false,
        visible: true,
        options: ["A", "B", "C"],
        value: "A",
      },
      {
        id: "employmentType",
        name: "employmentType",
        label: "Employment Type",
        type: "select",
        required: false,
        visible: true,
        options: [
          "Full-time",
          "Part-time",
          "Contract",
          "Temp to Hire",
          "Temporary",
          "Internship",
        ],
        value: "Temp to Hire",
      },
      {
        id: "startDate",
        name: "startDate",
        label: "Start Date",
        type: "date",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "worksiteLocation",
        name: "worksiteLocation",
        label: "Worksite Location",
        type: "text",
        required: false,
        visible: true,
        placeholder: "Address, City, State, Zip",
        value: "",
      },
      {
        id: "remoteOption",
        name: "remoteOption",
        label: "Remote Option",
        type: "select",
        required: false,
        visible: true,
        options: ["On-site", "Remote", "Hybrid"],
        value: "On-site",
      },
      {
        id: "jobDescription",
        name: "jobDescription",
        label: "Job Description",
        type: "textarea",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "jobDescriptionFile",
        name: "jobDescriptionFile",
        label: "Upload Job Description",
        type: "file",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "minSalary",
        name: "minSalary",
        label: "Minimum Salary",
        type: "number",
        required: false,
        visible: true,
        value: "",
        placeholder: "e.g. 50000",
      },
      {
        id: "maxSalary",
        name: "maxSalary",
        label: "Maximum Salary",
        type: "number",
        required: false,
        visible: true,
        value: "",
        placeholder: "e.g. 70000",
      },
      {
        id: "benefits",
        name: "benefits",
        label: "Benefits",
        type: "textarea",
        required: false,
        visible: true,
        value: "",
        placeholder: "Enter benefits separated by new lines",
      },
      {
        id: "requiredSkills",
        name: "requiredSkills",
        label: "Required Skills",
        type: "textarea",
        required: false,
        visible: true,
        value: "",
        placeholder: "Enter required skills separated by commas",
      },
      {
        id: "jobBoardStatus",
        name: "jobBoardStatus",
        label: "Job Board Status",
        type: "select",
        required: false,
        visible: true,
        options: ["Not Posted", "Posted", "Featured"],
        value: "Not Posted",
      },
      {
        id: "owner",
        name: "owner",
        label: "Owner",
        type: "text",
        required: false,
        visible: true,
        value: "Employee 1",
      },
      {
        id: "dateAdded",
        name: "dateAdded",
        label: "Date Added",
        type: "date",
        required: false,
        visible: true,
        value: new Date().toISOString().split("T")[0],
      },
    ];

    setFormFields(standardFields);
  };

  // Load job data when in edit mode or clone mode
  useEffect(() => {
    const idToLoad = jobId || cloneFrom;
    if (idToLoad && formFields.length > 0 && !customFieldsLoading) {
      fetchJobData(idToLoad, !!cloneFrom);
    }
  }, [jobId, cloneFrom, formFields.length, customFieldsLoading]);

  // Function to fetch job data (✅ Updated to match Organizations pattern). When isClone, Date Added is set to today.
  const fetchJobData = async (id: string, isClone?: boolean) => {
    setIsLoadingJob(true);
    setLoadError(null);

    try {
      console.log(`Fetching job data for ID: ${id}`);
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

      // ✅ Map custom fields from field_label (database key) to field_name (form key)
      // Custom fields are stored with field_label as keys, but form uses field_name
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

      // ✅ Second, map standard job fields to custom fields based on field labels
      // This ensures that standard fields like "job_title", "status" etc. populate custom fields
      // with matching labels like "Job Title", "Status", etc.
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

      // Update formFields with existing job data
      setFormFields((prevFields) => {
        const updatedFields = [...prevFields];

        // Helper function to find and update a field
        const updateField = (id: string, value: any) => {
          const fieldIndex = updatedFields.findIndex(
            (field) => field.id === id
          );
          if (fieldIndex !== -1) {
            updatedFields[fieldIndex] = {
              ...updatedFields[fieldIndex],
              value: value !== null && value !== undefined ? String(value) : "",
            };
          }
        };

        // Update standard fields
        updateField("jobTitle", job.job_title);
        updateField("category", job.category);
        updateField(
          "organization",
          job.organization_id || job.organization_name
        );
        updateField("hiringManager", job.hiring_manager);
        updateField("status", job.status);
        updateField("priority", job.priority);
        updateField("employmentType", job.employment_type);
        updateField(
          "startDate",
          job.start_date ? job.start_date.split("T")[0] : ""
        );
        updateField("worksiteLocation", job.worksite_location);
        updateField("remoteOption", job.remote_option);
        updateField("jobDescription", job.job_description);
        updateField("minSalary", job.min_salary);
        updateField("maxSalary", job.max_salary);
        updateField("benefits", job.benefits);
        updateField("requiredSkills", job.required_skills);
        updateField("jobBoardStatus", job.job_board_status);
        updateField("owner", job.owner);
        updateField(
          "dateAdded",
          isClone ? new Date().toISOString().split("T")[0] : (job.date_added ? job.date_added.split("T")[0] : "")
        );

        return updatedFields;
      });

      // ✅ Set the mapped custom field values (field_name as keys) - same as Organizations
      setCustomFieldValues(mappedCustomFieldValues);

      console.log("Job data loaded successfully");
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

    // Only require Hiring Manager when coming from org flow AND a Hiring Manager custom field exists.
    // If there's no custom field, we still allow saving and just persist the ID from the URL.
    const requireHiringManager =
      !isEditMode && requireHiringManagerFromUrl && Boolean(hiringManagerCustomField);
    if (requireHiringManager) {
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
      const payload = formFields.reduce((acc, field) => {
        if (field.visible) acc[field.name] = field.value;
        return acc;
      }, {} as Record<string, any>);

      const customFieldsToSend = getCustomFieldsForSubmission();
      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit).
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          payload[column] = value;
        }
        // Always store every field in custom_fields so all fields are persisted there
        customFieldsForDB[label] = value;
      });

      const allowedStatus = ["Open", "On Hold", "Filled", "Closed"];
      const statusRaw = payload.status || "Open";
      payload.status = allowedStatus.includes(statusRaw) ? statusRaw : "Open";
      payload.organizationId = organizationIdFromUrl || currentOrganizationId || payload.organizationId || "";
      // Always persist a hiring manager when we have one, even if there's no Hiring Manager custom field.
      // Prefer the custom field value (when present), otherwise fall back to the URL param.
      const hiringManagerFromCustom =
        hiringManagerCustomField && customFieldsToSend[hiringManagerCustomField.field_label];
      const hiringManagerFinal =
        (hiringManagerFromCustom != null && String(hiringManagerFromCustom).trim() !== ""
          ? hiringManagerFromCustom
          : hiringManagerIdFromUrl) || "";
      if (hiringManagerFinal) {
        payload.hiringManager = String(hiringManagerFinal).trim();
      }
      payload.jobType = jobType;
      payload.custom_fields = customFieldsForDB;

      const finalPayload: Record<string, any> = payload;

      console.log(`${isEditMode ? "Updating" : "Creating"} job payload:`, finalPayload);

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
        throw new Error(data.message || `Failed to ${isEditMode ? "update" : "create"} job`);
      }

      const resultId = isEditMode ? jobId : data.job?.id;
      // Navigate based on where we came from
      // If we came from organization page, navigate back there
      if (organizationIdFromUrl && !isEditMode) {
        router.push(`/dashboard/organizations/view?id=${organizationIdFromUrl}`);
      } else {
        router.push(resultId ? `/dashboard/jobs/view?id=${resultId}` : "/dashboard/jobs");
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} job:`, err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };




  const handleGoBack = () => {
    router.back();
  };

  const formValidation = useMemo(() => validateCustomFields(), [customFieldValues, isEditMode, validateCustomFields]);
  const isFormValid = formValidation.isValid;

  // From organization view: first step — select Hiring Manager (inline, no modal), then type selection
  if (showOrgHmFirstStep) {
    if (customFieldsLoading || !hiringManagerCustomField) {
      return <LoadingScreen message="Loading..." />;
    }
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
            <div className="flex items-center">
              <div className="bg-red-100 border border-red-300 p-2 mr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-bold">Add Job</h1>
            </div>
            <button
              onClick={handleGoBack}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
              aria-label="Close"
            >
              X
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <label className="w-48 font-medium shrink-0">Hiring Manager:</label>
              <div className="flex-1">
                <HiringManagerSearchSelect
                  value={hiringManagerValue}
                  options={hiringManagerOptions}
                  onChange={(id, opt) => {
                    if (!hiringManagerCustomField) return;
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
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hiringManagerValue?.trim()}
                onClick={() => setOrgHmStepCompleted(true)}
                className={`px-4 py-2 rounded text-white ${!hiringManagerValue?.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
                  }`}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show landing page for new job creation (show immediately, don't wait for custom fields)
  if (showLandingPage) {
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
            <div className="flex items-center">
              <div className="bg-red-100 border border-red-300 p-2 mr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-bold">Add Job</h1>
            </div>
            <button
              onClick={handleGoBack}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
              aria-label="Close"
            >
              X
            </button>
          </div>

          {/* Job Type Options */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">

              {/* Contract */}
              <label
                className={`flex-1 border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedJobType === "contract"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-200 hover:border-blue-300"
                  }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="jobType"
                    value="contract"
                    checked={selectedJobType === "contract"}
                    onChange={(e) => handleJobTypeSelect(e.target.value)}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">
                    Contract
                  </span>
                </div>
              </label>

              {/* Direct Hire */}
              <label
                className={`flex-1 border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedJobType === "direct-hire"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-200 hover:border-blue-300"
                  }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="jobType"
                    value="direct-hire"
                    checked={selectedJobType === "direct-hire"}
                    onChange={(e) => handleJobTypeSelect(e.target.value)}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">
                    Direct Hire
                  </span>
                </div>
              </label>



              {/* Executive Search */}
              <label
                className={`flex-1 border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedJobType === "executive-search"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-200 hover:border-blue-300"
                  }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="jobType"
                    value="executive-search"
                    checked={selectedJobType === "executive-search"}
                    onChange={(e) => handleJobTypeSelect(e.target.value)}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">
                    Executive Search
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <LoadingScreen
        message={isEditMode ? "Updating job..." : "Creating job..."}
      />
    );
  }

  // Show loading screen when loading existing job data or custom fields
  if (isLoadingJob || customFieldsLoading) {
    return <LoadingScreen message="Loading job form..." />;
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
              alt="Job"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Job
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* <button
                            onClick={() => router.push('/dashboard/admin/field-mapping?section=jobs')}
                            className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded"
                        >
                            Manage Fields
                        </button> */}
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

        {/* Form: from org we already have HM; from job overview HM is inline (no modal) */}
        {/* Hide HM selection when already selected from org flow (organizationId + hiringManagerId in URL); show in simple add and edit mode */}
        {(isEditMode || jobStep === 3) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* {!isEditMode && hiringManagerCustomField && !(organizationIdFromUrl && hiringManagerIdFromUrl) && (
                <div className="flex items-center gap-4 mb-3">
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
                <div className="flex items-center gap-4 mb-3">
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

              {/* Custom Fields Section */}
              {customFields.length > 0 && (
                <>
                  {/* <div className="mt-8 mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                                        Additional Information
                                    </h3>
                                </div> */}

                  {sortedCustomFields.map((field) => {
                    // Don't render hidden fields at all (neither label nor input)
                    if (field.is_hidden) return null;

                    // When user came from org Add Job and already selected HM in first step, hide the HM field (label or lookup type hiring-managers) so it's not shown again.
                    const isHiringManagerField =
                      field.field_label === "Hiring Manager" ||
                      (field.field_type === "lookup" && field.lookup_type === "hiring-managers");
                    if (isHiringManagerField && !isEditMode && requireHiringManagerFromUrl) {
                      return null;
                    }

                    // ✅ Render Address Group exactly where first address field exists
                    if (
                      addressFields.length > 0 &&
                      addressAnchorId &&
                      field.id === addressAnchorId
                    ) {
                      return (
                        <div
                          key="address-group"
                          className="flex items-start mb-3"
                        >
                          <label className="w-48 font-medium flex items-center mt-4">
                            Address:
                          </label>

                          <div className="flex-1">
                            <AddressGroupRenderer
                              fields={addressFields}
                              values={customFieldValues}
                              onChange={handleCustomFieldChange}
                              isEditMode={isEditMode}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Skip address fields if they're being rendered in the grouped layout
                    // Compare by ID to ensure we filter correctly
                    const addressFieldIds = addressFields.map((f) => f.id);
                    if (addressFieldIds.includes(field.id)) {
                      return null;
                    }

                    const fieldValue = customFieldValues[field.field_name] || "";

                    // Client Bill Rate: only read-only if set in admin; when editable show info tooltip and clear Pay Rate / Mark-up % on change
                    const isClientBillRateField =
                      clientBillRateField && field.id === clientBillRateField.id;
                    const isClientBillRateEditable =
                      isClientBillRateField && !field.is_read_only;
                    const handleFieldChange = (name: string, value: any) => {
                      handleCustomFieldChange(name, value);
                      if (
                        isClientBillRateField &&
                        name === clientBillRateField!.field_name &&
                        payRateField &&
                        markUpField
                      ) {
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [payRateField.field_name]: "",
                          [markUpField.field_name]: "",
                        }));
                      }
                    };

                    return (
                      <div key={field.id} className="flex items-center gap-4 mb-3">
                        <label className="w-48 font-medium flex items-center">
                          {field.field_label}:
                          {isClientBillRateEditable && (
                            <Tooltip
                              text="Changing this value will clear Pay Rate and Mark-up %."
                              className="ml-2"
                            >
                              <FiInfo className="w-5 h-5 text-gray-600 shrink-0" aria-hidden />
                            </Tooltip>
                          )}
                        </label>

                        <div className="flex-1 relative">
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            onChange={isClientBillRateField ? handleFieldChange : handleCustomFieldChange}
                            allFields={customFields}
                            values={customFieldValues}
                            context={{ organizationId: currentOrganizationId || organizationIdFromUrl || "" }}
                            validationIndicator={
                              field.is_required
                                ? isCustomFieldValueValid(field, fieldValue)
                                  ? "valid"
                                  : "required"
                                : undefined
                            }
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
                          setFormFields((prev) =>
                            prev.map((f) =>
                              f.name === "hiringManager" ? { ...f, value: opt.name } : f
                            )
                          );
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
