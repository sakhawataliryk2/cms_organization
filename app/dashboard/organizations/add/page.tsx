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

export default function AddOrganization() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!organizationId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!organizationId);
  const hasFetchedRef = useRef(false); // Track if we've already fetched organization data
  const [activeUsers, setActiveUsers] = useState<
    Array<{ id: string; name: string; email: string }>
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

  const addressAnchorId = addressFields?.[0]?.id; // usually Field_20 (Address)

  const [formData, setFormData] = useState({
    name: "",
    nicknames: "",
    parentOrganization: "",
    website: "",
    status: "Active",
    contractOnFile: "No",
    contractSignedBy: "",
    dateContractSigned: "",
    yearFounded: "",
    overview: "",
    permFee: "",
    numEmployees: "",
    numOffices: "",
    contactPhone: "",
    address: "",
    // Dynamic custom fields will be added here
    customFields: {} as Record<string, any>,
  });

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

        // Second, map standard organization fields to custom fields based on field labels
        // This ensures that standard fields like "name", "nicknames" etc. populate custom fields
        // with matching labels like "Organization Name", "Nicknames", etc.
        if (customFields.length > 0) {
          const standardFieldMapping: Record<string, string> = {
            "Organization Name": org.name || "",
            Name: org.name || "",
            Nicknames: org.nicknames || "",
            "Parent Organization": org.parent_organization || "",
            Website: org.website || "",
            "Organization Website": org.website || "",
            "Contact Phone": org.contact_phone || "",
            Address: org.address || "",
            Status: org.status || "Active",
            "Contract Signed on File": org.contract_on_file || "No",
            "Contract Signed By": org.contract_signed_by || "",
            "Date Contract Signed": org.date_contract_signed
              ? org.date_contract_signed.split("T")[0]
              : "",
            "Year Founded": org.year_founded || "",
            Overview: org.overview || "",
            "Organization Overview": org.overview || "",
            About: org.overview || "",
            "Standard Perm Fee (%)": org.perm_fee
              ? org.perm_fee.toString()
              : "",
            "# of Employees": org.num_employees
              ? org.num_employees.toString()
              : "",
            "# of Offices": org.num_offices ? org.num_offices.toString() : "",
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

        setFormData({
          name: org.name || "",
          nicknames: org.nicknames || "",
          parentOrganization: org.parent_organization || "",
          website: org.website || "",
          status: org.status || "Active",
          contractOnFile: org.contract_on_file || "No",
          contractSignedBy: org.contract_signed_by || "",
          dateContractSigned: org.date_contract_signed
            ? org.date_contract_signed.split("T")[0]
            : "",
          yearFounded: org.year_founded || "",
          overview: org.overview || "",
          permFee: org.perm_fee ? org.perm_fee.toString() : "",
          numEmployees: org.num_employees ? org.num_employees.toString() : "",
          numOffices: org.num_offices ? org.num_offices.toString() : "",
          contactPhone: org.contact_phone || "",
          address: org.address || "",
          customFields: existingCustomFields,
        });

        // Set the mapped custom field values (field_name as keys)
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

  // Removed console.logs from component level to prevent excessive logging on every render
  //console.log("Custom Fields:", customFields);

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

    setIsSubmitting(true);
    setError(null);

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

      // Map custom fields to standard fields if they exist
      const name =
        customFieldsToSend["Organization Name"] ||
        customFieldsToSend["Name"] ||
        formData.name ||
        "Unnamed Organization";

      const website =
        customFieldsToSend["Website"] ||
        customFieldsToSend["Organization Website"] ||
        formData.website ||
        "";

      const overview =
        customFieldsToSend["Overview"] ||
        customFieldsToSend["Organization Overview"] ||
        customFieldsToSend["About"] ||
        formData.overview ||
        "";

      // ✅ Build the API payload
      // Ensure custom_fields is always a valid object (not integer or other types)
      const customFieldsForDB: Record<string, any> = {};

      // Include all custom fields, even if they're empty strings (but filter out undefined/null)
      // This ensures all custom field values are saved, including empty ones
      Object.keys(customFieldsToSend).forEach((key) => {
        const value = customFieldsToSend[key];
        // Include all values except undefined and null (allow empty strings)
        if (value !== undefined && value !== null) {
          customFieldsForDB[key] = value;
        }
      });

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

      const apiData: Record<string, any> = {
        name: name,
        nicknames: customFieldsToSend["Nicknames"] || formData.nicknames || "",
        parent_organization:
          customFieldsToSend["Parent Organization"] ||
          formData.parentOrganization ||
          "",
        website: website,
        status: customFieldsToSend["Status"] || formData.status || "Active",
        contract_on_file: formData.contractOnFile || "No",
        // Check both custom fields and formData for contract_signed_by and date_contract_signed
        contract_signed_by:
          customFieldsToSend["Contract Signed By"] ||
          formData.contractSignedBy ||
          null,
        date_contract_signed:
          customFieldsToSend["Date Contract Signed"] ||
          formData.dateContractSigned ||
          null,
        year_founded:
          customFieldsToSend["Year Founded"] || formData.yearFounded || "",
        overview: overview,
        perm_fee:
          customFieldsToSend["Standard Perm Fee (%)"] || formData.permFee || "",
        contact_phone:
          customFieldsToSend["Contact Phone"] || formData.contactPhone || "",
        address: customFieldsToSend["Address"] || formData.address || "",
        // ✅ CRITICAL FIX: Always send custom_fields as a valid JSON object
        custom_fields: customFieldsForDB,
      };

      // Handle numeric fields separately to avoid type issues
      const numEmployees = customFieldsToSend["# of Employees"]
        ? parseInt(customFieldsToSend["# of Employees"])
        : formData.numEmployees
        ? parseInt(formData.numEmployees)
        : null;

      const numOffices = customFieldsToSend["# of Offices"]
        ? parseInt(customFieldsToSend["# of Offices"])
        : formData.numOffices
        ? parseInt(formData.numOffices)
        : null;

      // Only add numeric fields if they have valid values
      if (numEmployees !== null && !isNaN(numEmployees)) {
        apiData.num_employees = numEmployees;
      }
      if (numOffices !== null && !isNaN(numOffices)) {
        apiData.num_offices = numOffices;
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

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p>{error}</p>
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
                   return (
                     <div
                       key="address-group"
                       className="address-underline flex items-start mb-3"
                     >
                       {/* left side same label width space */}
                       <label className="w-48 font-medium flex items-center mt-4">
                         Address:
                         {/* required indicator: agar address fields me koi required ho */}
                         {addressFields.some((f) => f.is_required) && (
                           <span className="text-red-500 ml-1">*</span>
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

                  return (
                    <div key={field.id} className="flex items-center mb-3">
                      <label className="w-48 font-medium flex items-center">
                        {field.field_label}:
                        {field.is_required &&
                          (fieldValue.trim() !== "" ? (
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
                        ) : (
                          <CustomFieldRenderer
                            field={field}
                            value={fieldValue}
                            onChange={handleCustomFieldChange}
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

          {/* Form Buttons */}
          <div className="pt-4 flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={isSubmitting}
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
