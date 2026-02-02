"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";

// Map admin field labels to placement backend columns (all fields driven by admin; no hardcoded standard fields)
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Job Seeker": "job_seeker_id",
  "Candidate": "job_seeker_id",
  "Job": "job_id",
  "Organization": "organization_id",
  "Organization Name": "organization_id",
  "Status": "status",
  "Start Date": "start_date",
  "End Date": "end_date",
  "Salary": "salary",
  "Owner": "owner",
  "Internal Email Notification": "internal_email_notification",
  "Email Notification": "internal_email_notification",
};

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

  const sortedCustomFields = useMemo(() => {
    return [...customFields]
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [customFields]);

  const fieldByColumn = useMemo(() => {
    const map: Record<string, any> = {};
    sortedCustomFields.forEach((field: any) => {
      const col = BACKEND_COLUMN_BY_LABEL[field.field_label];
      if (col) map[col] = field;
    });
    return map;
  }, [sortedCustomFields]);

  const jobField = fieldByColumn.job_id;
  const candidateField = fieldByColumn.job_seeker_id;
  const organizationField = fieldByColumn.organization_id;

  // Fetch job seekers and jobs on mount (for Job/Candidate dropdown options)
  useEffect(() => {
    fetchJobSeekers();
    fetchJobs();
  }, []);

  const fetchJobSeekers = async () => {
    setIsLoadingJobSeekers(true);
    try {
      const response = await fetch("/api/job-seekers");
      if (response.ok) {
        const data = await response.json();
        setJobSeekers(data.jobSeekers || []);
      }
    } catch (err) {
      console.error("Error fetching job seekers:", err);
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
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handlePlacementFieldChange = useCallback(
    (fieldName: string, value: any) => {
      handleCustomFieldChange(fieldName, value);
      const field = sortedCustomFields.find((f: any) => f.field_name === fieldName);
      if (field && BACKEND_COLUMN_BY_LABEL[field.field_label] === "job_id" && organizationField) {
        const job = jobs.find((j: any) => String(j.id) === String(value));
        if (job) {
          const orgName = job.organization_name ?? job.organizationName ?? job.organization?.name ?? "";
          handleCustomFieldChange(organizationField.field_name, orgName);
        }
      }
    },
    [handleCustomFieldChange, sortedCustomFields, organizationField, jobs]
  );

  const fetchPlacement = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/placements/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch placement details");
        }

        const data = await response.json();
        const placement = data.placement;

        const get = (key: string) =>
          (placement as any)[key] ??
          (placement as any)[key.replace(/_/g, "")] ??
          (placement as any)[key.replace(/(_\w)/g, (m: string) => m[1].toUpperCase())];

        const mapped: Record<string, any> = {};
        sortedCustomFields.forEach((field: any) => {
          const col = BACKEND_COLUMN_BY_LABEL[field.field_label];
          if (col) {
            let v = get(col);
            if (col === "organization_id" && (v == null || v === "")) {
              v = placement.organization_name ?? placement.organizationName ?? placement.organization?.name ?? "";
            }
            if (v !== undefined && v !== null) mapped[field.field_name] = String(v);
          }
        });

        let existingCustomFields: Record<string, any> = {};
        if (placement.custom_fields) {
          try {
            existingCustomFields =
              typeof placement.custom_fields === "string"
                ? JSON.parse(placement.custom_fields)
                : placement.custom_fields;
          } catch (_) {}
        }
        sortedCustomFields.forEach((field: any) => {
          const label = field.field_label || field.field_name;
          if (existingCustomFields[label] != null && !(field.field_name in mapped)) {
            mapped[field.field_name] = existingCustomFields[label];
          }
        });

        setCustomFieldValues((prev: Record<string, any>) => ({ ...prev, ...mapped }));
      } catch (err) {
        console.error("Error fetching placement:", err);
        setError(err instanceof Error ? err.message : "An error occurred while fetching placement details");
      } finally {
        setIsLoading(false);
      }
    },
    [sortedCustomFields, setCustomFieldValues]
  );

  useEffect(() => {
    if (placementId && !hasFetchedRef.current && !customFieldsLoading) {
      hasFetchedRef.current = true;
      fetchPlacement(placementId);
    }
    if (!placementId) hasFetchedRef.current = false;
  }, [placementId, customFieldsLoading, fetchPlacement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateCustomFields();
    if (!validation.isValid) {
      setError(validation.message || "Please fix the errors below.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const customFieldsToSend = getCustomFieldsForSubmission();

      const cleanPayload: Record<string, any> = {
        job_seeker_id: null,
        job_id: null,
        organization_id: null,
        status: "Active",
        start_date: null,
        end_date: null,
        salary: null,
        owner: null,
        internal_email_notification: null,
        custom_fields: {},
      };

      const customFieldsForDB: Record<string, any> = {};

      // Labels in BACKEND_COLUMN_BY_LABEL → top-level columns; all others → custom_fields JSONB
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          if (column === "job_seeker_id" || column === "job_id") {
            const n = Number(value);
            cleanPayload[column] = !isNaN(n) ? n : null;
          } else if (column === "organization_id") {
            cleanPayload[column] = value;
          } else {
            cleanPayload[column] = value;
          }
        } else {
          // Field not in map: store in custom_fields so it is never lost
          customFieldsForDB[label] = value;
        }
      });

      if (cleanPayload.job_id != null && jobs.length > 0) {
        const job = jobs.find((j: any) => String(j.id) === String(cleanPayload.job_id));
        if (job) {
          const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
          if (orgId != null) cleanPayload.organization_id = Number(orgId);
        }
      }

      cleanPayload.custom_fields = customFieldsForDB;

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
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${isEditMode ? "update" : "create"} placement`);
      }

      const id = isEditMode ? placementId : data.placement?.id;
      router.push(`/dashboard/placements/view?id=${id}`);
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} placement:`, err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => router.back();

  const organizationDisplayValue = organizationField ? (customFieldValues[organizationField.field_name] ?? "") : "";

  const canSubmit = useMemo(() => {
    if (!jobField || !candidateField) return true;
    const j = customFieldValues[jobField.field_name];
    const c = customFieldValues[candidateField.field_name];
    return j != null && String(j).trim() !== "" && c != null && String(c).trim() !== "";
  }, [jobField, candidateField, customFieldValues]);

  if (isLoading) {
    return <LoadingScreen message="Loading placement data..." />;
  }

  if (isSubmitting) {
    return (
      <LoadingScreen
        message={isEditMode ? "Updating placement..." : "Creating placement..."}
      />
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center">
            <Image src="/window.svg" alt="Placement" width={24} height={24} className="mr-2" />
            <h1 className="text-xl font-bold">{isEditMode ? "Edit" : "Add"} Placement</h1>
          </div>
          <button onClick={handleGoBack} className="text-gray-500 hover:text-gray-700">
            <span className="text-2xl font-bold">X</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {customFieldsLoading ? (
              <div className="text-center py-4 text-gray-500">Loading custom fields...</div>
            ) : (
              sortedCustomFields.map((field: any) => {
                const column = BACKEND_COLUMN_BY_LABEL[field.field_label];
                const fieldValue = customFieldValues[field.field_name] ?? field.default_value ?? "";

                if (column === "job_id") {
                  return (
                    <div key={field.id} className="flex items-center">
                      <label className="w-48 font-medium shrink-0">
                        {field.field_label}
                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="flex-1 relative">
                        {isLoadingJobs ? (
                          <div className="p-2 text-gray-500">Loading jobs...</div>
                        ) : (
                          <select
                            value={String(fieldValue)}
                            onChange={(e) => handlePlacementFieldChange(field.field_name, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required={field.is_required}
                          >
                            <option value="">Select a job</option>
                            {jobs.map((job: any) => (
                              <option key={job.id} value={job.id}>
                                {job.title ?? job.job_title ?? `Job #${job.id}`}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                }

                if (column === "job_seeker_id") {
                  return (
                    <div key={field.id} className="flex items-center">
                      <label className="w-48 font-medium shrink-0">
                        {field.field_label}
                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="flex-1 relative">
                        {isLoadingJobSeekers ? (
                          <div className="p-2 text-gray-500">Loading job seekers...</div>
                        ) : (
                          <select
                            value={String(fieldValue)}
                            onChange={(e) => handlePlacementFieldChange(field.field_name, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required={field.is_required}
                          >
                            <option value="">Select a job seeker</option>
                            {jobSeekers.map((js: any) => (
                              <option key={js.id} value={js.id}>
                                {(() => {
                                const name = js.full_name ?? `${js.first_name ?? ""} ${js.last_name ?? ""}`.trim();
                                return name || `Job Seeker #${js.id}`;
                              })()}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                }

                if (column === "organization_id") {
                  return (
                    <div key={field.id} className="flex items-center">
                      <label className="w-48 font-medium shrink-0">{field.field_label}</label>
                      <div className="flex-1 p-2 border border-gray-200 bg-gray-50 text-gray-700 rounded">
                        {organizationDisplayValue || "—"}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="flex items-center">
                    <label className="w-48 font-medium shrink-0">
                      {field.field_label}
                      {field.is_required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="flex-1">
                      <CustomFieldRenderer
                        field={field}
                        value={fieldValue}
                        onChange={handlePlacementFieldChange}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

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
              disabled={isSubmitting || !canSubmit}
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
