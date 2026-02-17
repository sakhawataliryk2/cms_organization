// app/dashboard/jobs/add/page.tsx
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
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";

// Map admin field labels to backend columns; unmapped labels go to custom_fields JSONB
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Job Title": "jobTitle", Title: "jobTitle",
  "Hiring Manager": "hiringManager", "Hiring Manager Name": "hiringManager",
  "Job Description": "jobDescription", Description: "jobDescription",
  "Status": "status", "Job Status": "status",
  "Organization": "organizationId", "Organization Name": "organizationId", Company: "organizationId",
};

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
        className={`w-full p-2 border-b border-gray-300 focus-within:border-blue-500 flex items-center gap-2 bg-white ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
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
        {/* <span className="text-gray-400 pointer-events-none shrink-0">
          {isOpen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span> */}
      </div>
      {isOpen && (

        // {loading(
        //   <p className="text-sm text-gray-500 mt-1">Loading...</p>
        // ) : (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-sm max-h-56 overflow-auto"
        >
          {loading ? (
            <p className="px-3 py-4 text-sm text-gray-500 mt-1">Loading...</p>
          ) : (
            // {
            filteredOptions.length === 0 ? (
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
                  className={`w-full text-left px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 ${idx === highlightIndex ? "bg-blue-50" : ""
                    } ${String(opt.id) === value ? "font-medium text-blue-700" : ""}`}
                >
                  {opt.name}
                </button>
              ))
            )
            // }
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
  const jobType = searchParams.get("type"); // Get job type from URL if present
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

    // Build query string preserving existing params (incl. hiringManagerId from org flow)
    const params = new URLSearchParams();
    if (leadId) params.append("leadId", leadId);
    if (organizationIdFromUrl) params.append("organizationId", organizationIdFromUrl);
    if (hiringManagerValue?.trim()) params.append("hiringManagerId", hiringManagerValue);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";

    // Redirect based on selected type
    if (type === "direct-hire") {
      router.push(`/dashboard/jobs/add/direct-hire${query}`);
    } else if (type === "executive-search") {
      router.push(`/dashboard/jobs/add/executive-search${query}`);
    } else if (type === "contract") {
      router.push(`/dashboard/jobs/add/contract${queryString ? `?${queryString}` : ""}`);
    }
  };

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the custom fields hook (✅ Added setCustomFieldValues like Organizations)
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

  // Pre-populate hiring manager from URL when redirected from org flow (org → HM step → type selection)
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
    setJobStep(jobId ? 3 : 2);
  }, [jobId]);

  useEffect(() => {
    if (isEditMode) {
      setJobStep(3);
      return;
    }
    // From job overview: no HM step; go straight to form when type is selected
    if (jobType && !organizationIdFromUrl) {
      setJobStep(3);
      return;
    }
    if (hiringManagerValue && hiringManagerValue.trim() !== "") {
      setJobStep(3);
    }
  }, [hiringManagerValue, isEditMode, jobType, organizationIdFromUrl]);

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

  // Calculate Client Bill Rate (Field_13) from Pay Rate (Field_11) and Mark-up % (Field_12 or Field_512)
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

  // Auto-calculate Field_13 (Client Bill Rate) when Field_11 (Pay Rate) or Field_12/Field_512 (Mark-up %) changes
  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;

    const payRateField = customFields.find((f) => f.field_name === "Field_11");
    const markupField = customFields.find((f) => f.field_name === "Field_12" || f.field_name === "Field_512");
    const clientBillRateField = customFields.find((f) => f.field_name === "Field_13");

    if (payRateField && markupField && clientBillRateField) {
      const payRate = customFieldValues["Field_11"] || "";
      const markupPercent = customFieldValues["Field_12"] || customFieldValues["Field_512"] || "";

      if (payRate || markupPercent) {
        const calculatedBillRate = calculateClientBillRate(payRate, markupPercent);
        if (calculatedBillRate && calculatedBillRate !== (customFieldValues["Field_13"] || "")) {
          setCustomFieldValues((prev) => ({
            ...prev,
            Field_13: calculatedBillRate,
          }));
        }
      }
    }
  }, [
    customFields,
    customFieldsLoading,
    customFieldValues["Field_11"],
    customFieldValues["Field_12"],
    customFieldValues["Field_512"],
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

  // Set Field_3 when organizations load if organizationIdFromUrl is present
  // This is a backup in case organizations load before the API call in prefill effect completes
  useEffect(() => {
    if (jobId) return; // don't override edit mode
    if (!organizationIdFromUrl) return;
    if (organizations.length === 0) return; // Wait for organizations to load
    if (customFieldsLoading || customFields.length === 0) return; // Wait for custom fields

    // Find organization by ID
    const foundOrg = organizations.find(
      (org) => org.id.toString() === organizationIdFromUrl
    );

    if (foundOrg && foundOrg.name) {
      const orgField = customFields.find((f) => f.field_name === "Field_3");
      if (orgField) {
        setCustomFieldValues((prev) => {
          // Only set if not already set (don't override if already set by prefill effect or user)
          if (prev[orgField.field_name]) return prev;
          return {
            ...prev,
            Field_3: foundOrg.name,
          };
        });
        setOrganizationName(foundOrg.name);
        setCurrentOrganizationId(organizationIdFromUrl);
      }
    }
  }, [organizations, organizationIdFromUrl, jobId, customFieldsLoading, customFields, setCustomFieldValues]);

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

  // Sync currentOrganizationId with Organization field (Field_3) value when it changes
  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;
    const organizationField = customFields.find((f) => f.field_name === "Field_3");
    if (!organizationField) return;
    const fieldValue = customFieldValues["Field_3"] || "";
    if (!fieldValue) return;
    const selectedOrg = organizations.find(
      (org) => org.name === fieldValue || org.id.toString() === fieldValue
    );
    const newOrgId = selectedOrg ? selectedOrg.id.toString() : fieldValue;
    if (newOrgId && newOrgId !== currentOrganizationId) {
      setCurrentOrganizationId(newOrgId);
    }
  }, [customFieldValues["Field_3"], organizations, customFields, customFieldsLoading, currentOrganizationId]);

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

    // Fetch organization name and set both formFields and custom field Field_3
    const fetchAndSetOrganization = async () => {
      try {
        const response = await fetch(`/api/organizations/${organizationIdFromUrl}`);
        if (response.ok) {
          const data = await response.json();
          const orgName = data.organization?.name || "";
          setOrganizationName(orgName);

          // Set Field_3 (Organization custom field) if it exists
          // Use the organization name (which matches the dropdown option values)
          if (customFields.length > 0 && orgName) {
            const orgField = customFields.find((f) => f.field_name === "Field_3");
            if (orgField) {
              setCustomFieldValues((prev) => {
                // Only set if not already set (don't override user input)
                if (prev[orgField.field_name]) return prev;
                return {
                  ...prev,
                  Field_3: orgName,
                };
              });
            }
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
              const orgField = customFields.find((f) => f.field_name === "Field_3");
              if (orgField) {
                setCustomFieldValues((prev) => {
                  if (prev[orgField.field_name]) return prev;
                  return {
                    ...prev,
                    Field_3: foundOrg.name,
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

    if (!isEditMode) {
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

  const isFormValid = useMemo(() => {
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) return false;
    if (!isEditMode) {
      if (!hiringManagerCustomField) return false;
      if (!hiringManagerValue || String(hiringManagerValue).trim() === "") return false;
    }
    return true;
  }, [customFieldValues, isEditMode, hiringManagerCustomField, hiringManagerValue, validateCustomFields]);

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
              {!isEditMode && hiringManagerCustomField && !(organizationIdFromUrl && hiringManagerIdFromUrl) && (
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
              )}
              {isEditMode && (
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
              )}
              {/* Standard Job Fields */}
              {/* {formFields
                            .filter(field => field.visible)
                            .map((field, index) => (
                                <div key={field.id} className="flex items-center">
            
            <label className="w-48 font-medium">
                                        {field.label}:
                                    </label>

            
            <div className="flex-1 relative">
                                        {field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'url' ? (
                                            <input
                                                type={field.type}
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                                readOnly={field.locked}
                                                disabled={field.locked}
                                            />
                                        ) : field.type === 'number' ? (
                                            <input
                                                type="number"
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'date' ? (
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    name={field.name}
                                                    value={field.value}
                                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                                    className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                    required={field.required}
                                                />
                                            </div>
                                        ) : field.type === 'select' ? (
                                            <select
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                                                required={field.required}
                                            >
                                                {!field.required && <option value="">Select {field.label}</option>}
                                                {field.options?.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                rows={field.name === 'jobDescription' ? 5 : 3}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'file' ? (
                                            <div>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.doc,.docx"
                                                    onChange={handleFileChange}
                                                    className="w-full p-2 text-gray-700"
                                                    required={field.required}
                                                />
                                                <p className="text-sm text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX</p>
                                            </div>
                                        ) : null}

                                        {field.required && (
                                            <span className="absolute text-red-500 left-[-10px] top-2">*</span>
                                        )}
                                    </div>
            </div>
             ))} */}

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

                    if (field.field_label === "Hiring Manager" && !isEditMode) {
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
                            {addressFields.some((f) => f.is_required) &&
                              (isAddressGroupValid(addressFields, customFieldValues) ? (
                                <span className="text-green-500 ml-1">✔</span>
                              ) : (
                                <span className="text-red-500 ml-1">*</span>
                              ))}
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

                    // Special handling for Field_11 (Pay Rate), Field_12/Field_512 (Mark-up %), and Field_13 (Client Bill Rate)
                    // Field_13 is calculated from Field_11 and Field_12/Field_512
                    if (field.field_name === "Field_11" || field.field_name === "Field_12" || field.field_name === "Field_512" || field.field_name === "Field_13") {
                      const isCalculatedField = field.field_name === "Field_13";
                      const payRateValue = customFieldValues["Field_11"] || "";
                      const markupValue = customFieldValues["Field_12"] || customFieldValues["Field_512"] || "";
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
                              // Field_13 is read-only and shows calculated value
                              <input
                                type="text"
                                value={calculatedValue || fieldValue}
                                readOnly
                                className="w-full p-2 border-b border-gray-300 bg-gray-50 text-gray-700 cursor-not-allowed"
                                placeholder="Auto-calculated"
                              />
                            ) : (
                              // Field_11, Field_12, and Field_512 are editable
                              <CustomFieldRenderer
                                field={field}
                                value={fieldValue}
                                onChange={handleCustomFieldChangeWithCalculation}
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

                    // return (
                    //   <div key={field.id} className="flex items-center">
                    //     <label className="w-48 font-medium">
                    //       {field.field_label}:
                    //       {field.is_required && (
                    //         <span className="text-red-500 ml-1">*</span>
                    //       )}
                    //     </label>
                    //     <div className="flex-1 relative">
                    //       <CustomFieldRenderer
                    //         field={field}
                    //         value={customFieldValues[field.field_name]}
                    //         onChange={handleCustomFieldChange}
                    //       />
                    //       {/* {field.is_required && (
                    //                                   <span className="absolute text-red-500 left-[-10px] top-2">
                    //                                       *
                    //                                   </span>
                    //                               )} */}
                    //     </div>
                    //   </div>
                    // );
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
