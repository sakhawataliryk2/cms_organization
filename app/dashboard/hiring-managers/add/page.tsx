"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
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
  "Phone": "phone", "Phone Number": "phone", Telephone: "phone",
  "Mobile Phone": "mobilePhone", Mobile: "mobilePhone", "Cell Phone": "mobilePhone",
  "Direct Line": "directLine",
  "Company Phone": "companyPhone", "Contact Phone": "companyPhone", "Main Phone": "companyPhone",
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

export default function AddHiringManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hiringManagerId = searchParams.get("id");
  const organizationIdFromUrl = searchParams.get("organizationId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!hiringManagerId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!hiringManagerId);
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
  } = useCustomFields("hiring-managers");
  const addressFields = useMemo(
    () => getAddressFields(customFields),
    [customFields]
  );
  const addressFieldIdSet = useMemo(() => {
    return new Set(addressFields.map((f) => f.id));
  }, [addressFields]);
  const addressAnchorId = addressFields?.[0]?.id; // usually the first address field (Address)

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

  // Fetch organization data (name, phone, address) if organizationId is provided
  const fetchOrganizationData = useCallback(async (orgId: string) => {
    console.log("fetching")
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        const org = data.organization || {};

        // Extract organization data with fallbacks
        const orgName = org.name || "";
        const orgPhone = org.contact_phone || org.custom_fields["Main Phone"] || "";
        const orgAddress = org.address || "";
        const orgAddress2 = org.custom_fields["Address 2"] || "";
        const orgCity = org.custom_fields["City"] || "";
        const orgState = org.custom_fields["State"] || "";
        const orgZip = org.custom_fields["ZIP Code"] || "";

        // Validate required fields
        if (!orgName) {
          console.warn(`Organization ${orgId} is missing a name`);
        }

        // Set state for organization data
        setOrganizationName(orgName);
        setOrganizationPhone(orgPhone);
        setOrganizationAddress(orgAddress);

        // Prefill organizationId and org-derived fields. When organization changes,
        // always overwrite with the new org's data so company/address update correctly.
        setFormData(prev => ({
          ...prev,
          organizationId: orgId,
          phone: orgPhone || prev.phone || "",
          companyPhone: orgPhone || prev.companyPhone || "",
          address: orgAddress || prev.address || "",
          address2: orgAddress2 || prev.address2 || "",
          city: orgCity || prev.city || "",
          state: orgState || prev.state || "",
          zipCode: orgZip || prev.zipCode || "",
        }));

        // Auto-populate custom fields once they're loaded
        // This will be handled in a useEffect that watches customFields
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch organization:", response.statusText, errorData);
        setError(`Failed to load organization data: ${errorData.message || response.statusText}`);
        // Still set the organizationId even if fetch fails
        setFormData(prev => ({
          ...prev,
          organizationId: orgId
        }));
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
      setError(`Error loading organization: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Still set the organizationId even if fetch fails
      setFormData(prev => ({
        ...prev,
        organizationId: orgId
      }));
    }
  }, []);

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
          hm.organization_name || hm.organization_id?.toString() || "",
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
          // Organization variations
          "Organization": hm.organization_name || "",
          "Organization Name": hm.organization_name || "",
          "Company": hm.organization_name || "",
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

  // Auto-populate Owner field (Field_9) with current user when creating
  useEffect(() => {
    if (customFields.length === 0) return;
    if (hiringManagerId) return; // Don't auto-populate in edit mode
    if (!currentUser?.name) return; // Wait for current user to be loaded

    // Find Field_9 (Owner field)
    const ownerField = customFields.find(
      (field) =>
        field.field_name === "Field_9" ||
        field.field_name === "field_9" ||
        (field.field_label?.toLowerCase() === "owner" && field.field_name?.toLowerCase().includes("9"))
    );

    if (!ownerField) return;

    const currentValue = customFieldValues[ownerField.field_name];

    // Auto-populate with current user's name if field is empty
    if (!currentValue || currentValue.trim() === "") {
      handleCustomFieldChange(ownerField.field_name, currentUser.name);
    }
  }, [customFields, currentUser, hiringManagerId, customFieldValues, handleCustomFieldChange]);

  // Auto-populate organization fields when organization data is fetched and custom fields are loaded
  useEffect(() => {
    // In edit mode, don't fetch org and overwrite form – we already have HM data loaded
    if (hiringManagerId) return;
    if (customFields.length === 0) return;

    // Find the organization field definition
    const orgField = customFields.find((f) => {
      const label = f.field_label.toLowerCase();
      return (label === "organization" || label === "organization name" || label === "company") &&
        !label.includes("phone") && !label.includes("address");
    });

    if (!orgField) return;

    // Get the current value from custom fields
    const orgValue = customFieldValues[orgField.field_name];

    // Only fetch if:
    // 1. orgValue exists
    // 2. It looks like an ID (is numeric or a short string that could be an ID)
    // 3. It's different from what we currently have loaded
    // 4. It's not already the organization name (to prevent loops)

    // Check if orgValue looks like an ID (numeric or very short string)
    const looksLikeId = orgValue && (
      !isNaN(Number(orgValue)) || // It's a number
      (typeof orgValue === 'string' && orgValue.length < 10 && !orgValue.includes(' ')) // Short string without spaces
    );

    // Don't fetch if the value is already the organization name we have loaded
    const isDifferentFromLoaded = orgValue !== organizationName && orgValue !== formData.organizationId;

    if (orgValue && looksLikeId && isDifferentFromLoaded) {
      // Debounce fetching
      const timeoutId = setTimeout(() => {
        // Attempt to fetch if it looks like an ID or if we just want to try resolving it
        console.log("Organization selection changed:", orgValue);
        fetchOrganizationData(orgValue);
      }, 500);
      return () => clearTimeout(timeoutId);
    }

  }, [hiringManagerId, customFields, customFieldValues, organizationName, formData.organizationId, fetchOrganizationData]);

  // When organization data (phone, address) changes—e.g. after selecting a different org—
  // overwrite the corresponding custom fields so they stay in sync.
  // Do NOT overwrite the Organization/Company selector field with the name: that field holds the
  // selected org ID; overwriting with the name breaks the dropdown (it reverts to "Select Organization").
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
        if (customFieldValues[fieldName] !== value) {
          handleCustomFieldChange(fieldName, value);
        }
      });
    }
  }, [customFields, organizationName, organizationPhone, organizationAddress, hiringManagerId, customFieldValues, handleCustomFieldChange]);

  // Handle prefilling from URL (existing logic preserved but ensuring it plays nice)
  useEffect(() => {
    if (customFields.length === 0 || !organizationIdFromUrl || hasPrefilledOrgRef.current === false) return;
    if (hiringManagerId) return; // Don't auto-populate in edit mode

    // Auto-populate custom fields with organization data when arriving from URL
    const updates: Record<string, any> = {};

    customFields.forEach((field) => {
      const fieldLabel = field.field_label.toLowerCase();
      const currentValue = customFieldValues[field.field_name];

      // Organization Name fields (URL case: only when empty or still showing ID)
      if (
        (fieldLabel.includes("organization") || fieldLabel.includes("company")) &&
        !fieldLabel.includes("phone") &&
        !fieldLabel.includes("address") &&
        organizationName
      ) {
        if (!currentValue || currentValue === organizationIdFromUrl || currentValue === String(organizationIdFromUrl)) {
          updates[field.field_name] = organizationName;
        }
      }

      // Company Phone fields (URL case)
      if (
        (fieldLabel.includes("company phone") ||
          fieldLabel.includes("company phone number") ||
          (fieldLabel.includes("phone") && fieldLabel.includes("company"))) &&
        organizationPhone &&
        !currentValue
      ) {
        updates[field.field_name] = organizationPhone;
      }

      // Organization Address fields (URL case)
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
  }, [customFields, organizationName, organizationPhone, organizationAddress, organizationIdFromUrl, hiringManagerId, customFieldValues, handleCustomFieldChange]);

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
          const formValue = formData[formKey as keyof typeof formData];
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
  }, [formData, customFields, setCustomFieldValues]);

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

      // Navigate based on where we came from
      const id = isEditMode ? hiringManagerId : data.hiringManager.id;

      // If we came from organization page, navigate back there
      if (organizationIdFromUrl && !isEditMode) {
        router.push(`/dashboard/organizations/view?id=${organizationIdFromUrl}`);
      } else {
        // Otherwise navigate to the hiring manager view page
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
          <div className="flex items-center">
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
            {/* <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/admin/field-mapping?section=hiring-managers"
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

        {/* Validation debug: show why Save is disabled when form is invalid */}
        {/* {!isFormValid && validationResult.message && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 mb-4 rounded flex items-start gap-2">
            <span className="shrink-0 font-semibold" title="Validation debug">
              ⚠
            </span>
            <div>
              <p className="font-medium">Save is disabled — validation:</p>
              <p className="text-sm mt-1">{validationResult.message}</p>
            </div>
          </div>
        )} */}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* <div className="grid grid-cols-1 gap-4">
            
            <div className="flex items-center">
              <label className="w-48 font-medium">First Name:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-48 font-medium">Last Name:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>
          
            <div className="flex items-center">
              <label className="w-48 font-medium">Status:</label>
              <div className="flex-1 relative">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                  required
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="w-48 font-medium">Nickname:</label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
        
            <div className="flex items-center">
              <label className="w-48 font-medium">Title:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="w-48 font-medium">Organization:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="organizationId"
                  value={organizationName || formData.organizationId}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Organization name or ID"
                  readOnly={!!organizationIdFromUrl}
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
              <label className="w-48 font-medium">Department:</label>
              <div className="flex-1 relative">
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="Accounting">Accounting</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                  <option value="Legal">Legal</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="R&D">R&D</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="w-48 font-medium">Reports to:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="reportsTo"
                  value={formData.reportsTo}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
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
              <label className="w-48 font-medium">Owner:</label>
              <div className="flex-1 relative">
                <select
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Select Owner</option>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="w-48 font-medium">Secondary Owners:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="secondaryOwners"
                  value={formData.secondaryOwners}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
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
          </div> */}

          {/* Contact Information Section */}
          {/* <div className="mt-8">
            <div className="bg-gray-100 p-2 mb-4">
              <h2 className="font-medium flex items-center">
                <Image
                  src="/file.svg"
                  alt="Contact"
                  width={16}
                  height={16}
                  className="mr-2"
                />
                Contact Information
              </h2>
            </div>

            
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Email 1:</label>
              <div className="flex-1 relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="absolute text-red-500 left-[-10px] top-2">
                  *
                </span>
              </div>
            </div>

            
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Email 2:</label>
              <input
                type="email"
                name="email2"
                value={formData.email2}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Phone:</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="(123) 456-7890"
              />
            </div>

            
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Mobile Phone:</label>
              <input
                type="tel"
                name="mobilePhone"
                value={formData.mobilePhone}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="(123) 456-7890"
              />
            </div>

            
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Direct Line:</label>
              <input
                type="tel"
                name="directLine"
                value={formData.directLine}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="(123) 456-7890"
              />
            </div>

           
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">LinkedIn URL:</label>
              <input
                type="url"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="https://linkedin.com/in/username"
              />
            </div>

           
            <div className="flex items-center mt-4">
              <label className="w-48 font-medium">Address:</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                rows={3}
                placeholder="Street address, City, State, ZIP"
              />
            </div>
          </div> */}

          {/* Custom Fields Section */}
          {customFields.length > 0 && (
            <div className="mt-8">
              {customFields.map((field) => {
                // Check if this is the anchor address field (first address field)
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

                // Skip individual address fields so they don't render twice
                if (addressFieldIdSet.has(field.id)) {
                  return null;
                }

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

                // Special handling for Field_9 (Owner) - render as dropdown with active users
                const isOwnerField =
                  field.field_name === "Field_9" ||
                  field.field_name === "field_9" ||
                  (field.field_label?.toLowerCase() === "owner" && field.field_name?.toLowerCase().includes("9"));

                // Helper function to check if field has a valid value
                const hasValidValue = () => {
                  // Handle null, undefined, or empty values
                  if (fieldValue === null || fieldValue === undefined) return false;
                  const trimmed = String(fieldValue).trim();
                  // Empty string means no value selected (especially for select fields)
                  if (trimmed === "") return false;

                  // Special validation for select fields
                  if (field.field_type === "select") {
                    // Must not be empty or "Select an option"
                    if (trimmed === "" || trimmed.toLowerCase() === "select an option") {
                      return false;
                    }
                    return true;
                  }

                  // Special validation for date fields
                  if (field.field_type === "date") {
                    // Accept both YYYY-MM-DD (storage format) and mm/dd/yyyy (display format)
                    let dateToValidate = trimmed;

                    // If it's in mm/dd/yyyy format, convert to YYYY-MM-DD
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                      const [month, day, year] = trimmed.split("/");
                      dateToValidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                    }

                    // Check if it's a valid date format (YYYY-MM-DD)
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(dateToValidate)) return false;

                    const date = new Date(dateToValidate);
                    if (isNaN(date.getTime())) return false;

                    // Additional validation: check if the date components match
                    const [year, month, day] = dateToValidate.split("-");
                    if (date.getFullYear() !== parseInt(year) ||
                      date.getMonth() + 1 !== parseInt(month) ||
                      date.getDate() !== parseInt(day)) {
                      return false; // Invalid date (e.g., 02/30/2024)
                    }

                    return true;
                  }

                  // Special validation for ZIP code (must be exactly 5 digits)
                  const isZipCodeField =
                    field.field_label?.toLowerCase().includes("zip") ||
                    field.field_label?.toLowerCase().includes("postal code") ||
                    field.field_name?.toLowerCase().includes("zip") ||
                    field.field_name === "Field_24" ||
                    field.field_name === "field_24";
                  if (isZipCodeField) {
                    return /^\d{5}$/.test(trimmed);
                  }

                  // Special validation for numeric fields that allow values >= 0
                  const isNonNegativeField =
                    field.field_label?.toLowerCase().includes("employees") ||
                    field.field_label?.toLowerCase().includes("offices") ||
                    field.field_label?.toLowerCase().includes("oasis key") ||
                    field.field_name?.toLowerCase().includes("employees") ||
                    field.field_name?.toLowerCase().includes("offices") ||
                    field.field_name?.toLowerCase().includes("oasis") ||
                    field.field_name === "Field_32" ||
                    field.field_name === "field_32" ||
                    field.field_name === "Field_25" ||
                    field.field_name === "field_25" ||
                    field.field_name === "Field_31" ||
                    field.field_name === "field_31";
                  if (isNonNegativeField && field.field_type === "number") {
                    const numValue = parseFloat(trimmed);
                    // Allow values >= 0 (0, 1, 2, etc.)
                    return !isNaN(numValue) && numValue >= 0;
                  }

                  // Special validation for phone fields
                  const isPhoneField =
                    (field.field_type === "phone" ||
                      field.field_label?.toLowerCase().includes("phone"));
                  if (isPhoneField && trimmed !== "") {
                    // Phone must be complete: exactly 10 digits formatted as (000) 000-0000
                    // Remove all non-numeric characters to check digit count
                    const digitsOnly = trimmed.replace(/\D/g, "");
                    // Must have exactly 10 digits
                    if (digitsOnly.length !== 10) {
                      return false;
                    }
                    // Check if formatted correctly as (000) 000-0000
                    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
                    if (!phoneRegex.test(trimmed)) return false;
                    // NANP: valid area code (2-9), exchange (2-9), and area code in US list
                    return isValidUSPhoneNumber(trimmed);
                  }

                  // Special validation for email fields
                  const isEmailField =
                    field.field_type === "email" ||
                    field.field_label?.toLowerCase().includes("email") ||
                    field.field_name?.toLowerCase().includes("email");
                  if (isEmailField && trimmed !== "") {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return emailRegex.test(trimmed);
                  }

                  // Special validation for URL fields (LinkedIn URL, etc.)
                  const isUrlField =
                    field.field_type === "url" ||
                    field.field_label?.toLowerCase().includes("website") ||
                    field.field_label?.toLowerCase().includes("url") ||
                    field.field_label?.toLowerCase().includes("linkedin") ||
                    field.field_name?.toLowerCase().includes("url") ||
                    field.field_name?.toLowerCase().includes("linkedin");
                  if (isUrlField && trimmed !== "") {
                    // URL must start with http://, https://, or www.
                    const urlPattern = /^(https?:\/\/|www\.).+/i;
                    if (!urlPattern.test(trimmed)) {
                      return false;
                    }

                    // Stricter validation: Check for complete domain structure
                    let urlToValidate = trimmed;
                    if (trimmed.toLowerCase().startsWith('www.')) {
                      const domainPart = trimmed.substring(4);
                      if (!domainPart.includes('.') || domainPart.split('.').length < 2) {
                        return false;
                      }
                      const domainParts = domainPart.split('.');
                      if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
                        return false;
                      }
                      urlToValidate = `https://${trimmed}`;
                    } else {
                      const urlWithoutProtocol = trimmed.replace(/^https?:\/\//i, '');
                      if (!urlWithoutProtocol.includes('.') || urlWithoutProtocol.split('.').length < 2) {
                        return false;
                      }
                      const domainParts = urlWithoutProtocol.split('/')[0].split('.');
                      if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
                        return false;
                      }
                      urlToValidate = trimmed;
                    }

                    // Final validation: try to create a URL object
                    try {
                      const urlObj = new URL(urlToValidate);
                      if (!urlObj.hostname || !urlObj.hostname.includes('.') || urlObj.hostname.split('.').length < 2) {
                        return false;
                      }
                      const hostnameParts = urlObj.hostname.split('.');
                      if (hostnameParts[hostnameParts.length - 1].length < 2) {
                        return false;
                      }
                      return true;
                    } catch {
                      return false;
                    }
                  }

                  return true;
                };

                return (
                  <div key={field.id} className="flex items-center mt-4">
                    <label className="w-48 font-medium flex items-center">
                      {field.field_label}:
                      {/* Show indicator for required fields */}
                      {field.is_required &&
                        (hasValidValue() ? (
                          <span className="text-green-500 ml-1">✔</span>
                        ) : (
                          <span className="text-red-500 ml-1">*</span>
                        ))}
                    </label>
                    <div className="flex-1 relative">
                      {isOwnerField ? (
                        // Render Owner field as dropdown with active users
                        <select
                          value={fieldValue}
                          onChange={(e) =>
                            handleCustomFieldChange(field.field_name, e.target.value)
                          }
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                          required={field.is_required}
                        >
                          <option value="">Select Owner</option>
                          {activeUsers.map((user) => (
                            <option key={user.id} value={user.name || user.email}>
                              {user.name || user.email || `User #${user.id}`}
                            </option>
                          ))}
                        </select>
                      ) : shouldBeReadOnly ? (
                        // Render read-only organization name (readable name only, no ID)
                        <input
                          type="text"
                          value={organizationName || fieldValue || ""}
                          readOnly
                          className="w-full p-2 border-b border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                          title="Organization name is auto-populated from the selected organization"
                        />
                      ) : (
                        <CustomFieldRenderer
                          field={field}
                          value={fieldValue}
                          allFields={customFields}
                          values={customFieldValues}
                          onChange={handleCustomFieldChange}
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                        />
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
      </div>
    </div>
  );
}
