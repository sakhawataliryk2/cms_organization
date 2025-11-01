"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";

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

  // Custom fields state
  const [customFields, setCustomFields] = useState<FormField[]>([]);

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

    // Fetch custom fields for leads
    fetchCustomFields();
  }, []);

  // If leadId is present, fetch the lead data
  useEffect(() => {
    if (leadId) {
      fetchLead(leadId);
    }
  }, [leadId]);

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

  // Fetch custom fields for leads
  const fetchCustomFields = async () => {
    try {
      const response = await fetch("/api/admin/field-management/leads");
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];

        // Convert to form fields format
        const customFormFields: FormField[] = fields
          .filter((field: any) => !field.is_hidden)
          .map((field: any) => ({
            id: `custom_${field.field_name}`,
            name: field.field_name,
            label: field.field_label,
            type: field.field_type as any,
            required: field.is_required,
            visible: true,
            options: field.options || [],
            placeholder: field.placeholder || "",
            value: "",
            sortOrder: field.sort_order,
          }));

        setCustomFields(
          customFormFields.sort(
            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
          )
        );
      }
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    }
  };

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
      if (lead.custom_fields) {
        try {
          const customFieldValues =
            typeof lead.custom_fields === "string"
              ? JSON.parse(lead.custom_fields)
              : lead.custom_fields;

          setCustomFields((prev) =>
            prev.map((field) => ({
              ...field,
              value: customFieldValues[field.name] || "",
            }))
          );
        } catch (e) {
          console.error("Error parsing custom fields:", e);
        }
      }
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

  const handleCustomFieldChange = (fieldId: string, value: string) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, value } : field))
    );
  };

  const validateForm = () => {
    // Validate required fields
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return false;
    }
    if (!formData.lastName.trim()) {
      setError("Last name is required");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Invalid email format");
      return false;
    }

    // Validate second email if provided
    if (formData.email2 && !emailRegex.test(formData.email2)) {
      setError("Invalid format for second email");
      return false;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !field.value.trim()) {
        setError(`${field.label} is required`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Collect custom field values
      const customFieldValues: Record<string, string> = {};
      customFields.forEach((field) => {
        if (field.value) {
          customFieldValues[field.name] = field.value;
        }
      });

      const apiData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        status: formData.status,
        nickname: formData.nickname,
        title: formData.title,
        organizationId: formData.organizationId,
        organizationName: formData.organizationId, // In case it's a string name
        department: formData.department,
        reportsTo: formData.reportsTo,
        owner: formData.owner || currentUser?.name || "",
        secondaryOwners: formData.secondaryOwners,
        email: formData.email,
        email2: formData.email2,
        phone: formData.phone,
        mobilePhone: formData.mobilePhone,
        directLine: formData.directLine,
        linkedinUrl: formData.linkedinUrl,
        address: formData.address,
        customFields: customFieldValues,
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

  if (isLoading) {
    return <LoadingScreen message="Loading lead data..." />;
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
            {/* First Name */}
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

            {/* Last Name */}
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

            {/* Status */}
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

            {/* Nickname */}
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

            {/* Title */}
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

            {/* Organization */}
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

            {/* Department */}
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

            {/* Reports to */}
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

            {/* Owner */}
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

            {/* Secondary Owners */}
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
          </div>

          {/* Contact Information Section */}
          <div className="mt-8">
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

            {/* Email 1 */}
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

            {/* Email 2 */}
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

            {/* Phone */}
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

            {/* Mobile Phone */}
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

            {/* Direct Line */}
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

            {/* LinkedIn URL */}
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

            {/* Address */}
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
          </div>

          {/* Custom Fields Section */}
          {customFields.length > 0 && (
            <div className="mt-8">
              <div className="bg-gray-100 p-2 mb-4">
                <h2 className="font-medium flex items-center">
                  <Image
                    src="/file.svg"
                    alt="Custom"
                    width={16}
                    height={16}
                    className="mr-2"
                  />
                  Custom Fields
                </h2>
              </div>

              {customFields.map((field) => (
                <div key={field.id} className="flex items-center mt-4">
                  <label className="w-48 font-medium">{field.label}:</label>
                  <div className="flex-1 relative">
                    {field.type === "select" ? (
                      <select
                        name={field.name}
                        value={field.value}
                        onChange={(e) =>
                          handleCustomFieldChange(field.id, e.target.value)
                        }
                        className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        name={field.name}
                        value={field.value}
                        onChange={(e) =>
                          handleCustomFieldChange(field.id, e.target.value)
                        }
                        rows={3}
                        placeholder={field.placeholder}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                        required={field.required}
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={field.name}
                        value={field.value}
                        onChange={(e) =>
                          handleCustomFieldChange(field.id, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                        required={field.required}
                      />
                    )}
                    {field.required && (
                      <span className="absolute text-red-500 left-[-10px] top-2">
                        *
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
