"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";

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

export default function AddLead() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!leadId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!leadId);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [hiringManagers, setHiringManagers] = useState<
    Array<{ id: string; name: string; full_name?: string; first_name?: string; last_name?: string }>
  >([]);
  const [jobSeekers, setJobSeekers] = useState<
    Array<{ id: string; name: string; full_name?: string; first_name?: string; last_name?: string; email?: string }>
  >([]);
  const [jobs, setJobs] = useState<
    Array<{ id: string; job_title?: string; title?: string; name?: string }>
  >([]);
  const [placements, setPlacements] = useState<
    Array<{ id: string; candidate_name?: string; job_seeker_name?: string; job_title?: string; job_name?: string; name?: string }>
  >([]);
  const [opportunities, setOpportunities] = useState<
    Array<{ id: string; name?: string; title?: string; opportunity_name?: string }>
  >([]);

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

    // Fetch active users for owner dropdown
    fetchActiveUsers();
    // Fetch hiring managers for Field_18 (Contact) lookup
    fetchHiringManagers();
    // Fetch job seekers for Field_20 (Candidate) lookup
    fetchJobSeekers();
    // Fetch jobs for Field_21 (Job) lookup
    fetchJobs();
    // Fetch placements for Field_22 (Placement) lookup
    fetchPlacements();
    // Fetch opportunities for Field_23 (Opportunity) lookup
    fetchOpportunities();
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

  // Fetch active users for Field_8 (Owner) dropdown
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

  // Fetch hiring managers for Field_18 (Contact) lookup
  const fetchHiringManagers = async () => {
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
        setHiringManagers(data.hiringManagers || []);
      }
    } catch (error) {
      console.error("Error fetching hiring managers:", error);
    }
  };

  // Fetch job seekers (candidates) for Field_20 (Candidate) lookup
  const fetchJobSeekers = async () => {
    try {
      const response = await fetch("/api/job-seekers", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setJobSeekers(data.jobSeekers || []);
      }
    } catch (error) {
      console.error("Error fetching job seekers:", error);
    }
  };

  // Fetch jobs for Field_21 (Job) lookup
  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  // Fetch placements for Field_22 (Placement) lookup
  const fetchPlacements = async () => {
    try {
      const response = await fetch("/api/placements", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPlacements(data.placements || []);
      }
    } catch (error) {
      console.error("Error fetching placements:", error);
    }
  };

  // Fetch opportunities for Field_23 (Opportunity) lookup
  const fetchOpportunities = async () => {
    try {
      const response = await fetch("/api/opportunities", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    }
  };

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
      // Get custom fields for submission (keys are field_label)
      const customFieldsToSend = getCustomFieldsForSubmission();

      // Build DB customFields object (keep empty strings, skip undefined/null)
      const customFieldsForDB: Record<string, any> = {};
      Object.keys(customFieldsToSend).forEach((k) => {
        const v = customFieldsToSend[k];
        if (v !== undefined && v !== null) customFieldsForDB[k] = v;
      });

      // Extract firstName and lastName from custom fields OR formData (same pattern as jobs)
      const mappedFirstName =
        customFieldsToSend["First Name"] ||
        formData.firstName ||
        "";
      
      const mappedLastName =
        customFieldsToSend["Last Name"] ||
        formData.lastName ||
        "";

      // Map other standard fields from custom fields OR formData
      const mappedStatus =
        customFieldsToSend["Status"] || formData.status || "New Lead";
      const mappedNickname =
        customFieldsToSend["Nickname"] || formData.nickname || "";
      const mappedTitle =
        customFieldsToSend["Title"] || formData.title || "";
      const mappedOrganizationId =
        customFieldsToSend["Organization"] || formData.organizationId || "";
      const mappedDepartment =
        customFieldsToSend["Department"] || formData.department || "";
      const mappedReportsTo =
        customFieldsToSend["Reports To"] || formData.reportsTo || "";
      const mappedOwner =
        customFieldsToSend["Owner"] || formData.owner || currentUser?.name || "";
      const mappedSecondaryOwners =
        customFieldsToSend["Secondary Owners"] || formData.secondaryOwners || "";
      const mappedEmail =
        customFieldsToSend["Email"] || formData.email || "";
      const mappedEmail2 =
        customFieldsToSend["Email 2"] || formData.email2 || "";
      const mappedPhone =
        customFieldsToSend["Phone"] || formData.phone || "";
      const mappedMobilePhone =
        customFieldsToSend["Mobile Phone"] || formData.mobilePhone || "";
      const mappedDirectLine =
        customFieldsToSend["Direct Line"] || formData.directLine || "";
      const mappedLinkedInUrl =
        customFieldsToSend["LinkedIn URL"] || formData.linkedinUrl || "";
      const mappedAddress =
        customFieldsToSend["Address"] || formData.address || "";

      const apiData = {
        firstName: mappedFirstName,
        lastName: mappedLastName,
        status: mappedStatus,
        nickname: mappedNickname,
        title: mappedTitle,
        organizationId: mappedOrganizationId,
        organizationName: mappedOrganizationId, // In case it's a string name
        department: mappedDepartment,
        reportsTo: mappedReportsTo,
        owner: mappedOwner,
        secondaryOwners: mappedSecondaryOwners,
        email: mappedEmail,
        email2: mappedEmail2,
        phone: mappedPhone,
        mobilePhone: mappedMobilePhone,
        directLine: mappedDirectLine,
        linkedinUrl: mappedLinkedInUrl,
        address: mappedAddress,
        // Use snake_case custom_fields to match backend expectation
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
          <div className="flex items-center">
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
            {/* <button
                            type="button"
                            onClick={() => router.push('/dashboard/admin/field-mapping?section=leads')}
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
            
            {/* <div className="flex items-center">
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

            
            {/* <div className="flex items-center">
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
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            
            <div className="flex items-center">
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

                // Special handling for Field_8 (Owner) - active users dropdown
                if (field.field_name === "Field_8") {
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
                        <select
                          value={fieldValue}
                          onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                          required={field.is_required}
                        >
                          <option value="">Select {field.field_label}</option>
                          {activeUsers.map((user) => (
                            <option key={user.id} value={user.name || user.email}>
                              {user.name || user.email || `User #${user.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_16 (Assigned to) - active users dropdown
                if (field.field_name === "Field_16") {
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
                        <select
                          value={fieldValue}
                          onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                          required={field.is_required}
                        >
                          <option value="">Select {field.field_label}</option>
                          {activeUsers.map((user) => (
                            <option key={user.id} value={user.name || user.email}>
                              {user.name || user.email || `User #${user.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_18 (Contact) - multi-select hiring manager lookup
                if (field.field_name === "Field_18") {
                  // Parse existing value (comma-separated string or array)
                  const selectedContactIds = Array.isArray(fieldValue)
                    ? fieldValue
                    : typeof fieldValue === "string" && fieldValue.trim()
                    ? fieldValue.split(",").map((id) => id.trim()).filter(Boolean)
                    : [];

                  const handleContactLookupChange = (contactIds: string[]) => {
                    // Save as comma-separated string
                    const valueToSave = contactIds.length > 0 ? contactIds.join(", ") : "";
                    handleCustomFieldChange(field.field_name, valueToSave);
                  };

                  return (
                    <div key={field.id} className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center pt-2">
                        {field.field_label}:
                        {field.is_required &&
                          (selectedContactIds.length > 0 ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                          <div className="max-h-48 overflow-y-auto p-2">
                            {hiringManagers.length === 0 ? (
                              <div className="text-gray-500 text-sm p-2">
                                No hiring managers available in the system
                              </div>
                            ) : (
                              hiringManagers.map((contact) => {
                                const contactId = contact.id.toString();
                                const isSelected = selectedContactIds.includes(contactId);
                                const contactName =
                                  contact.full_name ||
                                  `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                                  contact.name ||
                                  `Contact #${contact.id}`;

                                return (
                                  <label
                                    key={contact.id}
                                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...selectedContactIds, contactId]
                                          : selectedContactIds.filter((id) => id !== contactId);
                                        handleContactLookupChange(newIds);
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                    />
                                    <span className="text-sm text-gray-700">{contactName}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selectedContactIds.length > 0 && (
                            <div className="border-t border-gray-300 p-2 bg-gray-50">
                              <div className="text-xs text-gray-600 mb-1">
                                Selected: {selectedContactIds.length} contact(s)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedContactIds.map((contactId) => {
                                  const contact = hiringManagers.find(
                                    (c) => c.id.toString() === contactId
                                  );
                                  const contactName =
                                    contact?.full_name ||
                                    `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
                                    contact?.name ||
                                    `Contact #${contactId}`;
                                  return contact ? (
                                    <span
                                      key={contactId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                    >
                                      {contactName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newIds = selectedContactIds.filter(
                                            (id) => id !== contactId
                                          );
                                          handleContactLookupChange(newIds);
                                        }}
                                        className="ml-1 text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_20 (Candidate) - multi-select job seeker lookup
                if (field.field_name === "Field_20") {
                  // Parse existing value (comma-separated string or array)
                  const selectedCandidateIds = Array.isArray(fieldValue)
                    ? fieldValue
                    : typeof fieldValue === "string" && fieldValue.trim()
                    ? fieldValue.split(",").map((id) => id.trim()).filter(Boolean)
                    : [];

                  const handleCandidateLookupChange = (candidateIds: string[]) => {
                    // Save as comma-separated string
                    const valueToSave = candidateIds.length > 0 ? candidateIds.join(", ") : "";
                    handleCustomFieldChange(field.field_name, valueToSave);
                  };

                  return (
                    <div key={field.id} className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center pt-2">
                        {field.field_label}:
                        {field.is_required &&
                          (selectedCandidateIds.length > 0 ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                          <div className="max-h-48 overflow-y-auto p-2">
                            {jobSeekers.length === 0 ? (
                              <div className="text-gray-500 text-sm p-2">
                                No candidates available in the system
                              </div>
                            ) : (
                              jobSeekers.map((candidate) => {
                                const candidateId = candidate.id.toString();
                                const isSelected = selectedCandidateIds.includes(candidateId);
                                const candidateName =
                                  candidate.full_name ||
                                  `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() ||
                                  candidate.name ||
                                  `Candidate #${candidate.id}`;

                                return (
                                  <label
                                    key={candidate.id}
                                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...selectedCandidateIds, candidateId]
                                          : selectedCandidateIds.filter((id) => id !== candidateId);
                                        handleCandidateLookupChange(newIds);
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                    />
                                    <span className="text-sm text-gray-700">{candidateName}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selectedCandidateIds.length > 0 && (
                            <div className="border-t border-gray-300 p-2 bg-gray-50">
                              <div className="text-xs text-gray-600 mb-1">
                                Selected: {selectedCandidateIds.length} candidate(s)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedCandidateIds.map((candidateId) => {
                                  const candidate = jobSeekers.find(
                                    (c) => c.id.toString() === candidateId
                                  );
                                  const candidateName =
                                    candidate?.full_name ||
                                    `${candidate?.first_name || ""} ${candidate?.last_name || ""}`.trim() ||
                                    candidate?.name ||
                                    `Candidate #${candidateId}`;
                                  return candidate ? (
                                    <span
                                      key={candidateId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                    >
                                      {candidateName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newIds = selectedCandidateIds.filter(
                                            (id) => id !== candidateId
                                          );
                                          handleCandidateLookupChange(newIds);
                                        }}
                                        className="ml-1 text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_21 (Job) - multi-select job lookup
                if (field.field_name === "Field_21") {
                  // Parse existing value (comma-separated string or array)
                  const selectedJobIds = Array.isArray(fieldValue)
                    ? fieldValue
                    : typeof fieldValue === "string" && fieldValue.trim()
                    ? fieldValue.split(",").map((id) => id.trim()).filter(Boolean)
                    : [];

                  const handleJobLookupChange = (jobIds: string[]) => {
                    // Save as comma-separated string
                    const valueToSave = jobIds.length > 0 ? jobIds.join(", ") : "";
                    handleCustomFieldChange(field.field_name, valueToSave);
                  };

                  return (
                    <div key={field.id} className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center pt-2">
                        {field.field_label}:
                        {field.is_required &&
                          (selectedJobIds.length > 0 ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                          <div className="max-h-48 overflow-y-auto p-2">
                            {jobs.length === 0 ? (
                              <div className="text-gray-500 text-sm p-2">
                                No jobs available in the system
                              </div>
                            ) : (
                              jobs.map((job) => {
                                const jobId = job.id.toString();
                                const isSelected = selectedJobIds.includes(jobId);
                                const jobName =
                                  job.job_title ||
                                  job.title ||
                                  job.name ||
                                  `Job #${job.id}`;

                                return (
                                  <label
                                    key={job.id}
                                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...selectedJobIds, jobId]
                                          : selectedJobIds.filter((id) => id !== jobId);
                                        handleJobLookupChange(newIds);
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                    />
                                    <span className="text-sm text-gray-700">{jobName}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selectedJobIds.length > 0 && (
                            <div className="border-t border-gray-300 p-2 bg-gray-50">
                              <div className="text-xs text-gray-600 mb-1">
                                Selected: {selectedJobIds.length} job(s)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedJobIds.map((jobId) => {
                                  const job = jobs.find(
                                    (j) => j.id.toString() === jobId
                                  );
                                  const jobName =
                                    job?.job_title ||
                                    job?.title ||
                                    job?.name ||
                                    `Job #${jobId}`;
                                  return job ? (
                                    <span
                                      key={jobId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                    >
                                      {jobName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newIds = selectedJobIds.filter(
                                            (id) => id !== jobId
                                          );
                                          handleJobLookupChange(newIds);
                                        }}
                                        className="ml-1 text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_22 (Placement) - multi-select placement lookup
                if (field.field_name === "Field_22") {
                  // Parse existing value (comma-separated string or array)
                  const selectedPlacementIds = Array.isArray(fieldValue)
                    ? fieldValue
                    : typeof fieldValue === "string" && fieldValue.trim()
                    ? fieldValue.split(",").map((id) => id.trim()).filter(Boolean)
                    : [];

                  const handlePlacementLookupChange = (placementIds: string[]) => {
                    // Save as comma-separated string
                    const valueToSave = placementIds.length > 0 ? placementIds.join(", ") : "";
                    handleCustomFieldChange(field.field_name, valueToSave);
                  };

                  return (
                    <div key={field.id} className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center pt-2">
                        {field.field_label}:
                        {field.is_required &&
                          (selectedPlacementIds.length > 0 ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                          <div className="max-h-48 overflow-y-auto p-2">
                            {placements.length === 0 ? (
                              <div className="text-gray-500 text-sm p-2">
                                No placements available in the system
                              </div>
                            ) : (
                              placements.map((placement) => {
                                const placementId = placement.id.toString();
                                const isSelected = selectedPlacementIds.includes(placementId);
                                const placementName =
                                  placement.candidate_name ||
                                  placement.job_seeker_name ||
                                  placement.job_title ||
                                  placement.job_name ||
                                  placement.name ||
                                  `Placement #${placement.id}`;

                                return (
                                  <label
                                    key={placement.id}
                                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...selectedPlacementIds, placementId]
                                          : selectedPlacementIds.filter((id) => id !== placementId);
                                        handlePlacementLookupChange(newIds);
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                    />
                                    <span className="text-sm text-gray-700">{placementName}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selectedPlacementIds.length > 0 && (
                            <div className="border-t border-gray-300 p-2 bg-gray-50">
                              <div className="text-xs text-gray-600 mb-1">
                                Selected: {selectedPlacementIds.length} placement(s)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedPlacementIds.map((placementId) => {
                                  const placement = placements.find(
                                    (p) => p.id.toString() === placementId
                                  );
                                  const placementName =
                                    placement?.candidate_name ||
                                    placement?.job_seeker_name ||
                                    placement?.job_title ||
                                    placement?.job_name ||
                                    placement?.name ||
                                    `Placement #${placementId}`;
                                  return placement ? (
                                    <span
                                      key={placementId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                    >
                                      {placementName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newIds = selectedPlacementIds.filter(
                                            (id) => id !== placementId
                                          );
                                          handlePlacementLookupChange(newIds);
                                        }}
                                        className="ml-1 text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Special handling for Field_23 (Opportunity) - multi-select opportunity lookup
                if (field.field_name === "Field_23") {
                  // Parse existing value (comma-separated string or array)
                  const selectedOpportunityIds = Array.isArray(fieldValue)
                    ? fieldValue
                    : typeof fieldValue === "string" && fieldValue.trim()
                    ? fieldValue.split(",").map((id) => id.trim()).filter(Boolean)
                    : [];

                  const handleOpportunityLookupChange = (opportunityIds: string[]) => {
                    // Save as comma-separated string
                    const valueToSave = opportunityIds.length > 0 ? opportunityIds.join(", ") : "";
                    handleCustomFieldChange(field.field_name, valueToSave);
                  };

                  return (
                    <div key={field.id} className="flex items-start mb-3">
                      <label className="w-48 font-medium flex items-center pt-2">
                        {field.field_label}:
                        {field.is_required &&
                          (selectedOpportunityIds.length > 0 ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                          <div className="max-h-48 overflow-y-auto p-2">
                            {opportunities.length === 0 ? (
                              <div className="text-gray-500 text-sm p-2">
                                No opportunities available in the system
                              </div>
                            ) : (
                              opportunities.map((opportunity) => {
                                const opportunityId = opportunity.id.toString();
                                const isSelected = selectedOpportunityIds.includes(opportunityId);
                                const opportunityName =
                                  opportunity.name ||
                                  opportunity.title ||
                                  opportunity.opportunity_name ||
                                  `Opportunity #${opportunity.id}`;

                                return (
                                  <label
                                    key={opportunity.id}
                                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...selectedOpportunityIds, opportunityId]
                                          : selectedOpportunityIds.filter((id) => id !== opportunityId);
                                        handleOpportunityLookupChange(newIds);
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                    />
                                    <span className="text-sm text-gray-700">{opportunityName}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selectedOpportunityIds.length > 0 && (
                            <div className="border-t border-gray-300 p-2 bg-gray-50">
                              <div className="text-xs text-gray-600 mb-1">
                                Selected: {selectedOpportunityIds.length} opportunity(ies)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedOpportunityIds.map((opportunityId) => {
                                  const opportunity = opportunities.find(
                                    (o) => o.id.toString() === opportunityId
                                  );
                                  const opportunityName =
                                    opportunity?.name ||
                                    opportunity?.title ||
                                    opportunity?.opportunity_name ||
                                    `Opportunity #${opportunityId}`;
                                  return opportunity ? (
                                    <span
                                      key={opportunityId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                    >
                                      {opportunityName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newIds = selectedOpportunityIds.filter(
                                            (id) => id !== opportunityId
                                          );
                                          handleOpportunityLookupChange(newIds);
                                        }}
                                        className="ml-1 text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

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
                      <CustomFieldRenderer
                        field={field}
                        value={fieldValue}
                        onChange={handleCustomFieldChange}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Buttons */}
          <div className="flex justify-end space-x-4 mt-8">
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
