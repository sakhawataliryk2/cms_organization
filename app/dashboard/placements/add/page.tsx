"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";

export default function AddPlacement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placementId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!placementId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!placementId);
  const hasFetchedRef = useRef(false);
  
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("placements");

  const [jobSeekers, setJobSeekers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobSeekers, setIsLoadingJobSeekers] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  const [formData, setFormData] = useState({
    job_seeker_id: "",
    job_id: "",
    organization_id: "" as string | number,
    organization_name: "",
    status: "Active",
    start_date: "",
    end_date: "",
    salary: "",
    owner: "",
    internal_email_notification: "",
  });

  // Fetch job seekers and jobs on mount
  useEffect(() => {
    fetchJobSeekers();
    fetchJobs();
  }, []);

  // Fetch placement data if editing
  const fetchPlacement = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/placements/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch placement details"
        );
      }

      const data = await response.json();
      const placement = data.placement;

      // Parse existing custom fields
      let existingCustomFields: Record<string, any> = {};
      if (placement.custom_fields) {
        try {
          existingCustomFields =
            typeof placement.custom_fields === "string"
              ? JSON.parse(placement.custom_fields)
              : placement.custom_fields;
        } catch (e) {
          console.error("Error parsing existing custom fields:", e);
        }
      }

      // Map custom fields from field_label to field_name
      const mappedCustomFieldValues: Record<string, any> = {};
      customFields.forEach((field) => {
        const label = field.field_label || field.field_name;
        if (existingCustomFields[label]) {
          mappedCustomFieldValues[field.field_name] = existingCustomFields[label];
        }
      });

      setCustomFieldValues(mappedCustomFieldValues);

      // Set form data
      setFormData({
        job_seeker_id: placement.jobSeekerId || placement.job_seeker_id || "",
        job_id: placement.jobId || placement.job_id || "",
        organization_id: placement.organizationId ?? placement.organization_id ?? "",
        organization_name: placement.organizationName || placement.organization_name || "",
        status: placement.status || "Active",
        start_date: placement.startDate ? placement.startDate.split('T')[0] : (placement.start_date ? placement.start_date.split('T')[0] : ""),
        end_date: placement.endDate ? placement.endDate.split('T')[0] : (placement.end_date ? placement.end_date.split('T')[0] : ""),
        salary: placement.salary || "",
        owner: placement.owner || placement.owner_name || "",
        internal_email_notification: placement.internalEmailNotification || placement.internal_email_notification || "",
      });
    } catch (err) {
      console.error("Error fetching placement:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placement details"
      );
    } finally {
      setIsLoading(false);
    }
  }, [customFields, setCustomFieldValues]);

  // Fetch placement when in edit mode (wait for customFields to load so mapping works)
  useEffect(() => {
    if (placementId && !hasFetchedRef.current && !customFieldsLoading) {
      hasFetchedRef.current = true;
      fetchPlacement(placementId);
    }
    if (!placementId) {
      hasFetchedRef.current = false;
    }
  }, [placementId, customFieldsLoading, fetchPlacement]);

  const fetchJobSeekers = async () => {
    setIsLoadingJobSeekers(true);
    try {
      const response = await fetch("/api/job-seekers");
      if (response.ok) {
        const data = await response.json();
        setJobSeekers(data.jobSeekers || []);
      }
    } catch (error) {
      console.error("Error fetching job seekers:", error);
    } finally {
      setIsLoadingJobSeekers(false);
    }
  };

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const response = await fetch("/api/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (name === "job_id") {
      const job = jobs.find((j) => String(j.id) === value);
      setFormData((prev) => ({
        ...prev,
        job_id: value,
        organization_id: job?.organization_id ?? job?.organizationId ?? "",
        organization_name: job?.organization_name ?? job?.organizationName ?? "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const customFieldsToSend = getCustomFieldsForSubmission();

      const cleanPayload: Record<string, any> = {
        job_seeker_id: formData.job_seeker_id || null,
        job_id: formData.job_id || null,
        organization_id: formData.organization_id ? Number(formData.organization_id) : null,
        status: formData.status || "Active",
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        salary: formData.salary || null,
        owner: formData.owner || null,
        internal_email_notification: formData.internal_email_notification || null,
        custom_fields: JSON.parse(JSON.stringify(customFieldsToSend)),
      };

      let response;
      if (isEditMode && placementId) {
        response = await fetch(`/api/placements/${placementId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanPayload),
        });
      } else {
        response = await fetch("/api/placements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanPayload),
        });
      }

      const responseText = await response.text();
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
            `Failed to ${isEditMode ? "update" : "create"} placement`
        );
      }

      const id = isEditMode ? placementId : data.placement.id;
      router.push(`/dashboard/placements/view?id=${id}`);
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} placement:`,
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

  if (isLoading) {
    return <LoadingScreen message="Loading placement data..." />;
  }

  if (isSubmitting) {
    return (
      <LoadingScreen
        message={
          isEditMode ? "Updating placement..." : "Creating placement..."
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
              alt="Placement"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Placement
            </h1>
          </div>
          <button
            onClick={handleGoBack}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl font-bold">X</span>
          </button>
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
            {/* Job Seeker */}
            <div className="flex items-center">
              <label className="w-48 font-medium">
                Job Seeker <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 relative">
                {isLoadingJobSeekers ? (
                  <div className="p-2 text-gray-500">Loading job seekers...</div>
                ) : (
                  <select
                    name="job_seeker_id"
                    value={formData.job_seeker_id}
                    onChange={handleChange}
                    className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select a job seeker</option>
                    {jobSeekers.map((js) => (
                      <option key={js.id} value={js.id}>
                        {js.full_name || `${js.first_name || ''} ${js.last_name || ''}`.trim() || `Job Seeker #${js.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <span className="absolute text-red-500 left-[-10px] top-2">*</span>
              </div>
            </div>

            {/* Job */}
            <div className="flex items-center">
              <label className="w-48 font-medium">
                Job <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 relative">
                {isLoadingJobs ? (
                  <div className="p-2 text-gray-500">Loading jobs...</div>
                ) : (
                  <select
                    name="job_id"
                    value={formData.job_id}
                    onChange={handleChange}
                    className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select a job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title || job.job_title || `Job #${job.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <span className="absolute text-red-500 left-[-10px] top-2">*</span>
              </div>
            </div>

            {/* Organization (read-only, filled from selected job) */}
            <div className="flex items-center">
              <label className="w-48 font-medium">Organization</label>
              <div className="flex-1 p-2 border-b border-gray-200 bg-gray-50 text-gray-700 rounded">
                {formData.organization_name || "—"}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center">
              <label className="w-48 font-medium">Status:</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Terminated">Terminated</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="flex items-center">
              <label className="w-48 font-medium">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 relative">
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="absolute text-red-500 left-[-10px] top-2">*</span>
              </div>
            </div>

            {/* End Date */}
            <div className="flex items-center">
              <label className="w-48 font-medium">End Date:</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Salary */}
            <div className="flex items-center">
              <label className="w-48 font-medium">Salary:</label>
              <input
                type="text"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="e.g., $50,000"
              />
            </div>

            {/* Owner */}
            <div className="flex items-center">
              <label className="w-48 font-medium">Owner:</label>
              <input
                type="text"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="Owner name"
              />
            </div>

            {/* Internal Email Notification */}
            <div className="flex items-center">
              <label className="w-48 font-medium">Internal Email Notification:</label>
              <input
                type="email"
                name="internal_email_notification"
                value={formData.internal_email_notification}
                onChange={handleChange}
                className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                placeholder="email@example.com"
              />
            </div>

            {/* Custom Fields */}
            {customFieldsLoading ? (
              <div className="text-center py-4 text-gray-500">
                Loading custom fields...
              </div>
            ) : (
              customFields
                .filter((field) => !field.is_hidden)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((field) => (
                  <div key={field.id} className="flex items-center">
                    <label className="w-48 font-medium">
                      {field.field_label}
                      {field.is_required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <div className="flex-1">
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.field_name] || field.default_value || ""}
                        onChange={(value) =>
                          handleCustomFieldChange(field.field_name, value)
                        }
                      />
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isSubmitting || !formData.job_seeker_id || !formData.job_id || !formData.start_date}
            >
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update Placement"
                : "Create Placement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

