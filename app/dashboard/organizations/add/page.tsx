"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";
import AddressGroupRenderer, { getAddressFields } from "@/components/AddressGroupRenderer";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";


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

// Map admin field labels to backend organization columns (all fields driven by admin; no hardcoded standard fields)
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Name": "name",
  "Organization Name": "name",
  "Organization": "name",
  "Company": "name",
  "Nicknames": "nicknames",
  "Nickname": "nicknames",
  "Parent Organization": "parent_organization",
  "Website": "website",
  "Organization Website": "website",
  "URL": "website",
  "Contact Phone": "contact_phone",
  "Main Phone": "contact_phone",
  "Address": "address",
  "Status": "status",
  "Contract Signed on File": "contract_on_file",
  "Contract Signed By": "contract_signed_by",
  "Date Contract Signed": "date_contract_signed",
  "Year Founded": "year_founded",
  "Overview": "overview",
  "Organization Overview": "overview",
  "About": "overview",
  "Standard Perm Fee (%)": "perm_fee",
  "# of Employees": "num_employees",
  "# of Offices": "num_offices",
};

export default function AddOrganization() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!organizationId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!organizationId);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    phone: Array<{ id: string | number; name: string }>;
    website: Array<{ id: string | number; name: string }>;
    email: Array<{ id: string | number; name: string }>;
  } | null>(null);
  const hasFetchedRef = useRef(false); // Track if we've already fetched organization data
  const [activeUsers, setActiveUsers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [organizationContacts, setOrganizationContacts] = useState<
    Array<{ id: string; name: string; full_name?: string; first_name?: string; last_name?: string }>
  >([]);
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("organizations");
  const addressFields = useMemo(
    () => getAddressFields(customFields),
    [customFields]
  );
  const sortedCustomFields = useMemo(() => {
    return [...customFields].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [customFields]);

  const addressFieldIdSet = useMemo(() => {
    return new Set(addressFields.map((f) => f.id));
  }, [addressFields]);

  // Sub-fields of composite types are rendered inside the composite; skip them as standalone rows
  const compositeSubFieldIdSet = useMemo(() => {
    const ids: string[] = [];
    customFields.forEach((f: any) => {
      if (f.field_type === "composite" && Array.isArray(f.sub_field_ids)) {
        f.sub_field_ids.forEach((id: number | string) => ids.push(String(id)));
      }
    });
    return new Set(ids);
  }, [customFields]);

  const addressAnchorId = addressFields?.[0]?.id; // usually Field_20 (Address)

  // All organization fields come from admin field definitions; values live in customFieldValues

  // Memoize fetchOrganization to prevent it from being recreated on every render
  const fetchOrganization = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/organizations/${id}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to fetch organization details"
          );
        }

        const data = await response.json();
        console.log("API Response:", data); // Check if backend ne bheja ya nahi
        const org = data.organization;

        console.log("Received organization data:", org);

        // Parse existing custom fields from the organization
        let existingCustomFields: Record<string, any> = {};
        if (org.custom_fields) {
          try {
            existingCustomFields =
              typeof org.custom_fields === "string"
                ? JSON.parse(org.custom_fields)
                : org.custom_fields;
          } catch (e) {
            console.error("Error parsing existing custom fields:", e);
          }
        }

        // Map custom fields from field_label (database key) to field_name (form key)
        // Custom fields are stored with field_label as keys, but form uses field_name
        const mappedCustomFieldValues: Record<string, any> = {};

        // First, map any existing custom field values from the database
        // PRIORITY: customFields["Status"] takes precedence over org.status (matching Summary view)
        if (
          customFields.length > 0 &&
          Object.keys(existingCustomFields).length > 0
        ) {
          customFields.forEach((field) => {
            // Try to find the value by field_label (as stored in DB)
            const value = existingCustomFields[field.field_label];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
              // Map to field_name for the form
              mappedCustomFieldValues[field.field_name] = value;
            }
          });
        }

        // Second, map standard organization fields to custom fields based on field labels
        // This ensures that standard fields like "name", "nicknames" etc. populate custom fields
        // with matching labels like "Organization Name", "Nicknames", etc.
        // NOTE: For Status, only use org.status as fallback if customFields["Status"] doesn't exist
        if (customFields.length > 0) {
          // Check if Status was already set from customFields (prioritize customFields["Status"])
          const statusField = customFields.find(
            (f) => f.field_label?.toLowerCase() === "status" || f.field_name?.toLowerCase() === "status"
          );
          const statusFromCustomFields = statusField && mappedCustomFieldValues[statusField.field_name];

          const standardFieldMapping: Record<string, string> = {
            // Organization name variations
            "Organization Name": org.name || "",
            "Organization": org.name || "",
            "Company": org.name || "",
            "Name": org.name || "",
            // Nicknames variations
            "Nicknames": org.nicknames || "",
            "Nickname": org.nicknames || "",
            // Parent org
            "Parent Organization": org.parent_organization || "",
            // Website variations
            "Website": org.website || "",
            "Organization Website": org.website || "",
            "URL": org.website || "",
            // Phone
            "Contact Phone": org.contact_phone || "",
            "Main Phone": org.contact_phone || "",
            // Address
            "Address": org.address || "",
            // Status: Use customFields["Status"] if available, otherwise fallback to org.status
            // This matches Summary view behavior - both prioritize customFields["Status"]
            "Status": statusFromCustomFields || (org.status || ""),
            // Contract fields
            "Contract Signed on File": org.contract_on_file || "No",
            "Contract Signed By": org.contract_signed_by || "",
            "Date Contract Signed": org.date_contract_signed
              ? org.date_contract_signed.split("T")[0]
              : "",
            // Year founded
            "Year Founded": org.year_founded || "",
            // Overview
            "Overview": org.overview || "",
            "Organization Overview": org.overview || "",
            "About": org.overview || "",
            // Perm fee
            "Standard Perm Fee (%)": org.perm_fee ? org.perm_fee.toString() : "",
            // Employees/offices
            "# of Employees": org.num_employees ? org.num_employees.toString() : "",
            "# of Offices": org.num_offices ? org.num_offices.toString() : "",
          };

          customFields.forEach((field) => {
            // Only set if not already set from existingCustomFields
            // This ensures customFields["Status"] takes precedence over org.status
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

        // Debug Status field specifically
        const statusFieldDebug = customFields.find(
          (f) => f.field_label?.toLowerCase() === "status" || f.field_name?.toLowerCase() === "status"
        );
        if (statusFieldDebug) {
          console.log("Status field found:", {
            field_name: statusFieldDebug.field_name,
            field_label: statusFieldDebug.field_label,
            value_in_existingCustomFields: existingCustomFields[statusFieldDebug.field_label],
            value_in_mappedCustomFieldValues: mappedCustomFieldValues[statusFieldDebug.field_name],
          });
        } else {
          console.warn("Status field NOT found in customFields definitions!");
        }

        // All values live in customFieldValues (field_name as keys)
        setCustomFieldValues(mappedCustomFieldValues);
      } catch (err) {
        console.error("Error fetching organization:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching organization details"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [customFields, setCustomFieldValues]
  );

  // If organizationId is present, fetch the organization data
  // Wait for customFields to load before fetching to ensure proper mapping
  useEffect(() => {
    // Only fetch if we have an organizationId, customFields are loaded, and we haven't fetched yet
    if (
      organizationId &&
      !customFieldsLoading &&
      customFields.length > 0 &&
      !hasFetchedRef.current
    ) {
      hasFetchedRef.current = true;
      fetchOrganization(organizationId);
    }
    // Reset the ref when organizationId changes or is removed
    if (!organizationId) {
      hasFetchedRef.current = false;
    }
  }, [
    organizationId,
    customFieldsLoading,
    customFields.length,
    fetchOrganization,
  ]);

  // Fetch active users for Owner dropdown
  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const response = await fetch("/api/users/active", {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setActiveUsers(data.users || []);
        }
      } catch (error) {
        console.error("Error fetching active users:", error);
      }
    };
    fetchActiveUsers();
  }, []);

  // Fetch organization contacts (hiring managers) for Contract Signed By dropdown
  useEffect(() => {
    const fetchOrganizationContacts = async () => {
      if (!organizationId) {
        setOrganizationContacts([]);
        return;
      }

      try {
        const response = await fetch("/api/hiring-managers", {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Filter hiring managers by organization_id
          const orgContacts = (data.hiringManagers || []).filter(
            (hm: any) =>
              hm.organization_id?.toString() === organizationId.toString()
          );
          setOrganizationContacts(orgContacts);
        }
      } catch (error) {
        console.error("Error fetching organization contacts:", error);
      }
    };
    fetchOrganizationContacts();
  }, [organizationId]);

  // Auto-populate Field_18 (Owner) field in UI when customFields are loaded
  useEffect(() => {
    // Wait for customFields to load
    if (customFieldsLoading || customFields.length === 0) return;

    // Find Field_18 specifically - check both field_name and field_label
    const ownerField = customFields.find(
      (f) =>
        f.field_name === "Field_18" ||
        f.field_name === "field_18" ||
        f.field_name?.toLowerCase() === "field_18" ||
        (f.field_label === "Owner" &&
          (f.field_name?.includes("18") ||
            f.field_name?.toLowerCase().includes("field_18")))
    );

    if (ownerField) {
      const currentOwnerValue = customFieldValues[ownerField.field_name];
      // Only auto-populate if field is empty (works in both create and edit mode)
      if (!currentOwnerValue || currentOwnerValue.trim() === "") {
        try {
          const userDataStr = getCookie("user");
          if (userDataStr) {
            const userData = JSON.parse(userDataStr as string);
            if (userData.name) {
              setCustomFieldValues((prev) => ({
                ...prev,
                [ownerField.field_name]: userData.name,
              }));
              console.log(
                "Auto-populated Field_18 (Owner) with current user:",
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

  // Clear duplicate warning when user changes phone, website, or email so they can fix and save
  const phoneWebsiteEmailValuesKey = useMemo(() => {
    const labels = [
      "Contact Phone",
      "Main Phone",
      "Website",
      "Organization Website",
      "URL",
      "Email",
      "Organization Email",
    ];
    const parts: string[] = [];
    customFields.forEach((f) => {
      if (labels.some((l) => l === f.field_label || f.field_label?.toLowerCase() === l.toLowerCase())) {
        parts.push(String(customFieldValues[f.field_name] ?? ""));
      }
    });
    return parts.join("|");
  }, [customFields, customFieldValues]);

  useEffect(() => {
    if (!duplicateWarning) return;
    setDuplicateWarning(null);
  }, [phoneWebsiteEmailValuesKey]);

  // Removed console.logs from component level to prevent excessive logging on every render
  //console.log("Custom Fields:", customFields);


  // const validateForm = () => {
  //   // Validate required standard fields
  //   if (!formData.name.trim()) {
  //     setError("Organization name is required");
  //     return false;
  //   }
  //   if (!formData.website.trim()) {
  //     setError("Website is required");
  //     return false;
  //   }
  //   if (!formData.overview.trim()) {
  //     setError("Organization overview is required");
  //     return false;
  //   }

  //   // Basic website URL validation
  //   if (
  //     !formData.website.startsWith("http://") &&
  //     !formData.website.startsWith("https://")
  //   ) {
  //     setError("Website must start with http:// or https://");
  //     return false;
  //   }

  //   // Validate required custom fields
  //   const customFieldValidation = validateCustomFields();
  //   if (!customFieldValidation.isValid) {
  //     setError(customFieldValidation.message);
  //     return false;
  //   }

  //   return true;
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate custom fields first
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    // Validate address fields if they exist
    if (addressFields.length > 0) {
      const requiredAddressFields = addressFields.filter((f) => f.is_required);
      for (const field of requiredAddressFields) {
        const value = customFieldValues[field.field_name];
        if (!value || String(value).trim() === "") {
          setError(`${field.field_label} is required`);
          return;
        }

        // Special validation for ZIP code
        // Check by both label and field_name (Field_24)
        const isZipCodeField =
          field.field_label?.toLowerCase().includes("zip") ||
          field.field_label?.toLowerCase().includes("postal code") ||
          field.field_name?.toLowerCase().includes("zip") ||
          field.field_name === "Field_24" || // ZIP Code
          field.field_name === "field_24";
        if (isZipCodeField) {
          const zipValue = String(value).trim();
          if (!/^\d{5}$/.test(zipValue)) {
            setError(`${field.field_label} must be exactly 5 digits`);
            return;
          }
        }
      }
    }

    // Validate conditional requirement: Contract Signed By is required when Contract Signed on File is "Yes"
    const contractSignedOnFileField = customFields.find(
      (f) =>
        f.field_name === "Field_8" ||
        f.field_name === "field_8" ||
        f.field_name?.toLowerCase() === "field_8" ||
        (f.field_label === "Contract Signed on File" &&
          (f.field_name?.includes("8") ||
            f.field_name?.toLowerCase().includes("field_8")))
    );

    const contractSignedByField = customFields.find(
      (f) =>
        f.field_name === "Field_9" ||
        f.field_name === "field_9" ||
        f.field_name?.toLowerCase() === "field_9" ||
        (f.field_label === "Contract Signed By" &&
          (f.field_name?.includes("9") ||
            f.field_name?.toLowerCase().includes("field_9")))
    );

    let contractSignedOnFileValue = "";
    if (contractSignedOnFileField) {
      contractSignedOnFileValue =
        customFieldValues[contractSignedOnFileField.field_name] || "";
    }

    if (contractSignedByField) {
      const contractSignedByValue =
        customFieldValues[contractSignedByField.field_name] || "";

      // If Contract Signed on File is "Yes", Contract Signed By is required
      if (
        String(contractSignedOnFileValue).trim() === "Yes" &&
        (!contractSignedByValue || String(contractSignedByValue).trim() === "")
      ) {
        setError(
          `${contractSignedByField.field_label} is required when Contract Signed on File is set to "Yes"`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      // ✅ CRITICAL: Get custom fields from the hook
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

      // Build API payload from admin-defined fields only: map labels to backend columns or custom_fields
      const apiData: Record<string, any> = {
        name: "Unnamed Organization",
        status: "Active",
        contract_on_file: "No",
        custom_fields: {},
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

      apiData.custom_fields = customFieldsForDB;
      if (!apiData.name || String(apiData.name).trim() === "") {
        apiData.name = "Unnamed Organization";
      }

      // Check for duplicate phone, website, or email before saving
      const phoneForCheck = String(apiData.contact_phone ?? "").trim();
      const websiteForCheck = String(apiData.website ?? "").trim();
      const emailForCheck = String(
        customFieldsForDB["Email"] ??
        customFieldsForDB["Organization Email"] ??
        customFieldsForDB["email"] ??
        ""
      ).trim();

      if (phoneForCheck || websiteForCheck || emailForCheck) {
        const params = new URLSearchParams();
        if (phoneForCheck) params.set("phone", phoneForCheck);
        if (websiteForCheck) params.set("website", websiteForCheck);
        if (emailForCheck) params.set("email", emailForCheck);
        if (isEditMode && organizationId) params.set("excludeId", organizationId);

        const dupRes = await fetch(
          `/api/organizations/check-duplicates?${params.toString()}`
        );
        const dupData = await dupRes.json();

        if (dupData.success && dupData.duplicates) {
          const { phone: dupPhone, website: dupWebsite, email: dupEmail } =
            dupData.duplicates;
          const hasDuplicates =
            (dupPhone?.length ?? 0) > 0 ||
            (dupWebsite?.length ?? 0) > 0 ||
            (dupEmail?.length ?? 0) > 0;

          if (hasDuplicates) {
            const messages: string[] = [];
            if ((dupPhone?.length ?? 0) > 0) {
              const names = (dupPhone as Array<{ name: string }>).map((o) => o.name).join(", ");
              messages.push(`Phone number is already used by: ${names}`);
            }
            if ((dupWebsite?.length ?? 0) > 0) {
              const names = (dupWebsite as Array<{ name: string }>).map((o) => o.name).join(", ");
              messages.push(`Website is already used by: ${names}`);
            }
            if ((dupEmail?.length ?? 0) > 0) {
              const names = (dupEmail as Array<{ name: string }>).map((o) => o.name).join(", ");
              messages.push(`Email is already used by: ${names}`);
            }
            setError(
              "Cannot save: the following are already in use by another organization. Please use different values or update the existing organization.\n\n" +
              messages.join("\n")
            );
            setDuplicateWarning({
              phone: dupPhone ?? [],
              website: dupWebsite ?? [],
              email: dupEmail ?? [],
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Coerce numeric columns
      if (apiData.num_employees != null) {
        const n = parseInt(String(apiData.num_employees), 10);
        apiData.num_employees = !isNaN(n) ? n : null;
      }
      if (apiData.num_offices != null) {
        const n = parseInt(String(apiData.num_offices), 10);
        apiData.num_offices = !isNaN(n) ? n : null;
      }

      // Auto-populate Owner field (Field_18) if not set (only in create mode)
      // Check both "Owner" label and Field_18 field_name
      const ownerFieldKey =
        Object.keys(customFieldsForDB).find(
          (key) => key === "Owner" || key.toLowerCase().includes("owner")
        ) ||
        Object.keys(customFieldsToSend).find((key) => {
          const field = customFields.find(
            (f) => f.field_name === "Field_18" || f.field_name === "field_18"
          );
          return field && customFieldsToSend[field.field_label] !== undefined;
        });

      if (!isEditMode) {
        // Find Field_18 in customFields
        const ownerField = customFields.find(
          (f) =>
            f.field_name === "Field_18" ||
            f.field_name === "field_18" ||
            (f.field_label === "Owner" && f.field_name?.includes("18"))
        );

        if (ownerField) {
          const ownerValue =
            customFieldsForDB[ownerField.field_label] ||
            customFieldValues[ownerField.field_name];

          if (!ownerValue || ownerValue.trim() === "") {
            try {
              const userDataStr = getCookie("user");
              if (userDataStr) {
                const userData = JSON.parse(userDataStr as string);
                if (userData.name) {
                  customFieldsForDB[ownerField.field_label] = userData.name;
                  console.log(
                    "Auto-populated Field_18 (Owner) with current user:",
                    userData.name
                  );
                }
              }
            } catch (e) {
              console.error("Error parsing user data from cookie:", e);
            }
          }
        } else if (
          ownerFieldKey &&
          (!customFieldsForDB[ownerFieldKey] ||
            customFieldsForDB[ownerFieldKey].trim() === "")
        ) {
          // Fallback to old "Owner" key logic
          try {
            const userDataStr = getCookie("user");
            if (userDataStr) {
              const userData = JSON.parse(userDataStr as string);
              if (userData.name) {
                customFieldsForDB[ownerFieldKey] = userData.name;
                console.log(
                  "Auto-populated Owner with current user:",
                  userData.name
                );
              }
            }
          } catch (e) {
            console.error("Error parsing user data from cookie:", e);
          }
        }
      }

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

      // Validate that custom_fields is always a plain object (not array, not null, not other types)
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

      // Ensure custom_fields is a plain object (not a class instance or special object)
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

      // Remove any potential conflicting keys that might cause backend issues
      // Don't send both customFields and custom_fields
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

      // Create a clean payload object to ensure no type issues
      // IMPORTANT: Order matters - custom_fields should be last to avoid parameter position issues
      const cleanPayload: Record<string, any> = {};

      // Add all fields explicitly, ensuring no undefined values
      if (apiData.name !== undefined) cleanPayload.name = apiData.name || "";
      if (apiData.nicknames !== undefined)
        cleanPayload.nicknames = apiData.nicknames || "";
      if (apiData.parent_organization !== undefined)
        cleanPayload.parent_organization = apiData.parent_organization || "";
      if (apiData.website !== undefined)
        cleanPayload.website = apiData.website || "";
      if (apiData.status !== undefined)
        cleanPayload.status = apiData.status || "Active";
      if (apiData.contract_on_file !== undefined)
        cleanPayload.contract_on_file = apiData.contract_on_file || "No";
      if (apiData.contract_signed_by !== undefined)
        cleanPayload.contract_signed_by = apiData.contract_signed_by || null;
      if (apiData.year_founded !== undefined)
        cleanPayload.year_founded = apiData.year_founded || "";
      if (apiData.overview !== undefined)
        cleanPayload.overview = apiData.overview || "";
      if (apiData.perm_fee !== undefined)
        cleanPayload.perm_fee = apiData.perm_fee || "";
      if (apiData.contact_phone !== undefined)
        cleanPayload.contact_phone = apiData.contact_phone || "";
      if (apiData.address !== undefined)
        cleanPayload.address = apiData.address || "";

      // Handle date_contract_signed separately - explicitly set to null if empty
      if (apiData.date_contract_signed !== undefined) {
        if (
          apiData.date_contract_signed &&
          typeof apiData.date_contract_signed === "string" &&
          apiData.date_contract_signed.trim() !== ""
        ) {
          cleanPayload.date_contract_signed = apiData.date_contract_signed;
        } else {
          cleanPayload.date_contract_signed = null;
        }
      }

      // Only add numeric fields if they exist and are valid (before custom_fields)
      if (
        apiData.num_employees !== undefined &&
        apiData.num_employees !== null &&
        apiData.num_employees !== ""
      ) {
        cleanPayload.num_employees = apiData.num_employees;
      }
      if (
        apiData.num_offices !== undefined &&
        apiData.num_offices !== null &&
        apiData.num_offices !== ""
      ) {
        cleanPayload.num_offices = apiData.num_offices;
      }

      // IMPORTANT: Add custom_fields LAST to ensure it's processed correctly by backend
      // Ensure custom_fields is always a plain object (not array, not null, not other types)
      const customFieldsValue =
        typeof apiData.custom_fields === "object" &&
          !Array.isArray(apiData.custom_fields) &&
          apiData.custom_fields !== null
          ? apiData.custom_fields
          : {};

      // Final serialization to ensure it's a plain object
      cleanPayload.custom_fields = JSON.parse(
        JSON.stringify(customFieldsValue)
      );

      console.log("=== CLEAN PAYLOAD ===");
      console.log("cleanPayload.custom_fields:", cleanPayload.custom_fields);
      console.log(
        "cleanPayload.custom_fields type:",
        typeof cleanPayload.custom_fields
      );
      console.log("cleanPayload keys:", Object.keys(cleanPayload));
      console.log("Full cleanPayload:", JSON.stringify(cleanPayload, null, 2));
      console.log("=== END CLEAN PAYLOAD ===");

      // Double-check: ensure custom_fields is definitely an object before sending
      if (
        typeof cleanPayload.custom_fields !== "object" ||
        cleanPayload.custom_fields === null ||
        Array.isArray(cleanPayload.custom_fields)
      ) {
        console.error(
          "CRITICAL: custom_fields is not valid before sending!",
          cleanPayload.custom_fields
        );
        cleanPayload.custom_fields = {};
      }

      let response;
      if (isEditMode && organizationId) {
        response = await fetch(`/api/organizations/${organizationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanPayload),
        });
      } else {
        response = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanPayload),
        });
      }

      const responseText = await response.text();
      console.log(
        `API ${isEditMode ? "update" : "create"} response:`,
        responseText
      );

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        console.error("Failed to parse response:", error);
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          `Failed to ${isEditMode ? "update" : "create"} organization`
        );
      }

      const id = isEditMode ? organizationId : data.organization.id;
      router.push(`/dashboard/organizations/view?id=${id}`);
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} organization:`,
        err
      );
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   setIsSubmitting(true);
  //   setError(null);

  //   try {
  //     // ✅ Get custom fields from the hook - THIS IS THE KEY FIX
  //     const customFieldsToSend = getCustomFieldsForSubmission();

  //     console.log("Custom Fields to Send:", customFieldsToSend);

  //     // Map custom fields to standard fields if they exist
  //     const name =
  //       customFieldsToSend["Organization Name"] ||
  //       customFieldsToSend["Name"] ||
  //       formData.name ||
  //       "Unnamed Organization";

  //     const website =
  //       customFieldsToSend["Website"] ||
  //       customFieldsToSend["Organization Website"] ||
  //       formData.website ||
  //       "";

  //     const overview =
  //       customFieldsToSend["Overview"] ||
  //       customFieldsToSend["Organization Overview"] ||
  //       customFieldsToSend["About"] ||
  //       formData.overview ||
  //       "";

  //     const apiData = {
  //       name: name,
  //       nicknames: customFieldsToSend["Nicknames"] || formData.nicknames,
  //       parent_organization:
  //         customFieldsToSend["Parent Organization"] ||
  //         formData.parentOrganization,
  //       website: website,
  //       status: customFieldsToSend["Status"] || formData.status,
  //       contract_on_file: formData.contractOnFile,
  //       contract_signed_by: formData.contractSignedBy,
  //       date_contract_signed: formData.dateContractSigned || null,
  //       year_founded:
  //         customFieldsToSend["Year Founded"] || formData.yearFounded,
  //       overview: overview,
  //       perm_fee:
  //         customFieldsToSend["Standard Perm Fee (%)"] || formData.permFee,
  //       num_employees: customFieldsToSend["# of Employees"]
  //         ? parseInt(customFieldsToSend["# of Employees"])
  //         : formData.numEmployees
  //         ? parseInt(formData.numEmployees)
  //         : null,
  //       num_offices: customFieldsToSend["# of Offices"]
  //         ? parseInt(customFieldsToSend["# of Offices"])
  //         : formData.numOffices
  //         ? parseInt(formData.numOffices)
  //         : null,
  //       contact_phone:
  //         customFieldsToSend["Contact Phone"] || formData.contactPhone,
  //       address: customFieldsToSend["Address"] || formData.address,
  //       // ✅ FIX: Send the actual custom fields object, not empty object
  //       custom_fields: customFieldsToSend, // Changed from customFieldsToSend
  //     };

  //     console.log(
  //       "Sending organization data to API:",
  //       JSON.stringify(apiData, null, 2)
  //     );

  //     let response;
  //     if (isEditMode && organizationId) {
  //       response = await fetch(`/api/organizations/${organizationId}`, {
  //         method: "PUT",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(apiData),
  //       });
  //     } else {
  //       response = await fetch("/api/organizations", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(apiData),
  //       });
  //     }

  //     const responseText = await response.text();
  //     console.log(
  //       `API ${isEditMode ? "update" : "create"} response:`,
  //       responseText
  //     );

  //     let data;
  //     try {
  //       data = JSON.parse(responseText);
  //     } catch (error) {
  //       console.error("Failed to parse response:", error);
  //       throw new Error("Invalid response from server");
  //     }

  //     if (!response.ok) {
  //       throw new Error(
  //         data.message ||
  //           `Failed to ${isEditMode ? "update" : "create"} organization`
  //       );
  //     }

  //     const id = isEditMode ? organizationId : data.organization.id;
  //     router.push(`/dashboard/organizations/view?id=${id}`);
  //   } catch (err) {
  //     console.error(
  //       `Error ${isEditMode ? "updating" : "creating"} organization:`,
  //       err
  //     );
  //     setError(
  //       err instanceof Error ? err.message : "An unexpected error occurred"
  //     );
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   // if (!validateForm()) {
  //   //   return;
  //   // }

  //   setIsSubmitting(true);
  //   setError(null);

  //   try {
  //     // Prepare custom fields for submission
  //     const customFieldsToSend = getCustomFieldsForSubmission();

  //     console.log("Custom Fields to Send:", customFieldsToSend);

  //     // Map custom fields to standard fields if they exist
  //     // This allows custom fields to populate the required backend fields
  //     const name =
  //       customFieldsToSend["Organization Name"] ||
  //       customFieldsToSend["Name"] ||
  //       formData.name ||
  //       "Unnamed Organization";

  //     const website =
  //       customFieldsToSend["Website"] ||
  //       customFieldsToSend["Organization Website"] ||
  //       formData.website ||
  //       "";

  //     const overview =
  //       customFieldsToSend["Overview"] ||
  //       customFieldsToSend["Organization Overview"] ||
  //       customFieldsToSend["About"] ||
  //       formData.overview ||
  //       "";

  //     const apiData = {
  //       name: name,
  //       nicknames: customFieldsToSend["Nicknames"] || formData.nicknames,
  //       parent_organization:
  //         customFieldsToSend["Parent Organization"] ||
  //         formData.parentOrganization,
  //       website: website,
  //       status: customFieldsToSend["Status"] || formData.status,
  //       contract_on_file: formData.contractOnFile,
  //       contract_signed_by: formData.contractSignedBy,
  //       date_contract_signed: formData.dateContractSigned || null,
  //       year_founded:
  //         customFieldsToSend["Year Founded"] || formData.yearFounded,
  //       overview: overview,
  //       perm_fee:
  //         customFieldsToSend["Standard Perm Fee (%)"] || formData.permFee,
  //       num_employees: customFieldsToSend["# of Employees"]
  //         ? parseInt(customFieldsToSend["# of Employees"])
  //         : formData.numEmployees
  //         ? parseInt(formData.numEmployees)
  //         : null,
  //       num_offices: customFieldsToSend["# of Offices"]
  //         ? parseInt(customFieldsToSend["# of Offices"])
  //         : formData.numOffices
  //         ? parseInt(formData.numOffices)
  //         : null,
  //       contact_phone:
  //         customFieldsToSend["Contact Phone"] || formData.contactPhone,
  //       address: customFieldsToSend["Address"] || formData.address,
  //       // custom_fields: JSON.stringify(customFieldsToSend),
  //       custom_fields: customFieldsToSend,
  //     };

  //     console.log(
  //       "Sending organization data to API:",
  //       JSON.stringify(apiData, null, 2)
  //     );

  //     let response;
  //     if (isEditMode && organizationId) {
  //       response = await fetch(`/api/organizations/${organizationId}`, {
  //         method: "PUT",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(apiData),
  //       });
  //     } else {
  //       response = await fetch("/api/organizations", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(apiData),
  //       });
  //     }

  //     const responseText = await response.text();
  //     console.log(
  //       `API ${isEditMode ? "update" : "create"} response:`,
  //       responseText
  //     );

  //     let data;
  //     try {
  //       data = JSON.parse(responseText);
  //     } catch (error) {
  //       console.error("Failed to parse response:", error);
  //       throw new Error("Invalid response from server");
  //     }

  //     if (!response.ok) {
  //       throw new Error(
  //         data.message ||
  //           `Failed to ${isEditMode ? "update" : "create"} organization`
  //       );
  //     }

  //     const id = isEditMode ? organizationId : data.organization.id;
  //     router.push(`/dashboard/organizations/view?id=${id}`);
  //   } catch (err) {
  //     console.error(
  //       `Error ${isEditMode ? "updating" : "creating"} organization:`,
  //       err
  //     );
  //     setError(
  //       err instanceof Error ? err.message : "An unexpected error occurred"
  //     );
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  const handleGoBack = () => {
    router.back();
  };

  // Compute whether all required fields are satisfied (for disabling Update/Save until valid)
  const isFormValid = useMemo(() => {
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) return false;

    // Address required fields
    if (addressFields.length > 0) {
      const requiredAddressFields = addressFields.filter((f) => f.is_required);
      for (const field of requiredAddressFields) {
        const value = customFieldValues[field.field_name];
        if (!value || String(value).trim() === "") return false;
        const isZipCodeField =
          field.field_label?.toLowerCase().includes("zip") ||
          field.field_label?.toLowerCase().includes("postal code") ||
          field.field_name?.toLowerCase().includes("zip") ||
          field.field_name === "Field_24" ||
          field.field_name === "field_24";
        if (isZipCodeField && !/^\d{5}$/.test(String(value).trim())) return false;
      }
    }

    // Contract Signed By required when Contract Signed on File is "Yes"
    const contractSignedOnFileField = customFields.find(
      (f) =>
        f.field_name === "Field_8" ||
        f.field_name === "field_8" ||
        (f.field_label === "Contract Signed on File" && f.field_name?.toLowerCase().includes("field_8"))
    );
    const contractSignedByField = customFields.find(
      (f) =>
        f.field_name === "Field_9" ||
        f.field_name === "field_9" ||
        (f.field_label === "Contract Signed By" && f.field_name?.toLowerCase().includes("field_9"))
    );
    if (contractSignedOnFileField && contractSignedByField) {
      const contractOnFileValue =
        customFieldValues[contractSignedOnFileField.field_name] || "";
      const contractSignedByValue =
        customFieldValues[contractSignedByField.field_name] || "";
      if (
        String(contractOnFileValue).trim() === "Yes" &&
        (!contractSignedByValue || String(contractSignedByValue).trim() === "")
      ) {
        return false;
      }
    }

    return true;
  }, [
    customFieldValues,
    customFields,
    addressFields,
    validateCustomFields,
  ]);

  if (isLoading) {
    return <LoadingScreen message="Loading organization data..." />;
  }

  if (isSubmitting) {
    return (
      <LoadingScreen
        message={
          isEditMode ? "Updating organization..." : "Creating organization..."
        }
      />
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
              alt="Organization"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Organization
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* <button
              onClick={() =>
                router.push(
                  "/dashboard/admin/field-mapping?section=organizations"
                )
              }
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

        {/* Error message (includes duplicate phone/website/email warning) */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Standard Organization Fields */}
            {/* <div className="flex items-center">
              <label className="w-48 font-medium">Organization Name:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Nicknames:</label>
              <input
                type="text"
                name="nicknames"
                value={formData.nicknames}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="Alternate names for the organization"
              />
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Parent Organization:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="parentOrganization"
                  value={formData.parentOrganization}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Parent company name, if applicable"
                />
                <button type="button" className="absolute right-2 top-2">
                  <Image
                    src="/search.svg"
                    alt="Search"
                    width={16}
                    height={16}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Organization Website:</label>
              <div className="flex-1 relative">
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="https://www.example.com"
                  
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Contact Phone:</label>
              <div className="flex-1">
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. (123) 456-7890"
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Address:</label>
              <div className="flex-1">
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Organization address"
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Status:</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">
                Contract Signed on File:
              </label>
              <select
                name="contractOnFile"
                value={formData.contractOnFile}
                onChange={handleChange}
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Contract Signed By:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="contractSignedBy"
                  value={formData.contractSignedBy}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Name of signatory"
                />
                <button type="button" className="absolute right-2 top-2">
                  <Image
                    src="/search.svg"
                    alt="Search"
                    width={16}
                    height={16}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Date Contract Signed:</label>
              <div className="flex-1 relative">
                <input
                  type="date"
                  name="dateContractSigned"
                  value={formData.dateContractSigned}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                />
                <button type="button" className="absolute right-2 top-2">
                  <Image
                    src="/calendar.svg"
                    alt="Calendar"
                    width={16}
                    height={16}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Year Founded:</label>
              <input
                type="text"
                name="yearFounded"
                value={formData.yearFounded}
                onChange={handleChange}
                placeholder="YYYY"
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium align-top mt-2">
                Organization Overview:
              </label>
              <div className="flex-1 relative">
                <textarea
                  name="overview"
                  value={formData.overview}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  rows={4}
                  placeholder="Provide a brief overview of the organization"
                  
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Standard Perm Fee (%):</label>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="permFee"
                  value={formData.permFee}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. 20"
                />
                <span className="absolute right-2 top-2">%</span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium"># of Employees:</label>
              <input
                type="number"
                min="0"
                name="numEmployees"
                value={formData.numEmployees}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="Approximate number of employees"
              />
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium"># of Offices:</label>
              <input
                type="number"
                min="0"
                name="numOffices"
                value={formData.numOffices}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="Number of office locations"
              />
            </div> */}

            {/* Custom Fields Section */}
            {customFields.length > 0 && (
              <>
                {/* <div className="mt-8 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                    Additional Information
                  </h3>
                </div> */}

                {sortedCustomFields.map((field) => {
                  if (
                    addressFields.length > 0 &&
                    field.id === addressAnchorId
                  ) {
                    // Check if all required address fields are satisfied
                    const allAddressFieldsValid = () => {
                      const requiredFields = addressFields.filter((f) => f.is_required);
                      if (requiredFields.length === 0) return true; // No required fields, consider valid

                      return requiredFields.every((f) => {
                        const val = customFieldValues[f.field_name];

                        // For select fields, check if a valid option is selected
                        if (f.field_type === "select") {
                          if (!val || String(val).trim() === "" || String(val).trim().toLowerCase() === "select an option") {
                            return false;
                          }
                          return true;
                        }

                        if (!val || String(val).trim() === "") return false;

                        // Special validation for ZIP code (must be exactly 5 digits)
                        const isZipCodeField =
                          f.field_label?.toLowerCase().includes("zip") ||
                          f.field_label?.toLowerCase().includes("postal code") ||
                          f.field_name?.toLowerCase().includes("zip") ||
                          f.field_name === "Field_24" || // ZIP Code
                          f.field_name === "field_24";
                        if (isZipCodeField) {
                          return /^\d{5}$/.test(String(val).trim());
                        }

                        return true;
                      });
                    };

                    const hasRequiredAddressFields = addressFields.some((f) => f.is_required);
                    const allValid = allAddressFieldsValid();

                    return (
                      <div
                        key="address-group"
                        className="address-underline flex items-start mb-3"
                      >
                        {/* left side same label width space */}
                        <label className="w-48 font-medium flex items-center mt-4">
                          Address:
                          {/* Show green check only when all address sub-fields are satisfied */}
                          {hasRequiredAddressFields && allValid && (
                            <span className="text-green-500 ml-1">✔</span>
                          )}
                        </label>

                        {/* right side same as other inputs */}
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

                  // skip individual address fields so they don't render twice
                  if (addressFieldIdSet.has(field.id)) {
                    return null;
                  }

                  // skip sub-fields of composite (they render inside the composite)
                  if (compositeSubFieldIdSet.has(field.id)) {
                    return null;
                  }

                  // Don't render hidden fields at all (neither label nor input)
                  if (field.is_hidden) return null;
                  const addressFieldIds = addressFields.map((f) => f.id);
                  if (addressFieldIds.includes(field.id)) {
                    return null;
                  }
                  const fieldValue = customFieldValues[field.field_name] || "";

                  // Special handling for Field_18 (Owner) - render as dropdown with active users
                  const isOwnerField =
                    field.field_name === "Field_18" ||
                    field.field_name === "field_18" ||
                    field.field_name?.toLowerCase() === "field_18" ||
                    (field.field_label === "Owner" &&
                      (field.field_name?.includes("18") ||
                        field.field_name?.toLowerCase().includes("field_18")));

                  // Special handling for Field_8 (Contract Signed on File) - detect for conditional validation
                  const isContractSignedOnFileField =
                    field.field_name === "Field_8" ||
                    field.field_name === "field_8" ||
                    field.field_name?.toLowerCase() === "field_8" ||
                    (field.field_label === "Contract Signed on File" &&
                      (field.field_name?.includes("8") ||
                        field.field_name?.toLowerCase().includes("field_8")));

                  // Special handling for Field_9 (Contract Signed by) - render as contact lookup
                  const isContractSignedByField =
                    field.field_name === "Field_9" ||
                    field.field_name === "field_9" ||
                    field.field_name?.toLowerCase() === "field_9" ||
                    (field.field_label === "Contract Signed By" &&
                      (field.field_name?.includes("9") ||
                        field.field_name?.toLowerCase().includes("field_9")));

                  // Check if Contract Signed on File is "Yes" to conditionally require Contract Signed By
                  // Check both customFieldValues (Field_8) and formData.contractOnFile
                  const contractSignedOnFileField = customFields.find(
                    (f) =>
                      f.field_name === "Field_8" ||
                      f.field_name === "field_8" ||
                      f.field_name?.toLowerCase() === "field_8" ||
                      (f.field_label === "Contract Signed on File" &&
                        (f.field_name?.includes("8") ||
                          f.field_name?.toLowerCase().includes("field_8")))
                  );

                  let contractSignedOnFileValue = "";
                  if (contractSignedOnFileField?.field_name) {
                    contractSignedOnFileValue =
                      customFieldValues[contractSignedOnFileField.field_name] || "";
                  }

                  // Field_9 is conditionally required when Field_8 is "Yes"
                  const isContractSignedByRequired =
                    isContractSignedByField &&
                    String(contractSignedOnFileValue).trim() === "Yes";

                  // // Helper function to check if field has a valid value
                  // const hasValidValue = () => {
                  //   // Handle null, undefined, or empty values
                  //   if (fieldValue === null || fieldValue === undefined) return false;
                  //   const trimmed = String(fieldValue).trim();
                  //   // Empty string means no value selected (especially for select fields)
                  //   if (trimmed === "") return false;

                  //   // Special validation for date fields
                  //   if (field.field_type === "date") {
                  //     // Accept both YYYY-MM-DD (storage format) and mm/dd/yyyy (display format)
                  //     let dateToValidate = trimmed;

                  //     // If it's in mm/dd/yyyy format, convert to YYYY-MM-DD
                  //     if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                  //       const [month, day, year] = trimmed.split("/");
                  //       dateToValidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                  //     }

                  //     // Check if it's a valid date format (YYYY-MM-DD)
                  //     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                  //     if (!dateRegex.test(dateToValidate)) return false;

                  //     const date = new Date(dateToValidate);
                  //     if (isNaN(date.getTime())) return false;

                  //     // Additional validation: check if the date components match
                  //     const [year, month, day] = dateToValidate.split("-");
                  //     if (date.getFullYear() !== parseInt(year) ||
                  //         date.getMonth() + 1 !== parseInt(month) ||
                  //         date.getDate() !== parseInt(day)) {
                  //       return false; // Invalid date (e.g., 02/30/2024)
                  //     }

                  //     return true;
                  //   }

                  //   // Special validation for ZIP code (must be exactly 5 digits)
                  //   // Check by both label and field_name (Field_24)
                  //   const isZipCodeField =
                  //     field.field_label?.toLowerCase().includes("zip") ||
                  //     field.field_label?.toLowerCase().includes("postal code") ||
                  //     field.field_name?.toLowerCase().includes("zip") ||
                  //     field.field_name === "Field_24" || // ZIP Code
                  //     field.field_name === "field_24";
                  //   if (isZipCodeField) {
                  //     return /^\d{5}$/.test(trimmed);
                  //   }

                  //   // Special validation for numeric fields that allow values >= 0
                  //   // Check by both label and field_name (Field_32, Field_25, Field_31)
                  //   const isNonNegativeField =
                  //     field.field_label?.toLowerCase().includes("employees") ||
                  //     field.field_label?.toLowerCase().includes("offices") ||
                  //     field.field_label?.toLowerCase().includes("oasis key") ||
                  //     field.field_name?.toLowerCase().includes("employees") ||
                  //     field.field_name?.toLowerCase().includes("offices") ||
                  //     field.field_name?.toLowerCase().includes("oasis") ||
                  //     field.field_name === "Field_32" || // # of employees
                  //     field.field_name === "field_32" ||
                  //     field.field_name === "Field_25" || // # of offices
                  //     field.field_name === "field_25" ||
                  //     field.field_name === "Field_31" || // Oasis Key
                  //     field.field_name === "field_31";
                  //   if (isNonNegativeField && field.field_type === "number") {
                  //     const numValue = parseFloat(trimmed);
                  //     // Allow values >= 0 (0, 1, 2, etc.)
                  //     return !isNaN(numValue) && numValue >= 0;
                  //   }

                  //   // Special validation for phone fields (Main Phone, etc.)
                  //   // Check by both field_type and field_name (Field_5)
                  //   const isPhoneField =
                  //     field.field_type === "phone" ||
                  //     field.field_label?.toLowerCase().includes("phone") ||
                  //     field.field_name === "Field_5" || // Main Phone
                  //     field.field_name === "field_5";
                  //   if (isPhoneField && trimmed !== "") {
                  //     // Phone must be complete: exactly 10 digits formatted as (000) 000-0000
                  //     // Remove all non-numeric characters to check digit count
                  //     const digitsOnly = trimmed.replace(/\D/g, "");
                  //     // Must have exactly 10 digits
                  //     if (digitsOnly.length !== 10) {
                  //       return false;
                  //     }
                  //     // Check if formatted correctly as (000) 000-0000
                  //     const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
                  //     return phoneRegex.test(trimmed);
                  //   }

                  //   // Special validation for URL fields (Organization Website, etc.)
                  //   // Check by both field_type and field_name (Field_4)
                  //   const isUrlField =
                  //     field.field_type === "url" ||
                  //     field.field_label?.toLowerCase().includes("website") ||
                  //     field.field_label?.toLowerCase().includes("url") ||
                  //     field.field_name === "Field_4" || // Organization Website
                  //     field.field_name === "field_4";
                  //   if (isUrlField && trimmed !== "") {
                  //     // URL must start with http://, https://, or www.
                  //     const urlPattern = /^(https?:\/\/|www\.).+/i;
                  //     if (!urlPattern.test(trimmed)) {
                  //       return false;
                  //     }

                  //     // Stricter validation: Check for complete domain structure
                  //     // For www. URLs: must have www.domain.tld format (at least www. + domain + . + tld)
                  //     // For http:// URLs: must have http://domain.tld format
                  //     let urlToValidate = trimmed;
                  //     if (trimmed.toLowerCase().startsWith('www.')) {
                  //       // Check if www. URL has complete domain (at least www.domain.tld)
                  //       // Remove www. and check if remaining has at least one dot (domain.tld)
                  //       const domainPart = trimmed.substring(4); // Remove "www."
                  //       if (!domainPart.includes('.') || domainPart.split('.').length < 2) {
                  //         return false; // Incomplete domain like "www.al"
                  //       }
                  //       // Check if domain part has valid structure (at least domain.tld)
                  //       const domainParts = domainPart.split('.');
                  //       if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
                  //         return false; // Invalid domain structure
                  //       }
                  //       urlToValidate = `https://${trimmed}`;
                  //     } else {
                  //       // For http:// or https:// URLs, check if domain part is complete
                  //       const urlWithoutProtocol = trimmed.replace(/^https?:\/\//i, '');
                  //       if (!urlWithoutProtocol.includes('.') || urlWithoutProtocol.split('.').length < 2) {
                  //         return false; // Incomplete domain
                  //       }
                  //       const domainParts = urlWithoutProtocol.split('/')[0].split('.');
                  //       if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
                  //         return false; // Invalid domain structure
                  //       }
                  //       urlToValidate = trimmed;
                  //     }

                  //     // Final validation: try to create a URL object to check if it's valid
                  //     try {
                  //       const urlObj = new URL(urlToValidate);
                  //       // Additional check: ensure hostname has at least one dot (domain.tld)
                  //       if (!urlObj.hostname || !urlObj.hostname.includes('.') || urlObj.hostname.split('.').length < 2) {
                  //         return false;
                  //       }
                  //       // Ensure TLD is at least 2 characters
                  //       const hostnameParts = urlObj.hostname.split('.');
                  //       if (hostnameParts[hostnameParts.length - 1].length < 2) {
                  //         return false;
                  //       }
                  //       return true;
                  //     } catch {
                  //       return false;
                  //     }
                  //   }

                  //   return true;
                  // };
                  // Helper function to check if field has a valid value
                  const hasValidValue = () => {
                    if (fieldValue === null || fieldValue === undefined) return false;

                    const trimmed = String(fieldValue).trim();
                    if (trimmed === "") return false;

                    /* ================= DATE FIELD (TIMEZONE SAFE) ================= */
                    if (field.field_type === "date") {
                      let normalizedDate = trimmed;

                      // Convert MM/DD/YYYY → YYYY-MM-DD
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                        const [mm, dd, yyyy] = trimmed.split("/");
                        normalizedDate = `${yyyy}-${mm}-${dd}`;
                      }

                      // Strict YYYY-MM-DD format
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
                        return false;
                      }

                      const [year, month, day] = normalizedDate.split("-").map(Number);

                      // Manual date validation (NO timezone usage)
                      if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
                        return false;
                      }

                      const daysInMonth = new Date(year, month, 0).getDate();
                      if (day > daysInMonth) {
                        return false;
                      }

                      return true;
                    }
                    /* =============================================================== */

                    // ZIP code
                    const isZipCodeField =
                      field.field_label?.toLowerCase().includes("zip") ||
                      field.field_label?.toLowerCase().includes("postal code") ||
                      field.field_name?.toLowerCase().includes("zip") ||
                      field.field_name === "Field_24" ||
                      field.field_name === "field_24";

                    if (isZipCodeField) {
                      return /^\d{5}$/.test(trimmed);
                    }

                    // Non-negative number fields
                    const isNonNegativeField =
                      field.field_label?.toLowerCase().includes("employees") ||
                      field.field_label?.toLowerCase().includes("offices") ||
                      field.field_label?.toLowerCase().includes("oasis key");

                    if (isNonNegativeField && field.field_type === "number") {
                      const num = Number(trimmed);
                      return !isNaN(num) && num >= 0;
                    }

                    // Phone field
                    const isPhoneField =
                      (field.field_type === "phone" ||
                        field.field_label?.toLowerCase().includes("phone"));
                    if (isPhoneField && trimmed !== "") {
                      // Phone must be complete: exactly 10 digits formatted as (000) 000-0000
                      // Remove all non-numeric characters to check digit count
                      // const digitsOnly = trimmed.replace(/\D/g, "");
                      // // Must have exactly 10 digits
                      // if (digitsOnly.length !== 10) {
                      //   return false;
                      // }
                      // // Check if formatted correctly as (000) 000-0000
                      // const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
                      // if (!phoneRegex.test(trimmed)) return false;
                      // // NANP: valid area code (2-9), exchange (2-9), and area code in US list
                      return isValidUSPhoneNumber(trimmed);
                    }

                    // URL field
                    const isUrlField =
                      field.field_type === "url" ||
                      field.field_label?.toLowerCase().includes("website") ||
                      field.field_label?.toLowerCase().includes("url");

                    if (isUrlField) {
                      try {
                        const url = trimmed.startsWith("http")
                          ? new URL(trimmed)
                          : new URL(`https://${trimmed}`);
                        return url.hostname.includes(".");
                      } catch {
                        return false;
                      }
                    }

                    return true;
                  };


                  return (
                    <div key={field.id} className="flex items-center mb-3">
                      <label className="w-48 font-medium flex items-center">
                        {field.field_label}:
                        {/* Show indicator for required fields OR conditionally required fields */}
                        {(field.is_required || isContractSignedByRequired) &&
                          (hasValidValue() ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        {isOwnerField ? (
                          <select
                            value={fieldValue}
                            onChange={(e) =>
                              handleCustomFieldChange(
                                field.field_name,
                                e.target.value
                              )
                            }
                            className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">Select Owner</option>
                            {activeUsers.map((user) => (
                              <option key={user.id} value={user.name}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        ) : isContractSignedByField ? (
                          <select
                            value={fieldValue}
                            onChange={(e) =>
                              handleCustomFieldChange(
                                field.field_name,
                                e.target.value
                              )
                            }
                            className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                            disabled={!organizationId}
                          >
                            <option value="">
                              {organizationId
                                ? "Select Contact"
                                : "Save organization first to select contact"}
                            </option>
                            {organizationContacts.map((contact) => {
                              const contactName =
                                contact.full_name ||
                                `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
                              return (
                                <option key={contact.id} value={contactName}>
                                  {contactName}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            onChange={handleCustomFieldChange}
                            allFields={customFields}
                            values={customFieldValues}
                          />
                        )}
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
                  //         <span className="absolute text-red-500 left-[-10px] top-2">
                  //           *
                  //         </span>
                  //       )} */}
                  //     </div>
                  //   </div>
                  // );
                })}
              </>
            )}
          </div>

          {/* Spacer so content is not hidden behind sticky bar */}
          <div className="h-20" aria-hidden="true" />

          {/* Form Buttons - sticky bar at bottom */}
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
                (duplicateWarning !== null &&
                  ((duplicateWarning.phone?.length ?? 0) > 0 ||
                    (duplicateWarning.website?.length ?? 0) > 0 ||
                    (duplicateWarning.email?.length ?? 0) > 0))
              }
              className={`px-4 py-2 rounded ${isSubmitting ||
                !isFormValid ||
                (duplicateWarning !== null &&
                  ((duplicateWarning.phone?.length ?? 0) > 0 ||
                    (duplicateWarning.website?.length ?? 0) > 0 ||
                    (duplicateWarning.email?.length ?? 0) > 0))
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
