// app/dashboard/jobs/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
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
    | "number"
    | "url";
  required: boolean;
  visible: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  value: string;
}

export default function AddJob() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("id"); // Get job ID from URL if present

  // Add these state variables
  const [isEditMode, setIsEditMode] = useState(!!jobId);
  const [isLoadingJob, setIsLoadingJob] = useState(!!jobId);
  const [loadError, setLoadError] = useState<string | null>(null);

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the custom fields hook
  const {
    customFields,
    customFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("jobs");

  // Initialize with default fields
  useEffect(() => {
    initializeFields();
  }, []);

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

  // Load job data when in edit mode
  useEffect(() => {
    if (jobId && formFields.length > 0 && !customFieldsLoading) {
      fetchJobData(jobId);
    }
  }, [jobId, formFields.length, customFieldsLoading]);

  // Function to fetch job data
  const fetchJobData = async (id: string) => {
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
          job.date_added ? job.date_added.split("T")[0] : ""
        );

        // Handle custom fields if they exist
        if (job.custom_fields) {
          let customFieldsObj = {};

          try {
            if (typeof job.custom_fields === "string") {
              customFieldsObj = JSON.parse(job.custom_fields);
            } else if (typeof job.custom_fields === "object") {
              customFieldsObj = job.custom_fields;
            }

            // Update custom field values using the hook
            Object.entries(customFieldsObj).forEach(([key, value]) => {
              handleCustomFieldChange(key, String(value));
            });
          } catch (error) {
            console.error("Error parsing custom fields:", error);
          }
        }

        return updatedFields;
      });

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

    // Validate required custom fields
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create an object with all standard field values (only the visible ones)
      const formData = formFields.reduce((acc, field) => {
        if (field.visible) {
          acc[field.name] = field.value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Add custom fields to the form data
      const customFieldsToSend = getCustomFieldsForSubmission();
      if (Object.keys(customFieldsToSend).length > 0) {
        formData.custom_fields = JSON.stringify(customFieldsToSend);
      }

      console.log(
        `${isEditMode ? "Updating" : "Creating"} job data:`,
        formData
      );

      // Choose the appropriate API endpoint and method based on whether we're editing or creating
      const url = isEditMode ? `/api/jobs/${jobId}` : "/api/jobs";
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
          data.message || `Failed to ${isEditMode ? "update" : "create"} job`
        );
      }

      console.log(
        `Job ${isEditMode ? "updated" : "created"} successfully:`,
        data
      );

      // Navigate to the job view page
      const resultId = isEditMode ? jobId : data.job ? data.job.id : null;
      if (resultId) {
        router.push("/dashboard/jobs/view?id=" + resultId);
      } else {
        // Fallback if we don't have an ID
        router.push("/dashboard/jobs");
      }
    } catch (error) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} job:`,
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Standard Job Fields */}
            {/* {formFields
                            .filter(field => field.visible)
                            .map((field, index) => (
                                <div key={field.id} className="flex items-center"> */}
            {/* Field label */}
            {/* <label className="w-48 font-medium">
                                        {field.label}:
                                    </label> */}

            {/* Field input */}
            {/* <div className="flex-1 relative">
                                        {field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'url' ? (
                                            <input
                                                type={field.type}
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
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
                                    </div> */}
            {/* </div> */}
            {/* ))} */}

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
            <span className="text-green-500 ml-1">*</span> // ✅ Green check if filled
          ) : (
            <span className="text-red-500 ml-1">*</span> // ❌ Red star if empty
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
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
