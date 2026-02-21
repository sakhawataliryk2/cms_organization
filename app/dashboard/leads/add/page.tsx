"use client";

import { useState, useEffect, useMemo } from "react";
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
    | "number";
  required: boolean;
  visible: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  value: string;
  locked?: boolean; // For locked fields
  sortOrder?: number;
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
  "Status": "status", "Lead Status": "status",
  "Nickname": "nickname", "Nick Name": "nickname",
  "Title": "title", "Job Title": "title", Position: "title",
  "Organization": "organizationId", "Organization Name": "organizationId", Company: "organizationId",
  "Department": "department", Dept: "department",
  "Reports To": "reportsTo", Manager: "reportsTo",
  "Owner": "owner", "Assigned To": "owner", "Assigned Owner": "owner",
  "Secondary Owners": "secondaryOwners", "Secondary Owner": "secondaryOwners",
  "Email": "email", "Email 1": "email", "Email Address": "email", "E-mail": "email",
  "Email 2": "email2",
  "Phone": "phone", "Phone Number": "phone", Telephone: "phone",
  "Mobile Phone": "mobilePhone", Mobile: "mobilePhone", "Cell Phone": "mobilePhone",
  "Direct Line": "directLine",
  "LinkedIn URL": "linkedinUrl", LinkedIn: "linkedinUrl", "LinkedIn Profile": "linkedinUrl",
  "Address": "address", "Street Address": "address", "Address 1": "address",
};

export default function AddLead() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const leadId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!leadId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!leadId);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Use the custom fields hook (same pattern as jobs)
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("leads");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    status: "New Lead",
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
    linkedinUrl: "",
    address: "",
  });

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
      } catch (err) {
        console.error("Error fetching active users:", err);
      }
    };
    fetchActiveUsers();
  }, []);

  // If leadId is present, fetch the lead data
  useEffect(() => {
    if (leadId) {
      fetchLead(leadId);
    }
  }, [leadId]);

  // Map basic form fields to custom fields based on field labels (same pattern as jobs)
  useEffect(() => {
    if (customFieldsLoading || customFields.length === 0) return;

    // Create a mapping of field labels to form data values
    const standardFieldMapping: Record<string, string> = {
      "First Name": formData.firstName || "",
      "Last Name": formData.lastName || "",
      "Status": formData.status || "",
      "Nickname": formData.nickname || "",
      "Title": formData.title || "",
      "Organization": formData.organizationId || "",
      "Department": formData.department || "",
      "Reports To": formData.reportsTo || "",
      "Owner": formData.owner || "",
      "Secondary Owners": formData.secondaryOwners || "",
      "Email": formData.email || "",
      "Email 2": formData.email2 || "",
      "Phone": formData.phone || "",
      "Mobile Phone": formData.mobilePhone || "",
      "Direct Line": formData.directLine || "",
      "LinkedIn URL": formData.linkedinUrl || "",
      "Address": formData.address || "",
    };

    setCustomFieldValues((prev) => {
      const next = { ...prev };
      customFields.forEach((field) => {
        // Check if this custom field label matches a standard field
        const standardValue = standardFieldMapping[field.field_label];
        if (standardValue !== undefined) {
          // Always sync the value from formData to custom field
          next[field.field_name] = standardValue;
        }
      });
      return next;
    });
  }, [
    formData.firstName,
    formData.lastName,
    formData.status,
    formData.nickname,
    formData.title,
    formData.organizationId,
    formData.department,
    formData.reportsTo,
    formData.owner,
    formData.secondaryOwners,
    formData.email,
    formData.email2,
    formData.phone,
    formData.mobilePhone,
    formData.directLine,
    formData.linkedinUrl,
    formData.address,
    customFields,
    customFieldsLoading,
    setCustomFieldValues,
  ]);

  // Auto-populate Field_8 (Owner) with logged-in user's name
  useEffect(() => {
    // Wait for customFields to load
    if (customFieldsLoading || customFields.length === 0) return;

    // Find Field_8 specifically
    const ownerField = customFields.find(
      (f) =>
        f.field_name === "Field_8" ||
        f.field_name === "field_8" ||
        f.field_name?.toLowerCase() === "field_8"
    );

    if (ownerField) {
      const currentValue = customFieldValues[ownerField.field_name];
      // Only auto-populate if field is empty (works in both create and edit mode)
      if (!currentValue || currentValue.trim() === "") {
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
                "Auto-populated Field_8 (Owner) with current user:",
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

  // Removed fetchCustomFields - now using useCustomFields hook

  const fetchLead = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch lead details");
      }

      const data = await response.json();
      const lead = data.lead;

      console.log("Received lead data:", lead);

      // Convert database fields to form field names with proper defaults
      setFormData({
        firstName: lead.first_name || "",
        lastName: lead.last_name || "",
        status: lead.status || "New Lead",
        nickname: lead.nickname || "",
        title: lead.title || "",
        organizationId:
          lead.organization_name || lead.organization_id?.toString() || "",
        department: lead.department || "Accounting",
        reportsTo: lead.reports_to || "",
        owner: lead.owner || "",
        secondaryOwners: lead.secondary_owners || "",
        email: lead.email || "",
        email2: lead.email2 || "",
        phone: lead.phone || "",
        mobilePhone: lead.mobile_phone || "",
        directLine: lead.direct_line || "",
        linkedinUrl: lead.linkedin_url || "",
        address: lead.address || "",
      });

      // Load custom field values if they exist
      let existingCustomFieldValues: Record<string, any> = {};
      if (lead.custom_fields) {
        try {
          existingCustomFieldValues =
            typeof lead.custom_fields === "string"
              ? JSON.parse(lead.custom_fields)
              : lead.custom_fields;
        } catch (e) {
          console.error("Error parsing custom fields:", e);
        }
      }

      // Map custom fields: first from existing custom_fields, then from standard fields (same pattern as jobs)
      const mappedCustomFieldValues: Record<string, any> = {};
      
      // First, map any existing custom field values from the database
      if (customFields.length > 0 && Object.keys(existingCustomFieldValues).length > 0) {
        customFields.forEach((field) => {
          // Try to find the value by field_label (as stored in DB)
          const value = existingCustomFieldValues[field.field_label];
          if (value !== undefined) {
            // Map to field_name for the form
            mappedCustomFieldValues[field.field_name] = value;
          }
        });
      }

      // Second, map standard lead fields to custom fields based on field labels
      if (customFields.length > 0) {
        const standardFieldMapping: Record<string, string> = {
          "First Name": lead.first_name || "",
          "Last Name": lead.last_name || "",
          "Status": lead.status || "New Lead",
          "Nickname": lead.nickname || "",
          "Title": lead.title || "",
          "Organization": lead.organization_name || lead.organization_id?.toString() || "",
          "Department": lead.department || "",
          "Reports To": lead.reports_to || "",
          "Owner": lead.owner || "",
          "Secondary Owners": lead.secondary_owners || "",
          "Email": lead.email || "",
          "Email 2": lead.email2 || "",
          "Phone": lead.phone || "",
          "Mobile Phone": lead.mobile_phone || "",
          "Direct Line": lead.direct_line || "",
          "LinkedIn URL": lead.linkedin_url || "",
          "Address": lead.address || "",
        };

        customFields.forEach((field) => {
          // Only set if not already set from existingCustomFieldValues
          if (mappedCustomFieldValues[field.field_name] === undefined) {
            // Try to find matching standard field by field_label
            const standardValue = standardFieldMapping[field.field_label];
            if (standardValue !== undefined && standardValue !== "") {
              mappedCustomFieldValues[field.field_name] = standardValue;
            }
          }
        });
      }

      // Set the mapped custom field values
      setCustomFieldValues(mappedCustomFieldValues);
    } catch (err) {
      console.error("Error fetching lead:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching lead details"
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  // Removed handleCustomFieldChange - now using handleCustomFieldChange from useCustomFields hook

  // const validateForm = () => {
    
  //   if (!formData.firstName.trim()) {
  //     setError("First name is required");
  //     return false;
  //   }
  //   if (!formData.lastName.trim()) {
  //     setError("Last name is required");
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

    // Validate required custom fields (same pattern as jobs)
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const customFieldsToSend = getCustomFieldsForSubmission();
      const customFieldsForDB: Record<string, any> = {};

      const apiDataBase: Record<string, any> = {
        firstName: "",
        lastName: "",
        status: "New Lead",
        nickname: "",
        title: "",
        organizationId: "",
        organizationName: "",
        department: "Accounting",
        reportsTo: "",
        owner: currentUser?.name || "",
        secondaryOwners: "",
        email: "",
        email2: "",
        phone: "",
        mobilePhone: "",
        directLine: "",
        linkedinUrl: "",
        address: "",
      };

      // Every form field goes into custom_fields (for both create and edit).
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          apiDataBase[column] = value;
        }
        // Always store every field in custom_fields so all fields are persisted there
        customFieldsForDB[label] = value;
      });

      apiDataBase.organizationName = apiDataBase.organizationId || apiDataBase.organizationName;

      // Extract relationship IDs from custom fields (Field_18 = Contact, Field_20 = Candidate, etc.)
      const parseIds = (val: string | undefined): number[] =>
        !val ? [] : val.toString().split(",").map((id: string) => id.trim()).filter((id: string) => id && !isNaN(Number(id))).map((id: string) => Number(id));
      const hiringManagerIds = parseIds(customFieldValues["Field_18"]);
      const jobSeekerIds = parseIds(customFieldValues["Field_20"]);
      const jobIds = parseIds(customFieldValues["Field_21"]);
      const placementIds = parseIds(customFieldValues["Field_22"]);
      const opportunityIds = parseIds(customFieldValues["Field_23"]);

      const apiData = {
        ...apiDataBase,
        hiringManagerIds: hiringManagerIds.length > 0 ? hiringManagerIds : undefined,
        jobSeekerIds: jobSeekerIds.length > 0 ? jobSeekerIds : undefined,
        jobIds: jobIds.length > 0 ? jobIds : undefined,
        placementIds: placementIds.length > 0 ? placementIds : undefined,
        opportunityIds: opportunityIds.length > 0 ? opportunityIds : undefined,
        custom_fields: customFieldsForDB,
      };

      console.log(
        "Sending lead data to API:",
        JSON.stringify(apiData, null, 2)
      );

      let response;
      let data;

      if (isEditMode && leadId) {
        // Update existing lead
        response = await fetch(`/api/leads/${leadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiData),
        });
      } else {
        // Create new lead
        response = await fetch("/api/leads", {
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
          data.message || `Failed to ${isEditMode ? "update" : "create"} lead`
        );
      }

      // Navigate to the lead view page
      const id = isEditMode ? leadId : data.lead.id;
      router.push(`/dashboard/leads/view?id=${id}`);
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} lead:`, err);
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

  const isFormValid = useMemo(() => {
    const customFieldValidation = validateCustomFields();
    return customFieldValidation.isValid;
  }, [customFieldValues, validateCustomFields]);

  // Show loading screen when loading existing lead data or custom fields
  if (isLoading || customFieldsLoading) {
    return <LoadingScreen message="Loading lead form..." />;
  }

  if (isSubmitting) {
    return (
      <LoadingScreen
        message={isEditMode ? "Updating lead..." : "Creating lead..."}
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
              alt="Lead"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Lead
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            
            {/* <div className="flex items-center gap-4">
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
            </div> */}

            
            {/* <div className="flex items-center gap-4">
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

            
            <div className="flex items-center gap-4">
              <label className="w-48 font-medium">Status:</label>
              <div className="flex-1 relative">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                  required
                >
                  <option value="New Lead">New Lead</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                  <option value="Dead">Dead</option>
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

            
            <div className="flex items-center gap-4">
              <label className="w-48 font-medium">Nickname:</label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            
            <div className="flex items-center gap-4">
              <label className="w-48 font-medium">Title:</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            
            <div className="flex items-center gap-4">
              <label className="w-48 font-medium">Organization:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  name="organizationId"
                  value={formData.organizationId}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Organization name or ID"
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

           
            <div className="flex items-center gap-4">
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

            
            <div className="flex items-center gap-4">
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

            
            <div className="flex items-center gap-4">
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

            
            <div className="flex items-center gap-4">
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
            </div> */}
          </div>

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
                // Don't render hidden fields
                if (field.is_hidden) return null;

                const fieldValue = customFieldValues[field.field_name] || "";

                return (
                  <div key={field.id} className="flex items-center gap-4 mb-3">
                    <label className="w-48 font-medium flex items-center">
                      {field.field_label}:
                    </label>

                    <div className="flex-1 relative">
                      <CustomFieldRenderer
                        field={field}
                        value={fieldValue}
                        onChange={handleCustomFieldChange}
                        allFields={customFields}
                        values={customFieldValues}
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
              className={`px-4 py-2 rounded ${
                isSubmitting || !isFormValid
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
