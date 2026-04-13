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
import AddressGroupRenderer, { getAddressFields, isAddressGroupValid } from "@/components/AddressGroupRenderer";

interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  options?: string[];
  placeholder?: string;
  default_value?: string;
  sort_order: number;
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
  "Email 2": "email2",
  "Status": "status", "Current Status": "status",
  "Title": "title", "Job Title": "title", Position: "title",
  "Organization": "organizationId", "Organization Name": "organizationId", Company: "organizationId",
  "Department": "department", Dept: "department",
  "Reports To": "reportsTo", Manager: "reportsTo",
  "Owner": "owner", "Assigned To": "owner", "Assigned Owner": "owner",
  "Secondary Owners": "secondaryOwners", "Secondary Owner": "secondaryOwners",
  "Address": "address", "Street Address": "address", "Address 1": "address",
  "Address 2": "address2", Suite: "address2", Apt: "address2", Apartment: "address2", Floor: "address2",
  "City": "city",
  "State": "state",
  "ZIP Code": "zipCode", Zip: "zipCode", ZipCode: "zipCode", "Postal Code": "zipCode",
  "LinkedIn URL": "linkedinUrl", LinkedIn: "linkedinUrl", "LinkedIn Profile": "linkedinUrl",
  "Nickname": "nickname", "Nick Name": "nickname",
  "Last Contact Date": "lastContactDate", "Last Contact": "lastContactDate",
};

/** Stable internal names — labels are resolved via /api/custom-fields/field-label (submission keys = field_label). */
const HM_DUP_PRIMARY_EMAIL_FIELD_NAME = "Field_7";

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

type HMDupMatch = { id: string | number; name: string };

function emailDupCacheKey(
  excludeId: string,
  emailLabel: string | null | undefined,
  email: string
): string {
  return `email|ex:${excludeId}|el:${emailLabel ?? ""}|e:${email}`;
}

export default function AddHiringManager() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const hiringManagerId = searchParams.get("id");
  const organizationIdFromUrl = searchParams.get("organizationId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!hiringManagerId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!hiringManagerId);
  const [emailDupMatches, setEmailDupMatches] = useState<HMDupMatch[]>([]);
  const [hasConfirmedEmailDupSave, setHasConfirmedEmailDupSave] = useState(false);
  const [isCheckingEmailDup, setIsCheckingEmailDup] = useState(false);
  const emailDupResponseCache = useRef<Map<string, HMDupMatch[]>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [organizationPhone, setOrganizationPhone] = useState<string>("");
  const [organizationAddress, setOrganizationAddress] = useState<string>("");
  const hasFetchedRef = useRef(false); // Track if we've already fetched hiring manager data
  const hasPrefilledOrgRef = useRef(false); // Track if we've prefilled organization

  console.log("organizationIdFromUrl", organizationIdFromUrl);

  // Use the useCustomFields hook
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
    resetCustomFields,
  } = useCustomFields("hiring-managers", {
    applyAutoCurrentDefaults: !hiringManagerId,
  });

  const { isMultipleAddMode } = useMultipleAdd();
  const addressFields = useMemo(
    () => getAddressFields(customFields as any, "hiring-managers"),
    [customFields]
  );
  const addressFieldIdSet = useMemo(() => {
    return new Set(addressFields.map((f: any) => f.id));
  }, [addressFields]);
  const sortedCustomFields = useMemo(() => {
    return [...customFields].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [customFields]);
  const addressAnchorId = addressFields?.[0]?.id; // usually the first address field (Address)
  const [orgFieldLabels, setOrgFieldLabels] = useState<Record<string, string>>({});
  const [hmDupLabelsFromApi, setHmDupLabelsFromApi] = useState<{
    email: string | null;
  }>({ email: null });


  useEffect(() => {
    const missingFieldNames = ORGANIZATION_FIELD_NAMES.filter(
      (name) => !orgFieldLabels[name]
    );
    if (missingFieldNames.length === 0) return;

    console.log("[HM Add] resolving org labels", missingFieldNames);
    let cancelled = false;

    const token =
      typeof document !== "undefined"
        ? document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        )
        : "";

    (async () => {
      const fetched: Record<string, string> = {};
      await Promise.all(
        missingFieldNames.map(async (fieldName) => {
          try {
            const response = await fetch(
              `/api/custom-fields/field-label?entity_type=organizations&field_name=${encodeURIComponent(
                fieldName
              )}`,
              {
                headers: token
                  ? {
                    Authorization: `Bearer ${token}`,
                  }
                  : undefined,
                cache: "no-store",
              }
            );
            if (!response.ok) return;
            const data = await response.json().catch(() => ({}));
            if (cancelled) return;
            const label =
              data.field_label || data.fieldLabel || data.label || "";
            console.log(
              "[HM Add] fetched field label",
              fieldName,
              "->",
              label,
              "payload",
              data
            );
            if (label) {
              fetched[fieldName] = label;
            }
          } catch (error) {
            console.error(
              `Failed to fetch field label for organization ${fieldName}:`,
              error
            );
          }
        })
      );
      if (cancelled) return;
      if (Object.keys(fetched).length > 0) {
        setOrgFieldLabels((prev) => ({ ...prev, ...fetched }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgFieldLabels]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    status: "Active",
    nickname: "",
    title: "",
    organizationId: "",
    department: "Accounting",
    reportsTo: "",
    owner: "",
    secondaryOwners: "",
    email: "",
    email2: "",
    phone: "",
    mobilePhone: "",
    directLine: "",
    companyPhone: "",
    linkedinUrl: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    lastContactDate: "",
  });

  const ORGANIZATION_SELECTION_FIELD_NAME = "Field_3";
  const ORG_TO_HM_FIELD_MAPPING: Record<string, string> = {
    Field_6: "Field_16",
    Field_8: "Field_12",
    Field_9: "Field_13",
    Field_10: "Field_14",
    Field_11: "Field_15",
    Field_12: "Field_17",
  };
  const ORGANIZATION_FIELD_NAMES = Object.keys(ORG_TO_HM_FIELD_MAPPING);
  const [loadedOrganization, setLoadedOrganization] = useState<any>(null);
  const lastFetchedOrganizationIdRef = useRef<string | null>(null);
  const lastMappedOrganizationIdRef = useRef<string | null>(null);
  const memoizedFormData = useMemo(() => formData, [formData]);
  const emailLabelForDup = useMemo(() => {
    return (
      hmDupLabelsFromApi.email ??
      labelForFieldNameFromDefinitions(customFields, HM_DUP_PRIMARY_EMAIL_FIELD_NAME)
    );
  }, [hmDupLabelsFromApi.email, customFields]);

  const hmEmailFieldDef = useMemo(
    () =>
      fieldDefByStableName(
        customFields as CustomFieldDefinition[],
        HM_DUP_PRIMARY_EMAIL_FIELD_NAME
      ),
    [customFields]
  );

  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;
    let cancelled = false;

    const fetchLabel = async (fieldName: string) => {
      const res = await fetch(
        `/api/custom-fields/field-label?entity_type=hiring-managers&field_name=${encodeURIComponent(
          fieldName
        )}`
      );
      const data = await res.json().catch(() => ({}));
      if (!data.success || typeof data.field_label !== "string") return null;
      return data.field_label as string;
    };

    (async () => {
      const email = await fetchLabel(HM_DUP_PRIMARY_EMAIL_FIELD_NAME);
      if (cancelled) return;
      setHmDupLabelsFromApi({ email });
    })();

    return () => {
      cancelled = true;
    };
  }, [customFieldsLoading, customFields.length]);

  const dupCheckValues = useMemo(() => {
    const submission = getCustomFieldsForSubmission() as Record<string, unknown>;
    return {
      email: valueFromSubmissionByLabel(submission, emailLabelForDup),
    };
  }, [
    customFieldValues,
    customFields,
    getCustomFieldsForSubmission,
    emailLabelForDup,
  ]);

  useEffect(() => {
    setHasConfirmedEmailDupSave(false);
  }, [dupCheckValues.email]);

  const hmEmailFieldValue = hmEmailFieldDef
    ? customFieldValues[hmEmailFieldDef.field_name]
    : undefined;
  const emailValidForDupCheck = Boolean(
    hmEmailFieldDef &&
      isCustomFieldValueValid(hmEmailFieldDef, hmEmailFieldValue)
  );

  const excludeIdForDup =
    isEditMode && hiringManagerId ? String(hiringManagerId).trim() : "";

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

        const dupRes = await fetch(
          `/api/hiring-managers/check-duplicates?${params.toString()}`
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
  }, [dupCheckValues.email, emailValidForDupCheck, emailLabelForDup, excludeIdForDup]);

  // Fetch organization data (name, phone, address) if organizationId is provided
  const fetchOrganizationData = useCallback(async (orgId: string) => {
    console.log("fetching")
    lastMappedOrganizationIdRef.current = null;
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
    console.log("[HM Add] fetching organization details", orgId);
    if (response.ok) {
        const data = await response.json();
        const org = data.organization || {};

      console.log("[HM Add] loaded organization", orgId, org);

        // Extract organization data with fallbacks
        const orgCustomFields = org.custom_fields || {};
        const resolveOrgFieldValue = (fieldName: string, fallback?: string) => {
          const label = orgFieldLabels[fieldName];
          if (label && orgCustomFields[label] !== undefined && orgCustomFields[label] !== null) {
            return orgCustomFields[label];
          }
          return fallback;
        };

        const orgName = org.name || "";
        const companyPhoneValue = resolveOrgFieldValue(
          "Field_6",
          org.contact_phone || orgCustomFields["Main Phone"] || ""
        );
        const addressValue = resolveOrgFieldValue(
          "Field_8",
          org.address || ""
        );
        const address2Value = resolveOrgFieldValue(
          "Field_8",
          orgCustomFields["Address 2"] || ""
        );
        const cityValue = resolveOrgFieldValue(
          "Field_9",
          orgCustomFields["City"] || ""
        );
        const stateValue = resolveOrgFieldValue(
          "Field_10",
          orgCustomFields["State"] || ""
        );
        const zipValue = resolveOrgFieldValue(
          "Field_11",
          orgCustomFields["ZIP Code"] || ""
        );

        if (!orgName) {
          console.warn(`Organization ${orgId} is missing a name`);
        }

        setOrganizationName(orgName);
        setOrganizationPhone(companyPhoneValue || "");
        setOrganizationAddress(addressValue || org.address || "");

        setFormData((prev) => ({
          ...prev,
          organizationId: orgId,
          phone: companyPhoneValue || prev.phone || "",
          companyPhone: companyPhoneValue || prev.companyPhone || "",
          address: addressValue || prev.address || "",
          address2: address2Value || prev.address2 || "",
          city: cityValue || prev.city || "",
          state: stateValue || prev.state || "",
          zipCode: zipValue || prev.zipCode || "",
        }));

        setLoadedOrganization(org);

        // Auto-populate custom fields once they're loaded
        // This will be handled in a useEffect that watches customFields
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch organization:", response.statusText, errorData);
        setError(`Failed to load organization data: ${errorData.message || response.statusText}`);
        // Still set the organizationId even if fetch fails
        setLoadedOrganization(null);
        setFormData(prev => ({
          ...prev,
          organizationId: orgId
        }));
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
      setError(`Error loading organization: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Still set the organizationId even if fetch fails
      setLoadedOrganization(null);
      setFormData(prev => ({
        ...prev,
        organizationId: orgId
      }));
    }
  }, [orgFieldLabels]);

  // Initialize with current user and fetch data
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

    // Prefill organizationId from URL if provided (and not in edit mode)
    if (organizationIdFromUrl && !hiringManagerId && !hasPrefilledOrgRef.current) {
      hasPrefilledOrgRef.current = true;
      fetchOrganizationData(organizationIdFromUrl);
    }
  }, [organizationIdFromUrl, hiringManagerId, fetchOrganizationData]);

  // Fetch active users
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/api/users/active");
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  };

  // Memoize fetchHiringManager to prevent it from being recreated on every render
  const fetchHiringManager = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hiring-managers/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch hiring manager details"
        );
      }

      const data = await response.json();
      const hm = data.hiringManager;

      // Convert database fields to form field names with proper defaults
      setFormData({
        firstName: hm.first_name || "",
        lastName: hm.last_name || "",
        status: hm.status || "Active",
        nickname: hm.nickname || "",
        title: hm.title || "",
        organizationId:
          hm.organization_id?.toString() || hm.organization_name || "",
        department: hm.department || "Accounting",
        reportsTo: hm.reports_to || "",
        owner: hm.owner || "",
        secondaryOwners: hm.secondary_owners || "",
        email: hm.email || "",
        email2: hm.email2 || "",
        phone: hm.phone || "",
        mobilePhone: hm.mobile_phone || "",
        directLine: hm.direct_line || "",
        companyPhone: hm.company_phone || "",
        linkedinUrl: hm.linkedin_url || "",
        address: hm.address || "",
        address2: hm.address2 || "",
        city: hm.city || "",
        state: hm.state || "",
        zipCode: hm.zip_code || "",
        lastContactDate: hm.last_contact_date || "",
      });

      // Parse existing custom fields from the hiring manager
      let existingCustomFields: Record<string, any> = {};
      if (hm.custom_fields) {
        try {
          existingCustomFields =
            typeof hm.custom_fields === "string"
              ? JSON.parse(hm.custom_fields)
              : hm.custom_fields;
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

      // Second, map standard hiring manager fields to custom fields based on field labels
      if (customFields.length > 0) {
        const standardFieldMapping: Record<string, string> = {
          // First Name variations
          "First Name": hm.first_name || "",
          "First": hm.first_name || "",
          "FName": hm.first_name || "",
          // Last Name variations
          "Last Name": hm.last_name || "",
          "Last": hm.last_name || "",
          "LName": hm.last_name || "",
          // Email variations
          "Email": hm.email || "",
          "Email 1": hm.email || "",
          "Email Address": hm.email || "",
          "E-mail": hm.email || "",
          "Email 2": hm.email2 || "",
          // Phone variations
          "Phone": hm.phone || "",
          "Phone Number": hm.phone || "",
          "Telephone": hm.phone || "",
          "Mobile Phone": hm.mobile_phone || "",
          "Mobile": hm.mobile_phone || "",
          "Cell Phone": hm.mobile_phone || "",
          "Direct Line": hm.direct_line || "",
          // Status variations
          "Status": hm.status || "Active",
          "Current Status": hm.status || "Active",
          // Title variations
          "Title": hm.title || "",
          "Job Title": hm.title || "",
          "Position": hm.title || "",
          // Organization variations: store ID when available so links/API use ID; name is for display only
          "Organization": hm.organization_id?.toString() || hm.organization_name || "",
          "Organization Name": hm.organization_id?.toString() || hm.organization_name || "",
          "Company": hm.organization_id?.toString() || hm.organization_name || "",
          // Department variations
          "Department": hm.department || "",
          "Dept": hm.department || "",
          // Reports To variations
          "Reports To": hm.reports_to || "",
          "Manager": hm.reports_to || "",
          // Owner variations
          "Owner": hm.owner || "",
          "Assigned To": hm.owner || "",
          "Assigned Owner": hm.owner || "",
          // Secondary Owners variations
          "Secondary Owners": hm.secondary_owners || "",
          "Secondary Owner": hm.secondary_owners || "",
          // Address variations
          "Address": hm.address || "",
          "Street Address": hm.address || "",
          // LinkedIn variations
          "LinkedIn URL": hm.linkedin_url || "",
          "LinkedIn": hm.linkedin_url || "",
          "LinkedIn Profile": hm.linkedin_url || "",
          // Nickname variations
          "Nickname": hm.nickname || "",
          "Nick Name": hm.nickname || "",
        };

        // For each custom field, try to populate from mapped values or standard fields
        customFields.forEach((field) => {
          // First check if we have a value from existing custom fields
          if (mappedCustomFieldValues[field.field_name] === undefined) {
            // Try to get value from standard field mapping using field_label
            const standardValue = standardFieldMapping[field.field_label];
            if (standardValue !== undefined) {
              mappedCustomFieldValues[field.field_name] = standardValue;
            }
          }
        });
      }

      // Set the mapped custom field values
      setCustomFieldValues(mappedCustomFieldValues);
    } catch (err) {
      console.error("Error fetching hiring manager:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring manager details"
      );
    } finally {
      setIsLoading(false);
    }
  }, [customFields, setCustomFieldValues]);

  // If hiringManagerId is present, fetch the hiring manager data
  // Wait for customFields to load before fetching to ensure proper mapping
  useEffect(() => {
    // Only fetch if we have a hiringManagerId, customFields are loaded, and we haven't fetched yet
    if (hiringManagerId && !customFieldsLoading && customFields.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchHiringManager(hiringManagerId);
    }
    // Reset the ref when hiringManagerId changes or is removed
    if (!hiringManagerId) {
      hasFetchedRef.current = false;
    }
  }, [hiringManagerId, customFieldsLoading, customFields.length, fetchHiringManager]);


  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const selectedOrganizationFieldValue = customFieldValues[ORGANIZATION_SELECTION_FIELD_NAME];

  useEffect(() => {
    if (hiringManagerId) return;
    if (customFields.length === 0) return;

    if (!selectedOrganizationFieldValue) {
      lastFetchedOrganizationIdRef.current = null;
      lastMappedOrganizationIdRef.current = null;
      setLoadedOrganization(null);
      return;
    }

    const trimmedValue = String(selectedOrganizationFieldValue).trim();
    if (!trimmedValue) return;

    const looksLikeId =
      !isNaN(Number(trimmedValue)) ||
      (trimmedValue.length < 10 && !trimmedValue.includes(" "));

    if (!looksLikeId) return;

    if (lastFetchedOrganizationIdRef.current === trimmedValue) return;

    const timeoutId = setTimeout(() => {
      lastFetchedOrganizationIdRef.current = trimmedValue;
      fetchOrganizationData(trimmedValue);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    hiringManagerId,
    customFields.length,
    selectedOrganizationFieldValue,
    fetchOrganizationData,
  ]);

  useEffect(() => {
    if (hiringManagerId) return;
    if (!loadedOrganization) return;

    const labelsReady = ORGANIZATION_FIELD_NAMES.every(
      (name) => Boolean(orgFieldLabels[name])
    );
    if (!labelsReady) return;

    const orgId =
      String(
        loadedOrganization.id ??
        loadedOrganization.organization_id ??
        loadedOrganization.organizationId ??
        ""
      ).trim();
    if (!orgId) return;
    if (lastMappedOrganizationIdRef.current === orgId) return;

    const customFieldUpdates: Record<string, any> = {};
    const formFieldMapping: Record<string, keyof typeof formData> = {
      Field_8: "address",
      Field_9: "address2",
      Field_10: "city",
      Field_11: "state",
      Field_12: "zipCode",
      Field_6: "companyPhone",
    };
    const formFieldUpdates: Partial<typeof formData> = {};

    ORGANIZATION_FIELD_NAMES.forEach((orgFieldName) => {
      const hmFieldName = ORG_TO_HM_FIELD_MAPPING[orgFieldName];
      const label = orgFieldLabels[orgFieldName];
      const rawValue =
        (label
          ? loadedOrganization.custom_fields?.[label] ??
          loadedOrganization[label]
          : undefined) ??
        loadedOrganization.custom_fields?.[orgFieldName] ??
        loadedOrganization[orgFieldName];
      console.log(
        "[HM Add] mapping org field",
        orgFieldName,
        "label",
        label,
        "raw",
        rawValue,
        "-> HM field",
        hmFieldName
      );
      if (rawValue === undefined) return;
      customFieldUpdates[hmFieldName] = rawValue;
      const formKey = formFieldMapping[orgFieldName];
      if (formKey && formFieldUpdates[formKey] === undefined) {
        formFieldUpdates[formKey] = rawValue;
      }
    });

    if (Object.keys(formFieldUpdates).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...formFieldUpdates,
      }));
    }

    if (Object.keys(customFieldUpdates).length > 0) {
      Object.entries(customFieldUpdates).forEach(([fieldName, value]) => {
        handleCustomFieldChange(fieldName, value);
      });
    }

    lastMappedOrganizationIdRef.current = orgId;
  }, [
    hiringManagerId,
    loadedOrganization,
    orgFieldLabels,
    handleCustomFieldChange,
  ]);

  // When organization data (phone, address) changes—e.g. after selecting a different org—
  // prefill the corresponding custom fields. Run only when org data changes, NOT when the user
  // edits those fields (so Company Phone and Address remain editable after prefilled).
  useEffect(() => {
    if (customFields.length === 0 || hiringManagerId) return;

    const updates: Record<string, any> = {};

    customFields.forEach((field) => {
      const fieldLabel = field.field_label.toLowerCase();

      // Company Phone fields
      if (
        (fieldLabel.includes("company phone") ||
          fieldLabel.includes("company phone number") ||
          (fieldLabel.includes("phone") && fieldLabel.includes("company"))) &&
        organizationPhone
      ) {
        updates[field.field_name] = organizationPhone;
      }

      // Organization/Company address fields
      if (
        (fieldLabel.includes("organization address") ||
          fieldLabel.includes("company address") ||
          (fieldLabel.includes("address") && (fieldLabel.includes("organization") || fieldLabel.includes("company")))) &&
        organizationAddress
      ) {
        updates[field.field_name] = organizationAddress;
      }
    });

    if (Object.keys(updates).length > 0) {
      Object.entries(updates).forEach(([fieldName, value]) => {
        handleCustomFieldChange(fieldName, value);
      });
    }
  }, [customFields, organizationPhone, organizationAddress, hiringManagerId, handleCustomFieldChange]);

  // Handle prefilling from URL (existing logic preserved but ensuring it plays nice).
  // Intentionally omit customFieldValues from deps so that when the user clears phone/address
  // we don't re-run and re-fill; prefill only runs when org data (e.g. organizationPhone) first loads.
  useEffect(() => {
    if (customFields.length === 0 || !organizationIdFromUrl || hasPrefilledOrgRef.current === false) return;
    if (hiringManagerId) return; // Don't auto-populate in edit mode

    // Auto-populate custom fields with organization data when arriving from URL
    const updates: Record<string, any> = {};

    customFields.forEach((field) => {
      const fieldLabel = field.field_label.toLowerCase();
      const currentValue = customFieldValues[field.field_name];

      // Organization fields (URL case): store the organization ID, not the name, so links and API use ID
      if (
        (fieldLabel.includes("organization") || fieldLabel.includes("company")) &&
        !fieldLabel.includes("phone") &&
        !fieldLabel.includes("address")
      ) {
        if (!currentValue || currentValue === organizationIdFromUrl || currentValue === String(organizationIdFromUrl) || currentValue === organizationName) {
          updates[field.field_name] = organizationIdFromUrl;
        }
      }

      // Company Phone fields (URL case) - only prefill when currently empty so user can leave blank
      if (
        (fieldLabel.includes("company phone") ||
          fieldLabel.includes("company phone number") ||
          (fieldLabel.includes("phone") && fieldLabel.includes("company"))) &&
        organizationPhone &&
        !currentValue
      ) {
        updates[field.field_name] = organizationPhone;
      }

      // Organization Address fields (URL case) - only prefill when currently empty so user can leave blank
      if (
        (fieldLabel.includes("organization address") ||
          fieldLabel.includes("company address") ||
          (fieldLabel.includes("address") && (fieldLabel.includes("organization") || fieldLabel.includes("company")))) &&
        organizationAddress &&
        !currentValue
      ) {
        updates[field.field_name] = organizationAddress;
      }
    });

    if (Object.keys(updates).length > 0) {
      Object.entries(updates).forEach(([fieldName, value]) => {
        if (customFieldValues[fieldName] !== value) {
          handleCustomFieldChange(fieldName, value);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- customFieldValues omitted so clearing phone/address doesn't re-trigger prefill
  }, [customFields, organizationName, organizationPhone, organizationAddress, organizationIdFromUrl, hiringManagerId, handleCustomFieldChange]);

  // Sync formData -> custom fields only when formData changes (e.g. user edited a standard form input).
  // Do NOT depend on customFieldValues: when user edits a custom field, this effect must not re-run
  // or it would overwrite their edit with the previous formData value.
  useEffect(() => {
    if (customFields.length === 0) return;

    const fieldMappings: Record<string, string[]> = {
      firstName: ["First Name", "First", "FName"],
      lastName: ["Last Name", "Last", "LName"],
      email: ["Email", "Email 1", "Email Address", "E-mail"],
      email2: ["Email 2"],
      phone: ["Phone", "Phone Number", "Telephone"],
      mobilePhone: ["Mobile Phone", "Mobile", "Cell Phone"],
      directLine: ["Direct Line"],
      companyPhone: ["Company Phone", "Contact Phone", "Main Phone"],
      status: ["Status", "Current Status"],
      title: ["Title", "Job Title", "Position"],
      department: ["Department", "Dept"],
      reportsTo: ["Reports To", "Manager"],
      owner: ["Owner", "Assigned To", "Assigned Owner"],
      secondaryOwners: ["Secondary Owners", "Secondary Owner"],
      address: ["Address", "Street Address", "Address 1"],
      address2: ["Address 2", "Suite", "Apt", "Apartment", "Floor"],
      city: ["City"],
      state: ["State"],
      zipCode: ["ZIP Code", "Zip", "ZipCode", "Postal Code"],
      linkedinUrl: ["LinkedIn URL", "LinkedIn", "LinkedIn Profile"],
      nickname: ["Nickname", "Nick Name"],
      lastContactDate: ["Last Contact Date", "Last Contact"],
    };

    customFields.forEach((field) => {
      const fieldLabel = field.field_label;
      let newValue: any = undefined;

      Object.entries(fieldMappings).forEach(([formKey, labels]) => {
        if (labels.includes(fieldLabel)) {
          const formValue = memoizedFormData[formKey as keyof typeof memoizedFormData];
          if (formValue !== undefined && formValue !== null && formValue !== "") {
            newValue = formValue;
          }
        }
      });

      if (newValue !== undefined) {
        setCustomFieldValues((prev) => {
          const currentValue = prev[field.field_name];
          if (currentValue === newValue) return prev;
          return { ...prev, [field.field_name]: newValue };
        });
      }
    });
  }, [memoizedFormData, customFields, setCustomFieldValues]);

  // const validateForm = () => {

  //   if (!formData.firstName.trim()) {
  //     setError("First name is required");
  //     return false;
  //   }
  //   if (!formData.lastName.trim()) {
  //     setError("Last name is required");
  //     return false;
  //   }
  //   if (!formData.title.trim()) {
  //     setError("Title is required");
  //     return false;
  //   }
  //   if (!formData.email.trim()) {
  //     setError("Email is required");
  //     return false;
  //   }


  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //   if (!emailRegex.test(formData.email)) {
  //     setError("Invalid email format");
  //     return false;
  //   }


  //   if (formData.email2 && !emailRegex.test(formData.email2)) {
  //     setError("Invalid format for second email");
  //     return false;
  //   }


  //   for (const field of customFields) {
  //     if (field.required && !field.value.trim()) {
  //       setError(`${field.label} is required`);
  //       return false;
  //     }
  //   }

  //   return true;
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    // if (!validateForm()) {
    //   return;
    // }

    setIsSubmitting(true);
    setError(null);
    setEmailDupMatches([]);

    try {
      // Get custom fields for submission
      const customFieldsToSend = getCustomFieldsForSubmission();

      // Use organizationId from URL if available, otherwise from form/custom fields
      const finalOrganizationId = organizationIdFromUrl || formData.organizationId;
      const finalOrganizationName = organizationName || formData.organizationId;

      const apiData: any = {
        firstName: "",
        lastName: "",
        status: "Active",
        nickname: "",
        title: "",
        organizationId: finalOrganizationId,
        organizationName: finalOrganizationName,
        department: "",
        reportsTo: "",
        owner: currentUser?.name || "",
        secondaryOwners: "",
        email: "",
        email2: "",
        phone: "",
        mobilePhone: "",
        directLine: "",
        companyPhone: "",
        linkedinUrl: "",
        address: "",
        address2: "",
        city: "",
        state: "",
        zipCode: "",
        lastContactDate: "",
      };

      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit).
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          apiData[column] = value;
        }
        // Always store every field in custom_fields so all fields are persisted there
        customFieldsForDB[label] = value;
      });

      const emailForCheck = valueFromSubmissionByLabel(
        customFieldsToSend as Record<string, unknown>,
        emailLabelForDup
      );
      const rawEmailVal = hmEmailFieldDef
        ? customFieldValues[hmEmailFieldDef.field_name]
        : undefined;

      let dupEmail: HMDupMatch[] = [];
      const runEmailDup = Boolean(
        hmEmailFieldDef &&
          isCustomFieldValueValid(hmEmailFieldDef, rawEmailVal) &&
          emailForCheck
      );

      if (runEmailDup) {
        const params = new URLSearchParams();
        params.set("email", emailForCheck);
        if (isEditMode && hiringManagerId) params.set("excludeId", hiringManagerId);
        if (emailLabelForDup) params.set("email_label", emailLabelForDup);
        const dupRes = await fetch(
          `/api/hiring-managers/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();
        if (dupData.success && dupData.duplicates) {
          dupEmail = dupData.duplicates.email ?? [];
        }
      }

      setEmailDupMatches(dupEmail);
      if (dupEmail.length > 0 && !hasConfirmedEmailDupSave) {
        const names = dupEmail.map((hm) => hm.name).join(", ");
        setError(
          "Possible duplicate hiring manager(s) detected.\n\n" +
            `Email is already used by: ${names}` +
            "\n\n" +
            "Confirm the checkbox under Primary Email, then save again."
        );
        setIsSubmitting(false);
        return;
      }

      // When adding from organization page, preserve organizationIdFromUrl - custom fields may have overwritten it with org name
      if (organizationIdFromUrl && !isEditMode) {
        apiData.organizationId = organizationIdFromUrl;
        apiData.organizationName = organizationName || organizationIdFromUrl;
      }
      // Normalize organization: if organizationId is not a number, treat as name
      if (apiData.organizationId && isNaN(Number(apiData.organizationId))) {
        apiData.organizationName = apiData.organizationId;
        apiData.organizationId = "";
      }
      if (!apiData.organizationName && apiData.organizationId) {
        apiData.organizationName = apiData.organizationId.toString();
      }

      apiData.customFields = customFieldsForDB;

      console.log("Custom Fields to Send:", customFieldsToSend);
      console.log("API Data:", apiData);
      console.log("Custom Fields for DB:", customFieldsForDB);

      console.log(
        "Sending hiring manager data to API:",
        JSON.stringify(apiData, null, 2)
      );

      let response;
      let data;

      if (isEditMode && hiringManagerId) {
        // Update existing hiring manager
        response = await fetch(`/api/hiring-managers/${hiringManagerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiData),
        });
      } else {
        // Create new hiring manager
        response = await fetch("/api/hiring-managers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiData),
        });
      }

      // Get full response text for debugging
      const responseText = await response.text();
      console.log(
        `API ${isEditMode ? "update" : "create"} response:`,
        responseText
      );

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        console.error("Failed to parse response:", error);
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          `Failed to ${isEditMode ? "update" : "create"} hiring manager`
        );
      }

      if (isMultipleAddMode && !isEditMode) {
        resetCustomFields();
        setHasConfirmedEmailDupSave(false);
        setEmailDupMatches([]);
        window.scrollTo(0, 0);
      } else {
        // After save/update, always go to the Hiring Manager record page
        const id = isEditMode ? hiringManagerId : data.hiringManager.id;
        router.push(`/dashboard/hiring-managers/view?id=${id}`);
      }
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} hiring manager:`,
        err
      );
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const validationResult = useMemo(() => {
    const result = validateCustomFields();
    // Debug: log validation result whenever it runs
    console.log("[Hiring Manager Form] Validation:", {
      isValid: result.isValid,
      message: result.message || "(all required fields valid)",
      customFieldValues: { ...customFieldValues },
    });
    return result;
  }, [customFieldValues, validateCustomFields]);

  const isFormValid = validationResult.isValid;

  if (isLoading) {
    return <LoadingScreen message="Loading hiring manager data..." />;
  }

  if (isSubmitting) {
    return (
      <LoadingScreen
        message={
          isEditMode
            ? "Updating hiring manager..."
            : "Creating hiring manager..."
        }
      />
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
        {/* Header with X button */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center gap-4">
            <Image
              src="/globe.svg"
              alt="Hiring Manager"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Hiring Manager
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

        {/* Error message (includes duplicate email warning) */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Custom Fields Section */}
          {customFields.length > 0 && (
            <div className="mt-8">
              {sortedCustomFields.map((field) => {
                // Check if this is the anchor address field (first address field)
                if (
                  addressFields.length > 0 &&
                  field.id === addressAnchorId
                ) {
                  const addressRequired = addressFields.some((f) => f.is_required);
                  const addressValid = isAddressGroupValid(addressFields, customFieldValues);

                  return (
                    <div
                      key="address-group"
                      className="address-underline flex items-start gap-4 mb-3"
                    >
                      <label className="w-48 font-medium flex items-center gap-4 mt-4">
                        Address:
                      </label>

                      <div className="flex-1">
                        <AddressGroupRenderer
                          fields={addressFields}
                          values={customFieldValues}
                          onChange={handleCustomFieldChange}
                          isEditMode={isEditMode}
                          entityType="hiring-managers"
                        />
                      </div>
                    </div>
                  );
                }

                // Skip individual address fields so they don't render twice
                if (addressFieldIdSet.has(field.id)) {
                  return null;
                }

                // Hide Full Address field (combined display only; address is shown via Address group above)
                const labelNorm = (field.field_label ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
                const isFullAddressField =
                  labelNorm.includes("full") && labelNorm.includes("address");
                if (isFullAddressField) return null;

                // Don't render hidden fields at all (neither label nor input)
                if (field.is_hidden) return null;

                // Determine if field should be read-only
                const fieldLabel = field.field_label.toLowerCase();
                const isOrganizationNameField =
                  (fieldLabel.includes("organization") || fieldLabel.includes("company")) &&
                  !fieldLabel.includes("phone") &&
                  !fieldLabel.includes("address");
                const shouldBeReadOnly =
                  isOrganizationNameField &&
                  organizationIdFromUrl &&
                  !hiringManagerId; // Read-only when auto-populated from URL in create mode

                const fieldValue = customFieldValues[field.field_name] || "";
                const fn = field.field_name ?? "";
                const isEmailDuplicateField =
                  fn === HM_DUP_PRIMARY_EMAIL_FIELD_NAME ||
                  fn.toLowerCase() === HM_DUP_PRIMARY_EMAIL_FIELD_NAME.toLowerCase();

                return (
                  <div key={field.id} className="flex items-center gap-4 mt-4">
                    <label className="w-48 font-medium flex items-center">
                      {field.field_label}:
                    </label>
                    <div className="flex-1 relative">
                      {shouldBeReadOnly ? (
                        // Render read-only organization name (readable name only, no ID)
                        <input
                          type="text"
                          value={organizationName || fieldValue || ""}
                          readOnly
                          className="w-full p-2 border-b border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                          title="Organization name is auto-populated from the selected organization"
                        />
                      ) : (
                        <>
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            allFields={customFields}
                            values={customFieldValues}
                            onChange={handleCustomFieldChange}
                            className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
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
                          {isEmailDuplicateField &&
                            emailDupMatches.length > 0 && (
                              <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                <div className="font-semibold mb-1">
                                  Possible duplicate hiring manager(s) detected
                                </div>
                                <div className="space-y-1">
                                  <div className="font-medium">Same email:</div>
                                  <ul className="list-disc list-inside">
                                    {emailDupMatches.map((hm) => (
                                      <li key={hm.id}>
                                        <a
                                          href={`/dashboard/hiring-managers/view?id=${hm.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          {hm.name}
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
              disabled={
                isSubmitting ||
                !isFormValid ||
                (emailDupMatches.length > 0 && !hasConfirmedEmailDupSave)
              }
              className={`px-4 py-2 rounded ${isSubmitting ||
                !isFormValid ||
                (emailDupMatches.length > 0 && !hasConfirmedEmailDupSave)
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
