"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useMultipleAdd } from "@/contexts/MultipleAddContext";
import CustomFieldRenderer, {
  useCustomFields,
  isCustomFieldValueValid,
} from "@/components/CustomFieldRenderer";
import AddressGroupRenderer, {
  getAddressFields,
} from "@/components/AddressGroupRenderer";

interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  options?: string[] | string | Record<string, unknown> | null;
  placeholder?: string;
  default_value?: string;
  sort_order: number;
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
  | "number";
  required: boolean;
  visible: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  value: string;
  locked?: boolean; // For locked fields like last contact date
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Map admin field labels to backend columns; unmapped labels go to custom_fields JSONB
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "First Name": "firstName", First: "firstName", FName: "firstName",
  "Last Name": "lastName", Last: "lastName", LName: "lastName",
  "Email": "email", "Email 1": "email", "Email Address": "email", "E-mail": "email",
  "Phone": "phone", "Phone Number": "phone", Telephone: "phone",
  "Mobile Phone": "mobilePhone", Mobile: "mobilePhone", "Cell Phone": "mobilePhone",
  "Address": "address", "Street Address": "address", "Address 1": "address",
  "City": "city",
  "State": "state",
  "ZIP Code": "zip", ZIP: "zip", ZipCode: "zip", "Postal Code": "zip",
  "Status": "status", "Current Status": "status",
  "Current Organization": "currentOrganization", "Organization": "currentOrganization",
  "Title": "title", "Job Title": "title", Position: "title",
  "Resume Text": "resumeText", "Resume": "resumeText",
  "Skills": "skills",
  "Desired Salary": "desiredSalary", "Salary": "desiredSalary",
  "Owner": "owner", "Assigned To": "owner", "Assigned Owner": "owner",
  "Date Added": "dateAdded", "Date Created": "dateAdded",
};

/** Stable internal names — labels resolved via /api/custom-fields/field-label (submission keys = field_label). */
const JS_DUP_EMAIL_FIELD_NAME = "Field_8";
const JS_DUP_PRIMARY_PHONE_FIELD_NAME = "Field_11";

function valueFromSubmissionByLabel(
  submission: Record<string, unknown>,
  label: string | null | undefined
): string {
  if (!label) return "";
  const v = submission[label];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function labelForFieldNameFromDefinitions(
  fields: Array<{ field_name?: string; field_label?: string | null }>,
  fieldName: string
): string | null {
  const f = fields.find(
    (x) =>
      x.field_name === fieldName ||
      (x.field_name != null &&
        x.field_name.toLowerCase() === fieldName.toLowerCase())
  );
  const l = f?.field_label != null ? String(f.field_label).trim() : "";
  return l || null;
}

function fieldDefByStableName(
  fields: CustomFieldDefinition[],
  stableName: string
): CustomFieldDefinition | undefined {
  const lower = stableName.toLowerCase();
  return fields.find(
    (x) => x.field_name === stableName || x.field_name?.toLowerCase() === lower
  );
}

type JSDupMatch = { id: string | number; name: string };

function emailDupCacheKey(
  excludeId: string,
  emailLabel: string | null | undefined,
  phoneLabel: string | null | undefined,
  email: string
): string {
  return `email|ex:${excludeId}|el:${emailLabel ?? ""}|pl:${phoneLabel ?? ""}|e:${email}`;
}

function phoneDupCacheKey(
  excludeId: string,
  emailLabel: string | null | undefined,
  phoneLabel: string | null | undefined,
  phone: string
): string {
  return `phone|ex:${excludeId}|el:${emailLabel ?? ""}|pl:${phoneLabel ?? ""}|p:${phone}`;
}

// Parsed resume shape from POST /api/parse-resume (AI)
interface ParsedResume {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  location?: string;
  linkedin: string;
  portfolio: string;
  current_job_title: string;
  total_experience_years: string;
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string }>;
  work_experience: Array<{
    company: string;
    job_title: string;
    start_date: string;
    end_date: string;
    description: string;
  }>;
  custom_fields?: Record<string, string>;
}

// Labels that receive the same value from parsed resume (for custom field mapping)
const LABELS_FOR_FIRST_NAME = ["First Name", "First", "FName"];
const LABELS_FOR_LAST_NAME = ["Last Name", "Last", "LName"];
const LABELS_FOR_EMAIL = ["Email", "Email 1", "Email Address", "E-mail"];
const LABELS_FOR_PHONE = ["Phone", "Phone Number", "Telephone"];
const LABELS_FOR_MOBILE = ["Mobile Phone", "Mobile", "Cell Phone"];
const LABELS_FOR_ADDRESS = ["Address", "Street Address", "Address 1"];
const LABELS_FOR_ADDRESS_2 = ["Address 2", "Suite", "Apt", "Apartment", "Floor"];
const LABELS_FOR_CITY = ["City"];
const LABELS_FOR_STATE = ["State"];
const LABELS_FOR_ZIP = ["ZIP Code", "ZIP", "Zip Code", "Postal Code"];
const LABELS_FOR_TITLE = ["Title", "Job Title", "Position"];
const LABELS_FOR_RESUME_TEXT = ["Resume Text", "Resume", "CV"];
const LABELS_FOR_SKILLS = ["Skills", "Skill Set", "Technical Skills"];
const LABELS_FOR_LINKEDIN = ["LinkedIn", "LinkedIn URL"];
const LABELS_FOR_PORTFOLIO = ["Portfolio", "Portfolio URL"];
const LABELS_FOR_EXPERIENCE_YEARS = ["Years of Experience", "Total Experience", "Experience (Years)"];

function formatResumeSections(parsed: ParsedResume): string {
  const parts: string[] = [];
  if (parsed.education?.length) {
    parts.push("EDUCATION\n" + parsed.education.map((e) => {
      const line = [e.degree, e.institution, e.year].filter(Boolean).join(" – ");
      return line || "";
    }).filter(Boolean).join("\n"));
  }
  if (parsed.work_experience?.length) {
    parts.push("EXPERIENCE\n" + parsed.work_experience.map((w) => {
      const header = [w.job_title, w.company].filter(Boolean).join(" at ");
      const dates = [w.start_date, w.end_date].filter(Boolean).join(" – ");
      const lines = [header, dates, w.description].filter(Boolean);
      return lines.join("\n");
    }).filter(Boolean).join("\n\n"));
  }
  return parts.join("\n\n");
}

function applyParsedResumeToForm(
  parsed: ParsedResume,
  setFormFields: React.Dispatch<React.SetStateAction<FormField[]>>,
  setCustomFieldValues: (values: React.SetStateAction<Record<string, any>>) => void,
  customFields: Array<{ field_name: string; field_label?: string | null }>
): void {
  const resumeText = formatResumeSections(parsed);
  const skillsStr = Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "";

  // Value by label: each label that should get a value from parsed resume
  const valueByLabel: Record<string, string> = {};
  LABELS_FOR_FIRST_NAME.forEach((l) => (valueByLabel[l] = parsed.first_name || ""));
  LABELS_FOR_LAST_NAME.forEach((l) => (valueByLabel[l] = parsed.last_name || ""));
  LABELS_FOR_EMAIL.forEach((l) => (valueByLabel[l] = parsed.email || ""));
  LABELS_FOR_PHONE.forEach((l) => (valueByLabel[l] = parsed.phone || ""));
  LABELS_FOR_MOBILE.forEach((l) => (valueByLabel[l] = parsed.mobile_phone || ""));
  const addr = parsed.address || parsed.location || "";
  const city = parsed.city || "";
  const state = parsed.state || "";
  const zip = parsed.zip || "";
  LABELS_FOR_ADDRESS.forEach((l) => (valueByLabel[l] = addr));
  LABELS_FOR_ADDRESS_2.forEach((l) => (valueByLabel[l] = parsed.address_2 || ""));
  LABELS_FOR_CITY.forEach((l) => (valueByLabel[l] = city));
  LABELS_FOR_STATE.forEach((l) => (valueByLabel[l] = state));
  LABELS_FOR_ZIP.forEach((l) => (valueByLabel[l] = zip));
  LABELS_FOR_TITLE.forEach((l) => (valueByLabel[l] = parsed.current_job_title || ""));
  LABELS_FOR_RESUME_TEXT.forEach((l) => (valueByLabel[l] = resumeText));
  LABELS_FOR_SKILLS.forEach((l) => (valueByLabel[l] = skillsStr));
  LABELS_FOR_LINKEDIN.forEach((l) => (valueByLabel[l] = parsed.linkedin || ""));
  LABELS_FOR_PORTFOLIO.forEach((l) => (valueByLabel[l] = parsed.portfolio || ""));
  LABELS_FOR_EXPERIENCE_YEARS.forEach((l) => (valueByLabel[l] = parsed.total_experience_years || ""));

  const updateField = (arr: FormField[], id: string, value: string): FormField[] => {
    const idx = arr.findIndex((f) => f.id === id);
    if (idx === -1) return arr;
    const next = [...arr];
    next[idx] = { ...next[idx], value };
    return next;
  };

  const streetAddr = parsed.address || parsed.location || "";
  const parsedCity = parsed.city || "";
  const parsedState = parsed.state || "";
  const parsedZip = parsed.zip || "";

  setFormFields((prev) => {
    let next = prev;
    next = updateField(next, "firstName", parsed.first_name || "");
    next = updateField(next, "lastName", parsed.last_name || "");
    next = updateField(next, "email", parsed.email || "");
    next = updateField(next, "phone", parsed.phone || "");
    next = updateField(next, "mobilePhone", parsed.mobile_phone || "");
    next = updateField(next, "address", streetAddr);
    next = updateField(next, "city", parsedCity);
    next = updateField(next, "state", parsedState);
    next = updateField(next, "zip", parsedZip);
    next = updateField(next, "title", parsed.current_job_title || "");
    next = updateField(next, "resumeText", resumeText);
    next = updateField(next, "skills", skillsStr);
    return next;
  });

  setCustomFieldValues((prev) => {
    const next = { ...prev };
    for (const field of customFields) {
      const byName = parsed.custom_fields?.[field.field_name];
      if (byName !== undefined && byName !== "") {
        next[field.field_name] = byName;
      } else if (field.field_label && valueByLabel[field.field_label] !== undefined) {
        next[field.field_name] = valueByLabel[field.field_label];
      }
    }
    return next;
  });
}

// Multi-value tag input component for Skills field
interface MultiValueTagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function MultiValueTagInput({
  values,
  onChange,
  placeholder = "Type and press Enter",
}: MultiValueTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      const trimmedValue = inputValue.trim();
      if (!values.includes(trimmedValue)) {
        onChange([...values, trimmedValue]);
        setInputValue("");
      }
    } else if (
      e.key === "Backspace" &&
      inputValue === "" &&
      values.length > 0
    ) {
      // Remove last tag when backspace is pressed on empty input
      onChange(values.slice(0, -1));
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full min-h-[42px] p-2 border-b border-gray-300 focus-within:border-blue-500 flex flex-wrap gap-2 items-center">
      {values.map((skill, index) => (
        <span
          key={index}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
        >
          {skill}
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
            aria-label={`Remove ${skill}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none border-none bg-transparent"
      />
    </div>
  );
}

export default function AddJobSeeker() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const jobSeekerId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!jobSeekerId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!jobSeekerId);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const hasFetchedRef = useRef(false); // Track if we've already fetched job seeker data

  // Parse resume from PDF (AI): upload → extract text → OpenRouter → map to form
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parseResumeError, setParseResumeError] = useState<string | null>(null);
  const parseResumeInputRef = useRef<HTMLInputElement>(null);
  const [parseResumeProgress, setParseResumeProgress] = useState<number>(0);
  const parseResumeAbortRef = useRef<AbortController | null>(null);

  // Email and address validation states
  const [emailValidation, setEmailValidation] = useState<{
    isValid: boolean;
    message: string;
    isChecking: boolean;
  }>({ isValid: true, message: "", isChecking: false });

  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean;
    message: string;
    isChecking: boolean;
    suggestions?: any[];
  }>({ isValid: true, message: "", isChecking: false });

  const [emailDupMatches, setEmailDupMatches] = useState<JSDupMatch[]>([]);
  const [phoneDupMatches, setPhoneDupMatches] = useState<JSDupMatch[]>([]);
  const [hasConfirmedEmailDupSave, setHasConfirmedEmailDupSave] = useState(false);
  const [hasConfirmedPhoneDupSave, setHasConfirmedPhoneDupSave] = useState(false);
  const [isCheckingEmailDup, setIsCheckingEmailDup] = useState(false);
  const [isCheckingPhoneDup, setIsCheckingPhoneDup] = useState(false);
  const emailDupResponseCache = useRef<Map<string, JSDupMatch[]>>(new Map());
  const phoneDupResponseCache = useRef<Map<string, JSDupMatch[]>>(new Map());

  /** Canonical labels from GET /api/custom-fields/field-label (exact keys used by getCustomFieldsForSubmission). */
  const [jsDupLabelsFromApi, setJsDupLabelsFromApi] = useState<{
    email: string | null;
    phone: string | null;
  }>({ email: null, phone: null });

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues, // ✅ Extract setCustomFieldValues like Organizations
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
    resetCustomFields,
  } = useCustomFields("job-seekers", {
    applyAutoCurrentDefaults: !jobSeekerId,
  });

  const { isMultipleAddMode } = useMultipleAdd();

  const sortedCustomFields = useMemo(
    () =>
      [...customFields].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      ),
    [customFields]
  );

  // Calculate address fields once using useMemo
  const addressFields = useMemo(
    () => getAddressFields(customFields as any, "job-seekers"),
    [customFields]
  );
  const addressAnchorId = useMemo(
    () => (addressFields.length ? addressFields[0].id : null),
    [addressFields]
  );

  // Find the resume field (Field_40)
  const resumeField = useMemo(
    () => customFields.find((f) => f.field_name === "Field_40"),
    [customFields]
  );

  const emailLabelForDup = useMemo(() => {
    return (
      jsDupLabelsFromApi.email ??
      labelForFieldNameFromDefinitions(customFields, JS_DUP_EMAIL_FIELD_NAME)
    );
  }, [jsDupLabelsFromApi.email, customFields]);

  const phoneLabelForDup = useMemo(() => {
    return (
      jsDupLabelsFromApi.phone ??
      labelForFieldNameFromDefinitions(
        customFields,
        JS_DUP_PRIMARY_PHONE_FIELD_NAME
      )
    );
  }, [jsDupLabelsFromApi.phone, customFields]);

  const jsEmailFieldDef = useMemo(
    () =>
      fieldDefByStableName(
        customFields as CustomFieldDefinition[],
        JS_DUP_EMAIL_FIELD_NAME
      ),
    [customFields]
  );
  const jsPhoneFieldDef = useMemo(
    () =>
      fieldDefByStableName(
        customFields as CustomFieldDefinition[],
        JS_DUP_PRIMARY_PHONE_FIELD_NAME
      ),
    [customFields]
  );

  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;
    let cancelled = false;

    const fetchLabel = async (fieldName: string) => {
      const res = await fetch(
        `/api/custom-fields/field-label?entity_type=job-seekers&field_name=${encodeURIComponent(
          fieldName
        )}`
      );
      const data = await res.json().catch(() => ({}));
      if (!data.success || typeof data.field_label !== "string") return null;
      return data.field_label as string;
    };

    (async () => {
      const [em, ph] = await Promise.all([
        fetchLabel(JS_DUP_EMAIL_FIELD_NAME),
        fetchLabel(JS_DUP_PRIMARY_PHONE_FIELD_NAME),
      ]);
      if (cancelled) return;
      setJsDupLabelsFromApi({ email: em, phone: ph });
    })();

    return () => {
      cancelled = true;
    };
  }, [customFieldsLoading, customFields.length]);

  // Values sent to duplicate check (submission keys = field_label).
  const dupCheckValues = useMemo(() => {
    const submission = getCustomFieldsForSubmission() as Record<string, unknown>;
    return {
      email: valueFromSubmissionByLabel(submission, emailLabelForDup),
      phone: valueFromSubmissionByLabel(submission, phoneLabelForDup),
    };
  }, [
    customFieldValues,
    customFields,
    getCustomFieldsForSubmission,
    emailLabelForDup,
    phoneLabelForDup,
  ]);

  useEffect(() => {
    setHasConfirmedEmailDupSave(false);
  }, [dupCheckValues.email]);

  useEffect(() => {
    setHasConfirmedPhoneDupSave(false);
  }, [dupCheckValues.phone]);

  const jsEmailFieldValue = jsEmailFieldDef
    ? customFieldValues[jsEmailFieldDef.field_name]
    : undefined;
  const jsPhoneFieldValue = jsPhoneFieldDef
    ? customFieldValues[jsPhoneFieldDef.field_name]
    : undefined;

  const emailValidForDupCheck = Boolean(
    jsEmailFieldDef &&
    isCustomFieldValueValid(jsEmailFieldDef, jsEmailFieldValue)
  );
  const phoneValidForDupCheck = Boolean(
    jsPhoneFieldDef &&
    isCustomFieldValueValid(jsPhoneFieldDef, jsPhoneFieldValue)
  );

  const excludeIdForDup =
    isEditMode && jobSeekerId ? String(jobSeekerId).trim() : "";

  // Email: debounced + cache (narrow deps, like Organizations).
  useEffect(() => {
    let timeoutId: number | undefined;
    let isCancelled = false;

    if (!emailValidForDupCheck) {
      setEmailDupMatches([]);
      setIsCheckingEmailDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const emailForCheck = dupCheckValues.email.trim();
    if (!emailForCheck) {
      setEmailDupMatches([]);
      setIsCheckingEmailDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const cacheKey = emailDupCacheKey(
      excludeIdForDup,
      emailLabelForDup,
      phoneLabelForDup,
      emailForCheck
    );
    const cached = emailDupResponseCache.current.get(cacheKey);
    if (cached) {
      setEmailDupMatches(cached);
      setIsCheckingEmailDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const runCheck = async () => {
      try {
        setIsCheckingEmailDup(true);
        const params = new URLSearchParams();
        params.set("email", emailForCheck);
        if (excludeIdForDup) params.set("excludeId", excludeIdForDup);
        if (emailLabelForDup) params.set("email_label", emailLabelForDup);
        if (phoneLabelForDup) params.set("phone_label", phoneLabelForDup);

        const dupRes = await fetch(
          `/api/job-seekers/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();

        if (isCancelled) return;

        const matches =
          dupData.success && dupData.duplicates
            ? (dupData.duplicates.email ?? [])
            : [];
        emailDupResponseCache.current.set(cacheKey, matches);
        setEmailDupMatches(matches);
      } catch {
        if (!isCancelled) setEmailDupMatches([]);
      } finally {
        if (!isCancelled) setIsCheckingEmailDup(false);
      }
    };

    timeoutId = window.setTimeout(runCheck, 600);

    return () => {
      isCancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    dupCheckValues.email,
    emailValidForDupCheck,
    emailLabelForDup,
    phoneLabelForDup,
    excludeIdForDup,
  ]);

  // Phone: debounced + cache
  useEffect(() => {
    let timeoutId: number | undefined;
    let isCancelled = false;

    if (!phoneValidForDupCheck) {
      setPhoneDupMatches([]);
      setIsCheckingPhoneDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const phoneForCheck = dupCheckValues.phone.trim();
    if (!phoneForCheck) {
      setPhoneDupMatches([]);
      setIsCheckingPhoneDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const cacheKey = phoneDupCacheKey(
      excludeIdForDup,
      emailLabelForDup,
      phoneLabelForDup,
      phoneForCheck
    );
    const cached = phoneDupResponseCache.current.get(cacheKey);
    if (cached) {
      setPhoneDupMatches(cached);
      setIsCheckingPhoneDup(false);
      return () => {
        isCancelled = true;
      };
    }

    const runCheck = async () => {
      try {
        setIsCheckingPhoneDup(true);
        const params = new URLSearchParams();
        params.set("phone", phoneForCheck);
        if (excludeIdForDup) params.set("excludeId", excludeIdForDup);
        if (emailLabelForDup) params.set("email_label", emailLabelForDup);
        if (phoneLabelForDup) params.set("phone_label", phoneLabelForDup);

        const dupRes = await fetch(
          `/api/job-seekers/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();

        if (isCancelled) return;

        const matches =
          dupData.success && dupData.duplicates
            ? (dupData.duplicates.phone ?? [])
            : [];
        phoneDupResponseCache.current.set(cacheKey, matches);
        setPhoneDupMatches(matches);
      } catch {
        if (!isCancelled) setPhoneDupMatches([]);
      } finally {
        if (!isCancelled) setIsCheckingPhoneDup(false);
      }
    };

    timeoutId = window.setTimeout(runCheck, 600);

    return () => {
      isCancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    dupCheckValues.phone,
    phoneValidForDupCheck,
    emailLabelForDup,
    phoneLabelForDup,
    excludeIdForDup,
  ]);

  // Initialize with default fields only once; never overwrite existing form data (fixes left column reset)
  useEffect(() => {
    // Get current user from cookies
    const userCookie = document.cookie.replace(
      /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );
    if (userCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userCookie));
        setCurrentUser(userData);
      } catch (e) {
        console.error("Error parsing user cookie:", e);
      }
    }

    // Fetch active users for owner dropdown
    fetchActiveUsers();

    // Only set initial form fields when form is still empty; never overwrite user-entered data
    setFormFields((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: "firstName",
          name: "firstName",
          label: "First Name",
          type: "text",
          required: true,
          visible: true,
          value: "",
        },
        {
          id: "lastName",
          name: "lastName",
          label: "Last Name",
          type: "text",
          required: true,
          visible: true,
          value: "",
        },
        {
          id: "email",
          name: "email",
          label: "Email",
          type: "email",
          required: true,
          visible: true,
          value: "",
        },
        {
          id: "phone",
          name: "phone",
          label: "Phone",
          type: "tel",
          required: true,
          visible: true,
          value: "",
        },
        {
          id: "mobilePhone",
          name: "mobilePhone",
          label: "Mobile Phone",
          type: "tel",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "address",
          name: "address",
          label: "Address",
          type: "text",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "city",
          name: "city",
          label: "City",
          type: "text",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "state",
          name: "state",
          label: "State",
          type: "text",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "zip",
          name: "zip",
          label: "ZIP Code",
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
          required: true,
          visible: true,
          options: ["New lead", "Active", "Qualified", "Placed", "Inactive"],
          value: "New lead",
        },
        {
          id: "currentOrganization",
          name: "currentOrganization",
          label: "Current Organization",
          type: "text",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "title",
          name: "title",
          label: "Title",
          type: "text",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "resumeText",
          name: "resumeText",
          label: "Resume Text",
          type: "textarea",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "resumeUpload",
          name: "resumeUpload",
          label: "Upload Resume",
          type: "file",
          required: false,
          visible: true,
          value: "",
        },
        {
          id: "skills",
          name: "skills",
          label: "Skills",
          type: "textarea",
          required: false,
          visible: true,
          value: "",
          placeholder: "Enter skills separated by commas",
        },
        {
          id: "desiredSalary",
          name: "desiredSalary",
          label: "Desired Salary",
          type: "text",
          required: false,
          visible: true,
          value: "",
          placeholder: "e.g. $75,000",
        },
        {
          id: "owner",
          name: "owner",
          label: "Owner",
          type: "select",
          required: false,
          visible: true,
          value: currentUser?.name || "",
          options: [], // Will be populated with active users
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
        {
          id: "lastContactDate",
          name: "lastContactDate",
          label: "Last Contact Date",
          type: "date",
          required: false,
          visible: true,
          value: "",
          locked: true, // This field is now locked and auto-updated
        },
      ];
    });
  }, []);

  // Fetch active users
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/api/users/active");
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.users || []);

        // Update owner field options
        setFormFields((prev) =>
          prev.map((field) =>
            field.id === "owner"
              ? { ...field, options: data.users.map((user: User) => user.name) }
              : field
          )
        );
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  };

  // Memoize fetchJobSeeker to prevent it from being recreated on every render
  const fetchJobSeeker = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        console.log(`Fetching job seeker data for ID: ${id}`);
        const response = await fetch(`/api/job-seekers/${id}`, {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch job seeker details");
        }

        const data = await response.json();
        console.log("Job seeker data received:", data);

        if (!data.jobSeeker) {
          throw new Error("No job seeker data received");
        }

        // Map API data to form fields
        const jobSeeker = data.jobSeeker;

        // Parse existing custom fields from the job seeker
        let existingCustomFields: Record<string, any> = {};
        if (jobSeeker.custom_fields) {
          try {
            existingCustomFields =
              typeof jobSeeker.custom_fields === "string"
                ? JSON.parse(jobSeeker.custom_fields)
                : jobSeeker.custom_fields;
          } catch (e) {
            console.error("Error parsing existing custom fields:", e);
          }
        }

        // ✅ Map custom fields from field_label (database key) to field_name (form key)
        // Custom fields are stored with field_label as keys, but form uses field_name
        const mappedCustomFieldValues: Record<string, any> = {};

        // First, map any existing custom field values from the database
        if (
          customFields.length > 0 &&
          Object.keys(existingCustomFields).length > 0
        ) {
          customFields.forEach((field) => {
            // Try to find the value by field_label (as stored in DB)
            const value = existingCustomFields[field.field_label];
            if (value !== undefined) {
              // Map to field_name for the form
              mappedCustomFieldValues[field.field_name] = value;
            }
          });
        }

        // ✅ Second, map standard job seeker fields to custom fields based on field labels
        // This ensures that standard fields like "first_name", "last_name" etc. populate custom fields
        // with matching labels like "First Name", "Last Name", etc.
        if (customFields.length > 0) {
          const standardFieldMapping: Record<string, string> = {
            // First Name variations
            "First Name": jobSeeker.first_name || "",
            First: jobSeeker.first_name || "",
            FName: jobSeeker.first_name || "",
            // Last Name variations
            "Last Name": jobSeeker.last_name || "",
            Last: jobSeeker.last_name || "",
            LName: jobSeeker.last_name || "",
            // Email variations
            Email: jobSeeker.email || "",
            "Email Address": jobSeeker.email || "",
            "E-mail": jobSeeker.email || "",
            // Phone variations
            Phone: jobSeeker.phone || "",
            "Phone Number": jobSeeker.phone || "",
            Telephone: jobSeeker.phone || "",
            "Mobile Phone": jobSeeker.mobile_phone || "",
            Mobile: jobSeeker.mobile_phone || "",
            "Cell Phone": jobSeeker.mobile_phone || "",
            // Address variations
            Address: jobSeeker.address || "",
            "Street Address": jobSeeker.address || "",
            City: jobSeeker.city || "",
            State: jobSeeker.state || "",
            "ZIP Code": jobSeeker.zip || "",
            ZIP: jobSeeker.zip || "",
            "Zip Code": jobSeeker.zip || "",
            "Postal Code": jobSeeker.zip || "",
            // Status variations
            Status: jobSeeker.status || "New lead",
            "Current Status": jobSeeker.status || "New lead",
            // Organization variations
            "Current Organization": jobSeeker.current_organization || "",
            Organization: jobSeeker.current_organization || "",
            Company: jobSeeker.current_organization || "",
            // Title variations
            Title: jobSeeker.title || "",
            "Job Title": jobSeeker.title || "",
            Position: jobSeeker.title || "",
            // Resume variations
            "Resume Text": jobSeeker.resume_text || "",
            Resume: jobSeeker.resume_text || "",
            CV: jobSeeker.resume_text || "",
            // Skills variations
            Skills: jobSeeker.skills || "",
            "Skill Set": jobSeeker.skills || "",
            "Technical Skills": jobSeeker.skills || "",
            // Salary variations
            "Desired Salary": jobSeeker.desired_salary || "",
            Salary: jobSeeker.desired_salary || "",
            "Expected Salary": jobSeeker.desired_salary || "",
            // Owner variations
            Owner: jobSeeker.owner || "",
            "Assigned To": jobSeeker.owner || "",
            "Assigned Owner": jobSeeker.owner || "",
            // Date variations
            "Date Added": jobSeeker.date_added
              ? jobSeeker.date_added.split("T")[0]
              : "",
            "Added Date": jobSeeker.date_added
              ? jobSeeker.date_added.split("T")[0]
              : "",
            "Created Date": jobSeeker.date_added
              ? jobSeeker.date_added.split("T")[0]
              : "",
            "Last Contact Date": jobSeeker.last_contact_date
              ? jobSeeker.last_contact_date.split("T")[0]
              : "",
            "Last Contact": jobSeeker.last_contact_date
              ? jobSeeker.last_contact_date.split("T")[0]
              : "",
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

        console.log(
          "Custom Field Values Loaded (mapped):",
          mappedCustomFieldValues
        );
        console.log("Original custom fields from DB:", existingCustomFields);
        console.log(
          "Custom Fields Definitions:",
          customFields.map((f) => ({
            name: f.field_name,
            label: f.field_label,
          }))
        );

        // ✅ Set the mapped custom field values (field_name as keys) - same as Organizations
        setCustomFieldValues(mappedCustomFieldValues);

        // Update formFields with existing job seeker data
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
                value:
                  value !== null && value !== undefined ? String(value) : "",
              };
            }
          };

          // Update standard fields
          updateField("firstName", jobSeeker.first_name);
          updateField("lastName", jobSeeker.last_name);
          updateField("email", jobSeeker.email);
          updateField("phone", jobSeeker.phone);
          updateField("mobilePhone", jobSeeker.mobile_phone);
          updateField("address", jobSeeker.address);
          updateField("city", jobSeeker.city);
          updateField("state", jobSeeker.state);
          updateField("zip", jobSeeker.zip);
          updateField("status", jobSeeker.status);
          updateField("currentOrganization", jobSeeker.current_organization);
          updateField("title", jobSeeker.title);
          updateField("resumeText", jobSeeker.resume_text);
          updateField("skills", jobSeeker.skills);
          updateField("desiredSalary", jobSeeker.desired_salary);
          updateField("owner", jobSeeker.owner);
          updateField(
            "dateAdded",
            jobSeeker.date_added ? jobSeeker.date_added.split("T")[0] : ""
          );
          // Note: lastContactDate is locked, so we don't update it

          return updatedFields;
        });

        setIsEditMode(true);
        console.log("Job seeker data loaded successfully");
      } catch (err) {
        console.error("Error fetching job seeker:", err);
        setLoadError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching job seeker details"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [customFields, setCustomFieldValues]
  );

  // If jobSeekerId is present, fetch the job seeker data
  // Wait for customFields to load before fetching to ensure proper mapping
  useEffect(() => {
    // Only fetch if we have a jobSeekerId, customFields are loaded, and we haven't fetched yet
    if (
      jobSeekerId &&
      !customFieldsLoading &&
      customFields.length > 0 &&
      !hasFetchedRef.current
    ) {
      hasFetchedRef.current = true;
      fetchJobSeeker(jobSeekerId);
    }
    // Reset the ref when jobSeekerId changes or is removed
    if (!jobSeekerId) {
      hasFetchedRef.current = false;
    }
  }, [jobSeekerId, customFieldsLoading, customFields.length, fetchJobSeeker]);


  // ✅ Sync formFields changes to custom fields (two-way binding)
  // When user types in basic fields, update matching custom fields
  useEffect(() => {
    // Only sync if custom fields are loaded and we're not currently fetching
    if (customFieldsLoading || customFields.length === 0 || isLoading) {
      return;
    }

    // Map of form field IDs to their possible labels (for matching with custom field labels)
    // This ensures custom fields with various label variations are mapped correctly
    const formFieldToLabelMap: Record<string, string[]> = {
      firstName: ["First Name", "First", "FName"],
      lastName: ["Last Name", "Last", "LName"],
      email: ["Email", "Email Address", "E-mail"],
      phone: ["Phone", "Phone Number", "Telephone"],
      mobilePhone: ["Mobile Phone", "Mobile", "Cell Phone"],
      address: ["Address", "Street Address"],
      city: ["City"],
      state: ["State"],
      zip: ["ZIP Code", "ZIP", "Zip Code", "Postal Code"],
      status: ["Status", "Current Status"],
      currentOrganization: ["Current Organization", "Organization", "Company"],
      title: ["Title", "Job Title", "Position"],
      resumeText: ["Resume Text", "Resume", "CV"],
      skills: ["Skills", "Skill Set", "Technical Skills"],
      desiredSalary: ["Desired Salary", "Salary", "Expected Salary"],
      owner: ["Owner", "Assigned To", "Assigned Owner"],
      dateAdded: ["Date Added", "Added Date", "Created Date"],
    };

    // Get current form field values
    const formFieldValues: Record<string, string> = {};
    formFields.forEach((field) => {
      if (field.visible && !field.locked) {
        formFieldValues[field.id] = field.value;
      }
    });

    // Update custom fields based on form field values
    // Use a functional update to avoid dependency on customFieldValues
    setCustomFieldValues((prevCustomFields) => {
      const updatedCustomFields: Record<string, any> = { ...prevCustomFields };
      let hasChanges = false;

      customFields.forEach((customField) => {
        // Find matching form field by checking if custom field label matches any label in the map
        const matchingFormFieldId = Object.keys(formFieldToLabelMap).find(
          (formFieldId) => {
            const possibleLabels = formFieldToLabelMap[formFieldId];
            return possibleLabels.includes(customField.field_label);
          }
        );

        if (
          matchingFormFieldId &&
          formFieldValues[matchingFormFieldId] !== undefined
        ) {
          const formValue = formFieldValues[matchingFormFieldId];
          const currentCustomValue =
            updatedCustomFields[customField.field_name];
          const formIsEmpty = formValue === "" || formValue == null;
          const customHasValue =
            currentCustomValue !== undefined &&
            currentCustomValue !== "" &&
            String(currentCustomValue).trim() !== "";

          // Never overwrite left-column (custom) data with empty form values when user typed only in left/custom fields then in Resume Text
          if (formIsEmpty && customHasValue) return;
          if (currentCustomValue !== formValue) {
            updatedCustomFields[customField.field_name] = formValue;
            hasChanges = true;
          }
        }
      });

      // Only return updated object if there are changes, otherwise return previous to prevent unnecessary re-renders
      return hasChanges ? updatedCustomFields : prevCustomFields;
    });
  }, [
    formFields,
    customFields,
    customFieldsLoading,
    isLoading,
    setCustomFieldValues,
  ]);

  // Handle input change – use functional update so we never overwrite with stale formFields (fixes left column reset when editing Resume Text)
  const handleChange = (id: string, value: string) => {
    setFormFields((prev) => {
      const field = prev.find((f) => f.id === id);
      if (field?.locked) return prev;
      return prev.map((f) => (f.id === id ? { ...f, value } : f));
    });
  };

  // Shared: run AI parse on a file and apply to form (used by file input and by sidebar PDF drop).
  // Let the backend's isResumeFile() be the single source of truth for allowed formats.
  const parseResumeWithFile = async (file: File) => {
    const abort = new AbortController();
    parseResumeAbortRef.current = abort;

    setParseResumeError(null);
    setIsParsingResume(true);
    setParseResumeProgress(10);
    try {
      const formData = new FormData();
      formData.set("file", file);
      setParseResumeProgress(25);

      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: abort.signal,
      });
      setParseResumeProgress(70);

      const data = await res.json();
      if (!res.ok) {
        setParseResumeError(data.message || "Parse failed.");
        return;
      }
      if (!data.success || !data.parsed) {
        setParseResumeError("Invalid response. Enter candidate manually.");
        return;
      }
      applyParsedResumeToForm(
        data.parsed as ParsedResume,
        setFormFields,
        setCustomFieldValues,
        customFields
      );
      setResumeFile(file);
      setParseResumeProgress(100);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setParseResumeError("Parsing cancelled.");
      } else {
        setParseResumeError(
          err instanceof Error ? err.message : "Parse failed."
        );
      }
    } finally {
      setIsParsingResume(false);
      setParseResumeProgress(0);
      parseResumeAbortRef.current = null;
      // Always clear the input value so the user can re-select
      // the same file again to re-run parsing if needed.
      if (parseResumeInputRef.current) {
        parseResumeInputRef.current.value = "";
      }
    }
  };

  // Upload PDF → extract text → AI parse → map to form (no auto-save; recruiter reviews)
  const handleParseResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await parseResumeWithFile(file);
  };

  const handleCancelParseResume = () => {
    if (parseResumeAbortRef.current) {
      parseResumeAbortRef.current.abort();
    }
  };

  // When opened from sidebar with a PDF (parseResume=1 + jobSeekerAddParsePendingFile), auto-run parse
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("parseResume") !== "1") return;
    if (customFieldsLoading) return;
    const raw = sessionStorage.getItem("jobSeekerAddParsePendingFile");
    if (!raw) return;
    sessionStorage.removeItem("jobSeekerAddParsePendingFile");
    router.replace("/dashboard/job-seekers/add", { scroll: false });
    try {
      const { name, base64, type } = JSON.parse(raw);
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      const blob = new Blob([arr], { type: type || "application/pdf" });
      const file = new File([blob], name, { type: blob.type });
      parseResumeWithFile(file);
    } catch (err) {
      console.error("Sidebar PDF parse:", err);
      setParseResumeError("Failed to load dropped PDF. Try uploading again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("parseResume"), customFieldsLoading]);

  // Prevent scrolling when parsing is active
  useEffect(() => {
    if (isParsingResume) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isParsingResume]);

  // Form validation state
  const getFormValidationState = useCallback(() => {
    const issues: string[] = [];

    // Check email validation
    if (!emailValidation.isValid) {
      issues.push("Please provide a valid email address");
    }

    // Check address validation if address is provided
    const hasAddress = formFields.some(
      (f) => (f.id === "address" || f.id === "city") && f.value.trim()
    );
    if (hasAddress && !addressValidation.isValid) {
      issues.push("Please provide a valid address or use one of the suggested addresses");
    }

    // Validate required custom fields
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      issues.push(customFieldValidation.message);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [emailValidation.isValid, formFields, addressValidation.isValid, validateCustomFields]);

  // Compute whether all required fields are satisfied (for disabling Update/Save until valid)
  const isFormValid = useMemo(() => {
    const { isValid } = getFormValidationState();
    return isValid;
  }, [getFormValidationState]);

  useEffect(() => {
    const { isValid, issues } = getFormValidationState();

    if (!isValid) {
      console.groupCollapsed(
        "[AddJobSeeker] Form is invalid - Save/Update button will be disabled"
      );
      console.log("Validation issues preventing save:", issues);
      console.log("Current customFieldValues:", customFieldValues);
      console.log("Address fields definition:", addressFields);
      console.log("Custom fields definition:", customFields);
      console.groupEnd();
    } else {
      console.log(
        "[AddJobSeeker] Form is currently valid - Save/Update button should be enabled"
      );
    }
  }, [getFormValidationState, customFieldValues, customFields, addressFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check overall form validation
    const { isValid, issues } = getFormValidationState();
    if (!isValid) {
      setError(issues.join("\n"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setEmailDupMatches([]);
    setPhoneDupMatches([]);

    try {
      // ✅ CRITICAL: Get custom fields from the hook (same pattern as Organizations)
      const customFieldsToSend = getCustomFieldsForSubmission();

      // 🔍 DEBUG: Log to see what we're getting
      console.log("=== DEBUG START ===");
      console.log("customFieldValues from state:", customFieldValues);
      console.log("customFieldsToSend from hook:", customFieldsToSend);
      console.log("Type of customFieldsToSend:", typeof customFieldsToSend);
      console.log(
        "Is customFieldsToSend empty?",
        Object.keys(customFieldsToSend).length === 0
      );
      console.log("=== DEBUG END ===");

      const apiDataDefaults: Record<string, any> = {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        mobilePhone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        status: "New lead",
        currentOrganization: "",
        title: "",
        resumeText: "",
        skills: "",
        desiredSalary: "",
        owner: currentUser ? currentUser.name : "",
        dateAdded: new Date().toISOString().split("T")[0],
      };

      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit).
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          apiDataDefaults[column] = value;
        }
        // Always store every field in custom_fields so all fields are persisted there
        customFieldsForDB[label] = value;
      });

      const emailForCheck = valueFromSubmissionByLabel(
        customFieldsToSend as Record<string, unknown>,
        emailLabelForDup
      );
      const phoneForCheck = valueFromSubmissionByLabel(
        customFieldsToSend as Record<string, unknown>,
        phoneLabelForDup
      );

      const rawEmailVal = jsEmailFieldDef
        ? customFieldValues[jsEmailFieldDef.field_name]
        : undefined;
      const rawPhoneVal = jsPhoneFieldDef
        ? customFieldValues[jsPhoneFieldDef.field_name]
        : undefined;

      let dupEmail: JSDupMatch[] = [];
      let dupPhone: JSDupMatch[] = [];

      const runEmailDup =
        Boolean(
          jsEmailFieldDef &&
          isCustomFieldValueValid(jsEmailFieldDef, rawEmailVal) &&
          emailForCheck
        );
      const runPhoneDup =
        Boolean(
          jsPhoneFieldDef &&
          isCustomFieldValueValid(jsPhoneFieldDef, rawPhoneVal) &&
          phoneForCheck
        );

      if (runEmailDup) {
        const params = new URLSearchParams();
        params.set("email", emailForCheck);
        if (isEditMode && jobSeekerId) params.set("excludeId", jobSeekerId);
        if (emailLabelForDup) params.set("email_label", emailLabelForDup);
        if (phoneLabelForDup) params.set("phone_label", phoneLabelForDup);
        const dupRes = await fetch(
          `/api/job-seekers/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();
        if (dupData.success && dupData.duplicates) {
          dupEmail = dupData.duplicates.email ?? [];
        }
      }

      if (runPhoneDup) {
        const params = new URLSearchParams();
        params.set("phone", phoneForCheck);
        if (isEditMode && jobSeekerId) params.set("excludeId", jobSeekerId);
        if (emailLabelForDup) params.set("email_label", emailLabelForDup);
        if (phoneLabelForDup) params.set("phone_label", phoneLabelForDup);
        const dupRes = await fetch(
          `/api/job-seekers/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();
        if (dupData.success && dupData.duplicates) {
          dupPhone = dupData.duplicates.phone ?? [];
        }
      }

      setEmailDupMatches(dupEmail);
      setPhoneDupMatches(dupPhone);

      const hasDuplicates = dupEmail.length > 0 || dupPhone.length > 0;
      if (hasDuplicates) {
        const messages: string[] = [];
        if (dupEmail.length > 0) {
          const names = dupEmail.map((js) => js.name).join(", ");
          messages.push(`Email is already used by: ${names}`);
        }
        if (dupPhone.length > 0) {
          const names = dupPhone.map((js) => js.name).join(", ");
          messages.push(`Phone number is already used by: ${names}`);
        }

        const needEmailConfirm = dupEmail.length > 0 && !hasConfirmedEmailDupSave;
        const needPhoneConfirm = dupPhone.length > 0 && !hasConfirmedPhoneDupSave;
        if (needEmailConfirm || needPhoneConfirm) {
          const hint =
            needEmailConfirm && needPhoneConfirm
              ? "Confirm both checkboxes (under Primary Email and Primary Phone), then save again."
              : needEmailConfirm
                ? "Confirm the checkbox under Primary Email, then save again."
                : "Confirm the checkbox under Primary Phone, then save again.";
          setError(
            "Possible duplicate job seeker(s) detected.\n\n" +
            messages.join("\n") +
            "\n\n" +
            hint
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Auto-populate Owner if not set (only in create mode)
      if (!isEditMode && (!apiDataDefaults.owner || String(apiDataDefaults.owner).trim() === "")) {
        try {
          const userCookie = document.cookie.replace(
            /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          );
          if (userCookie) {
            const userData = JSON.parse(decodeURIComponent(userCookie));
            if (userData.name) {
              apiDataDefaults.owner = userData.name;
              const ownerField = customFields.find(
                (f) =>
                  f.field_name === "Field_17" ||
                  f.field_name === "field_17" ||
                  (f.field_label === "Owner" && f.field_name?.includes("17"))
              );
              if (ownerField) customFieldsForDB[ownerField.field_label] = userData.name;
            }
          }
        } catch (e) {
          console.error("Error parsing user data from cookie:", e);
        }
      }

      const apiData: Record<string, any> = {
        ...apiDataDefaults,
        custom_fields: customFieldsForDB,
      };

      // 🔍 DEBUG: Log the final payload
      console.log("=== FINAL PAYLOAD ===");
      console.log("Full apiData:", JSON.stringify(apiData, null, 2));
      console.log("apiData.custom_fields:", apiData.custom_fields);
      console.log(
        "Type of apiData.custom_fields:",
        typeof apiData.custom_fields
      );
      console.log(
        "Is apiData.custom_fields an object?",
        typeof apiData.custom_fields === "object" &&
        !Array.isArray(apiData.custom_fields)
      );
      console.log("=== END PAYLOAD ===");

      // Validate that custom_fields is always a plain object
      if (
        typeof apiData.custom_fields !== "object" ||
        apiData.custom_fields === null ||
        Array.isArray(apiData.custom_fields)
      ) {
        console.error(
          "ERROR: custom_fields is not a valid object!",
          apiData.custom_fields
        );
        apiData.custom_fields = {};
      }

      // Ensure custom_fields is a plain object
      try {
        apiData.custom_fields = JSON.parse(
          JSON.stringify(apiData.custom_fields)
        );
      } catch (e) {
        console.error("ERROR: Failed to serialize custom_fields!", e);
        apiData.custom_fields = {};
      }

      // Final validation - ensure custom_fields is definitely an object
      if (
        typeof apiData.custom_fields !== "object" ||
        apiData.custom_fields === null
      ) {
        console.error(
          "FINAL VALIDATION FAILED: custom_fields is still not an object!",
          apiData.custom_fields
        );
        apiData.custom_fields = {};
      }

      // Remove any potential conflicting keys
      delete (apiData as any).customFields;

      // Log final payload before sending
      console.log("=== FINAL VALIDATION ===");
      console.log("custom_fields type:", typeof apiData.custom_fields);
      console.log("custom_fields value:", apiData.custom_fields);
      console.log(
        "custom_fields is object:",
        typeof apiData.custom_fields === "object" &&
        !Array.isArray(apiData.custom_fields)
      );
      console.log("All keys in apiData:", Object.keys(apiData));
      console.log("=== END VALIDATION ===");

      const formData = apiData;

      console.log(
        `${isEditMode ? "Updating" : "Creating"} job seeker data:`,
        formData
      );

      // Choose the appropriate API endpoint and method
      const url = isEditMode
        ? `/api/job-seekers/${jobSeekerId}`
        : "/api/job-seekers";
      const method = isEditMode ? "PUT" : "POST";

      // Send the data to the backend API
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          `Failed to ${isEditMode ? "update" : "create"} job seeker`
        );
      }

      // Navigate to the job seeker view page
      const resultId = isEditMode
        ? jobSeekerId
        : data.jobSeeker
          ? data.jobSeeker.id
          : null;

      // If a resume file was selected/parsed, upload it to the job seeker's Docs tab as first_name-resume.ext
      if (resultId && resumeFile) {
        const firstName = (apiData.firstName || "").trim();
        const firstWord = firstName.split(/\s+/)[0] || "resume";
        const safeName = firstWord.replace(/[^a-zA-Z0-9-]/g, "") || "resume";
        const ext = resumeFile.name.toLowerCase().split(".").pop() || "pdf";
        const documentName = `${safeName}-resume.${ext}`;

        const uploadFormData = new FormData();
        uploadFormData.set("file", resumeFile);
        uploadFormData.set("document_name", documentName);
        uploadFormData.set("document_type", "Resume");

        try {
          const uploadRes = await fetch(`/api/job-seekers/${resultId}/documents/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}` },
            body: uploadFormData,
          });
          if (!uploadRes.ok) {
            const uploadData = await uploadRes.json().catch(() => ({}));
            console.warn("Resume upload to Docs failed:", uploadData.message || uploadRes.statusText);
            setError(`Job seeker saved, but resume upload failed: ${uploadData.message || "Please add the resume from the Docs tab."}`);
            setIsSubmitting(false);
            return;
          }
        } catch (uploadErr) {
          console.warn("Resume upload error:", uploadErr);
          setError("Job seeker saved, but resume upload failed. You can add it from the Docs tab.");
          setIsSubmitting(false);
          return;
        }
      }

      if (isMultipleAddMode && !isEditMode) {
        resetCustomFields();
        setHasConfirmedEmailDupSave(false);
        setHasConfirmedPhoneDupSave(false);
        setEmailDupMatches([]);
        setPhoneDupMatches([]);
        setResumeFile(null);
        window.scrollTo(0, 0);
      } else {
        if (resultId) {
          router.push("/dashboard/job-seekers/view?id=" + resultId);
        } else {
          router.push("/dashboard/job-seekers");
        }
      }
    } catch (error) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} job seeker:`,
        error
      );
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <LoadingScreen
        message={
          isEditMode ? "Updating job seeker..." : "Creating job seeker..."
        }
      />
    );
  }

  // Show loading screen when loading existing job seeker data
  if (isLoading) {
    return <LoadingScreen message="Loading job seeker data..." />;
  }

  // Show error if job seeker loading fails
  if (loadError) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{loadError}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Job Seekers
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
        {/* Parsing Overlay (minimal inside card) */}
        {isParsingResume && (
          <div className="h-screen absolute inset-0 z-[999] flex items-center justify-center bg-white/50 rounded-lg transition-all duration-300 flex flex-col gap-4">
            <div className="w-12 h-12 border-4 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <p>Parsing... </p>
          </div>
        )}
        {/* Header with X button */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center">
            <Image
              src="/file.svg"
              alt="Job Seeker"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Job Seeker
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

        {/* Error message (includes duplicate email/phone warning) */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* AI Parse Error */}
        {parseResumeError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-6 rounded-lg flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
            <span className="font-medium">{parseResumeError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative space-y-4">
          <div
            className={
              resumeField && !resumeField.is_hidden
                ? "grid grid-cols-1 lg:grid-cols-2 gap-6"
                : "grid grid-cols-1 gap-6"
            }
          >
            {(() => {
              const renderCustomFieldRow = (field: any) => {
                const labelNorm = (field.field_label ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
                const isFullAddressField =
                  labelNorm.includes("full") && labelNorm.includes("address");
                if (isFullAddressField) return null;

                if (field.is_hidden) return null;

                // Resume (Field_40) renders only in the right-hand Resume panel, not in the left column
                const resumeFn = field.field_name ?? "";
                if (
                  resumeFn === "Field_40" ||
                  resumeFn.toLowerCase() === "field_40"
                ) {
                  return null;
                }

                // ✅ Render Address Group exactly where first address field exists
                if (
                  addressFields.length > 0 &&
                  addressAnchorId &&
                  field.id === addressAnchorId
                ) {
                  return (
                    <div key="address-group" className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center mt-4">
                        Address:
                      </label>

                      <div className="flex-1">
                        <AddressGroupRenderer
                          fields={addressFields}
                          values={customFieldValues}
                          onChange={handleCustomFieldChange}
                          isEditMode={isEditMode}
                          entityType="job-seekers"
                        />
                      </div>
                    </div>
                  );
                }

                // Skip address fields if they're being rendered in the grouped layout
                const addressFieldIds = addressFields.map((f) => f.id);
                if (addressFieldIds.includes(field.id)) {
                  return null;
                }

                const fieldValue = customFieldValues[field.field_name] || "";

                const fn = field.field_name ?? "";
                const fnLower = fn.toLowerCase();
                const isEmailDuplicateField =
                  fn === JS_DUP_EMAIL_FIELD_NAME ||
                  fnLower === JS_DUP_EMAIL_FIELD_NAME.toLowerCase();
                const isPhoneDuplicateField =
                  fn === JS_DUP_PRIMARY_PHONE_FIELD_NAME ||
                  fnLower === JS_DUP_PRIMARY_PHONE_FIELD_NAME.toLowerCase();

                const parseMultiValue = (val: any): string[] => {
                  if (!val) return [];
                  if (Array.isArray(val)) return val.filter((s) => s && s.trim());
                  if (typeof val === "string") {
                    return val
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s);
                  }
                  return [];
                };

                return (
                  <div key={field.id} className="flex items-center gap-4 mb-3">
                    <label className="w-48 font-medium flex items-center">
                      {field.field_label}:
                    </label>

                    <div className="flex-1 relative">
                      {(
                        <>
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            onChange={handleCustomFieldChange}
                            validationIndicator={
                              field.is_required
                                ? isCustomFieldValueValid(field, fieldValue)
                                  ? "valid"
                                  : "required"
                                : undefined
                            }
                          />
                          {isCheckingEmailDup &&
                            isEmailDuplicateField &&
                            isCustomFieldValueValid(field, fieldValue) && (
                              <p className="mt-2 text-xs text-gray-500">
                                Checking for duplicates…
                              </p>
                            )}
                          {isCheckingPhoneDup &&
                            isPhoneDuplicateField &&
                            isCustomFieldValueValid(field, fieldValue) && (
                              <p className="mt-2 text-xs text-gray-500">
                                Checking for duplicates…
                              </p>
                            )}
                          {isEmailDuplicateField &&
                            emailDupMatches.length > 0 && (
                              <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                <div className="font-semibold mb-1">
                                  Possible duplicate job seeker(s) detected
                                </div>
                                <div className="space-y-1">
                                  <div className="font-medium">Same email:</div>
                                  <ul className="list-disc list-inside">
                                    {emailDupMatches.map((js) => (
                                      <li key={js.id}>
                                        <a
                                          href={`/dashboard/job-seekers/view?id=${js.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          {js.name}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    id="confirm-duplicate-email"
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={hasConfirmedEmailDupSave}
                                    onChange={(e) =>
                                      setHasConfirmedEmailDupSave(e.target.checked)
                                    }
                                  />
                                  <label htmlFor="confirm-duplicate-email">
                                    I have reviewed these email duplicate(s) and still want to save.
                                  </label>
                                </div>
                              </div>
                            )}
                          {isPhoneDuplicateField &&
                            phoneDupMatches.length > 0 && (
                              <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                <div className="font-semibold mb-1">
                                  Possible duplicate job seeker(s) detected
                                </div>
                                <div className="space-y-1">
                                  <div className="font-medium">Same phone number:</div>
                                  <ul className="list-disc list-inside">
                                    {phoneDupMatches.map((js) => (
                                      <li key={js.id}>
                                        <a
                                          href={`/dashboard/job-seekers/view?id=${js.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          {js.name}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    id="confirm-duplicate-phone"
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={hasConfirmedPhoneDupSave}
                                    onChange={(e) =>
                                      setHasConfirmedPhoneDupSave(e.target.checked)
                                    }
                                  />
                                  <label htmlFor="confirm-duplicate-phone">
                                    I have reviewed these phone duplicate(s) and still want to save.
                                  </label>
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  <div>
                    {/* Custom Fields Section */}
                    {customFields.length > 0 && (
                      <>{sortedCustomFields.map((field) => renderCustomFieldRow(field))}</>
                    )}
                  </div>

                  {/* Resume Section - only show if Field_40 is not hidden */}
                  {resumeField && !resumeField.is_hidden && (
                    <div>
                      <div className="bg-white border border-gray-200 rounded p-4">
                        <div className="font-semibold mb-3">Resume</div>
                        <CustomFieldRenderer
                          field={resumeField}
                          value={customFieldValues[resumeField.field_name] || ""}
                          onChange={handleCustomFieldChange}
                          validationIndicator={
                            resumeField.is_required
                              ? isCustomFieldValueValid(resumeField, customFieldValues[resumeField.field_name] || "")
                                ? "valid"
                                : "required"
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Spacer so content is not hidden behind sticky bar */}
          <div className="h-20" aria-hidden="true" />

          {/* Email validation message */}
          {!emailValidation.isValid && emailValidation.message && (
            <div className="text-red-500 text-sm">
              Email: {emailValidation.message}
            </div>
          )}

          {/* Address validation message and suggestions */}
          {!addressValidation.isValid && addressValidation.message && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
              <div className="text-yellow-700 text-sm mb-2">
                Address: {addressValidation.message}
              </div>
              {addressValidation.suggestions &&
                addressValidation.suggestions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-2">
                      Suggested addresses:
                    </p>
                    {addressValidation.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          // Apply suggested address
                          setFormFields((prev) =>
                            prev.map((field) => {
                              if (field.id === "address")
                                return { ...field, value: suggestion.address };
                              if (field.id === "city")
                                return { ...field, value: suggestion.city };
                              if (field.id === "state")
                                return { ...field, value: suggestion.state };
                              if (field.id === "zip")
                                return { ...field, value: suggestion.zip };
                              return field;
                            })
                          );
                        }}
                        className="block w-full text-left p-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 mb-1"
                      >
                        {suggestion.formatted}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Form Buttons – sticky to form card like Organizations / HM add */}
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
              className={`px-4 py-2 rounded ${isSubmitting ||
                !isFormValid ||
                (emailDupMatches.length > 0 && !hasConfirmedEmailDupSave) ||
                (phoneDupMatches.length > 0 && !hasConfirmedPhoneDupSave)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
                } text-white`}
              disabled={
                isSubmitting ||
                !isFormValid ||
                (emailDupMatches.length > 0 && !hasConfirmedEmailDupSave) ||
                (phoneDupMatches.length > 0 && !hasConfirmedPhoneDupSave)
              }
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
