"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";

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
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues, // ✅ Yeh bhi extract karein
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("organizations");
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

  // If organizationId is present, fetch the organization data
  useEffect(() => {
    if (organizationId) {
      fetchOrganization(organizationId);
    }
  }, [organizationId, customFields]);

  const fetchOrganization = async (id: string) => {
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

      // ✅ Correct field name use karo
      if (data?.custom_fields) {
        setCustomFieldValues(data.custom_fields);
      }

      console.log("Custom Field Values Loaded:", data.custom_fields);
      console.log("Received organization data:", org);

      // Parse existing custom fields
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
      // ✅ IMPORTANT: Yeh line yahi add karni hai!
      setCustomFieldValues(existingCustomFields);
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
  };
  console.log("FormData Loaded:", formData);
  console.log("Custom Fields Loaded:", customFields);
  console.log("Custom Field Values Loaded:", customFieldValues);

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
      const apiData = {
        name: name,
        nicknames: customFieldsToSend["Nicknames"] || formData.nicknames,
        parent_organization:
          customFieldsToSend["Parent Organization"] ||
          formData.parentOrganization,
        website: website,
        status: customFieldsToSend["Status"] || formData.status,
        contract_on_file: formData.contractOnFile,
        contract_signed_by: formData.contractSignedBy,
        date_contract_signed: formData.dateContractSigned || null,
        year_founded:
          customFieldsToSend["Year Founded"] || formData.yearFounded,
        overview: overview,
        perm_fee:
          customFieldsToSend["Standard Perm Fee (%)"] || formData.permFee,
        num_employees: customFieldsToSend["# of Employees"]
          ? parseInt(customFieldsToSend["# of Employees"])
          : formData.numEmployees
          ? parseInt(formData.numEmployees)
          : null,
        num_offices: customFieldsToSend["# of Offices"]
          ? parseInt(customFieldsToSend["# of Offices"])
          : formData.numOffices
          ? parseInt(formData.numOffices)
          : null,
        contact_phone:
          customFieldsToSend["Contact Phone"] || formData.contactPhone,
        address: customFieldsToSend["Address"] || formData.address,
        // ✅ CRITICAL FIX: Always send custom_fields, even if empty
        custom_fields: customFieldsToSend || {},
      };

      // 🔍 DEBUG: Log the final payload
      console.log("=== FINAL PAYLOAD ===");
      console.log("Full apiData:", JSON.stringify(apiData, null, 2));
      console.log("apiData.custom_fields:", apiData.custom_fields);
      console.log(
        "Type of apiData.custom_fields:",
        typeof apiData.custom_fields
      );
      console.log("=== END PAYLOAD ===");

      let response;
      if (isEditMode && organizationId) {
        response = await fetch(`/api/organizations/${organizationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
        });
      } else {
        response = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
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

                {customFields.map((field) => {
                  // Don't render hidden fields at all (neither label nor input)
                  if (field.is_hidden) return null;
                   // ✅ yahan fieldValue declare karo
  const fieldValue = customFieldValues[field.field_name] || "";
  console.log("fieldValue:", fieldValue);
  return (
    <div key={field.id} className="flex items-center mb-3">
      <label className="w-48 font-medium flex items-center">
        {field.field_label}:
        {field.is_required && (
          fieldValue.trim() !== "" ? (
            <span className="text-green-500 ml-1">*</span> 
          ) : (
            <span className="text-red-500 ml-1">*</span> 
          )
        )}
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
