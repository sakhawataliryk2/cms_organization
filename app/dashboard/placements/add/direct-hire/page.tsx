"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";
import LookupField from "@/components/LookupField";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";

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
  } = useCustomFields("placements-direct-hire");

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

  // Auto-populate organization when job is selected and jobs are loaded
  useEffect(() => {
    if (jobField && organizationField && jobs.length > 0) {
      const selectedJobId = customFieldValues[jobField.field_name];
      if (selectedJobId && (!customFieldValues[organizationField.field_name] || customFieldValues[organizationField.field_name] === "")) {
        const job = jobs.find((j: any) => String(j.id) === String(selectedJobId));
        if (job) {
          const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
          if (orgId != null) {
            handleCustomFieldChange(organizationField.field_name, String(orgId));
          }
        }
      }
    }
  }, [jobs, customFieldValues, jobField, organizationField, handleCustomFieldChange]);

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
          // Store organization ID instead of name
          const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
          if (orgId != null) {
            handleCustomFieldChange(organizationField.field_name, String(orgId));
          }
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
            // For organization_id, ensure we store the ID, not the name
            if (col === "organization_id") {
              // First try to get the ID directly from placement
              v = placement.organization_id ?? placement.organizationId ?? placement.organization?.id ?? v;

              // If v is still a name (string that's not a number), try to find the ID from the job
              if (v && isNaN(Number(v)) && placement.job_id) {
                const job = jobs.find((j: any) => String(j.id) === String(placement.job_id));
                if (job) {
                  v = job.organization_id ?? job.organizationId ?? job.organization?.id ?? v;
                }
              }

              // If still not a valid ID, try to get from job if available
              if ((!v || isNaN(Number(v))) && placement.job_id && jobs.length > 0) {
                const job = jobs.find((j: any) => String(j.id) === String(placement.job_id));
                if (job) {
                  v = job.organization_id ?? job.organizationId ?? job.organization?.id;
                }
              }
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
          } catch (_) { }
        }
        sortedCustomFields.forEach((field: any) => {
          const label = field.field_label || field.field_name;
          if (existingCustomFields[label] != null && !(field.field_name in mapped)) {
            mapped[field.field_name] = existingCustomFields[label];
          }
        });

        // Auto-populate organization_id from job if not set
        if (organizationField && (!mapped[organizationField.field_name] || mapped[organizationField.field_name] === "")) {
          const jobId = mapped[jobField?.field_name || ""] || placement.job_id;
          if (jobId && jobs.length > 0) {
            const job = jobs.find((j: any) => String(j.id) === String(jobId));
            if (job) {
              const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
              if (orgId != null) {
                mapped[organizationField.field_name] = String(orgId);
              }
            }
          }
        }

        setCustomFieldValues((prev: Record<string, any>) => ({ ...prev, ...mapped }));
      } catch (err) {
        console.error("Error fetching placement:", err);
        setError(err instanceof Error ? err.message : "An error occurred while fetching placement details");
      } finally {
        setIsLoading(false);
      }
    },
    [sortedCustomFields, setCustomFieldValues, jobs, organizationField, jobField]
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
      const apiData: Record<string, any> = {
        placement_type: "Direct Hire"
      };
      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit). Same as organizations/tasks.
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          if (column === "job_seeker_id" || column === "job_id" || column === "organization_id") {
            const n = Number(value);
            apiData[column] = !isNaN(n) ? n : null;
          } else {
            apiData[column] = value;
          }
        }
        customFieldsForDB[label] = value;
      });

      // Ensure organization_id is set from job if not already set
      if (apiData.job_id != null && jobs.length > 0) {
        const job = jobs.find((j: any) => String(j.id) === String(apiData.job_id));
        if (job) {
          const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
          if (orgId != null) {
            apiData.organization_id = Number(orgId);
            // Also update the custom field value to ensure consistency
            if (organizationField) {
              customFieldsForDB[organizationField.field_label] = String(orgId);
            }
          }
        }
      }

      // Convert organization_id to number if it's a string
      if (apiData.organization_id !== undefined && apiData.organization_id !== null) {
        const orgIdNum = Number(apiData.organization_id);
        apiData.organization_id = !isNaN(orgIdNum) ? orgIdNum : null;
      }

      apiData.custom_fields =
        typeof customFieldsForDB === "object" && !Array.isArray(customFieldsForDB) && customFieldsForDB !== null
          ? JSON.parse(JSON.stringify(customFieldsForDB))
          : {};
      delete (apiData as any).customFields;

      // Build clean payload with explicit keys and custom_fields last (like organizations/tasks)
      const cleanPayload: Record<string, any> = {};
      if (apiData.job_seeker_id !== undefined) cleanPayload.job_seeker_id = apiData.job_seeker_id ?? null;
      if (apiData.job_id !== undefined) cleanPayload.job_id = apiData.job_id ?? null;
      if (apiData.organization_id !== undefined) cleanPayload.organization_id = apiData.organization_id ?? null;
      if (apiData.status !== undefined) cleanPayload.status = apiData.status ?? "Active";
      if (apiData.start_date !== undefined) cleanPayload.start_date = apiData.start_date && String(apiData.start_date).trim() !== "" ? apiData.start_date : null;
      if (apiData.end_date !== undefined) cleanPayload.end_date = apiData.end_date && String(apiData.end_date).trim() !== "" ? apiData.end_date : null;
      if (apiData.salary !== undefined) cleanPayload.salary = apiData.salary ?? null;
      if (apiData.owner !== undefined) cleanPayload.owner = apiData.owner ?? null;
      if (apiData.internal_email_notification !== undefined) cleanPayload.internal_email_notification = apiData.internal_email_notification ?? null;
      if (apiData.placement_type !== undefined) cleanPayload.placement_type = apiData.placement_type;

      cleanPayload.custom_fields =
        typeof apiData.custom_fields === "object" && apiData.custom_fields !== null && !Array.isArray(apiData.custom_fields)
          ? JSON.parse(JSON.stringify(apiData.custom_fields))
          : {};

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
      let data: { message?: string; error?: string; errors?: string[]; placement?: { id: string } } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (_) { }

      if (!response.ok) {
        const msg =
          data.message ||
          data.error ||
          (Array.isArray(data.errors) ? data.errors.join("; ") : null) ||
          response.statusText ||
          `Failed to ${isEditMode ? "update" : "create"} placement`;
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      const id = isEditMode ? placementId : data.placement?.id;
      router.push(`/dashboard/placements/view?id=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => router.back();

  // Get organization ID value for LookupField
  const organizationIdValue = organizationField ? (customFieldValues[organizationField.field_name] ?? "") : "";

  const canSubmit = useMemo(() => {
    const validation = validateCustomFields();
    if (!validation.isValid) return false;
    if (!jobField || !candidateField) return true;
    const j = customFieldValues[jobField.field_name];
    const c = customFieldValues[candidateField.field_name];
    return j != null && String(j).trim() !== "" && c != null && String(c).trim() !== "";
  }, [jobField, candidateField, customFieldValues, validateCustomFields]);

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
            <h1 className="text-xl font-bold">{isEditMode ? "Edit" : "Add"} Placement Direct Hire</h1>
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
                // const column = BACKEND_COLUMN_BY_LABEL[field.field_label];
                const fieldValue = customFieldValues[field.field_name] ?? field.default_value ?? "";
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
                    field.field_name?.toLowerCase().includes("zip");

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
                  // field.field_name?.toLowerCase().includes("phone");

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

                // if (column === "job_id") {
                //   return (
                //     <div key={field.id} className="flex items-center">
                //       <label className="w-48 font-medium shrink-0">
                //         {field.field_label}
                //         {field.is_required && <span className="text-red-500 ml-1">*</span>}
                //       </label>
                //       <div className="flex-1 relative">
                //         {isLoadingJobs ? (
                //           <div className="p-2 text-gray-500">Loading jobs...</div>
                //         ) : (
                //           <select
                //             value={String(fieldValue)}
                //             onChange={(e) => handlePlacementFieldChange(field.field_name, e.target.value)}
                //             className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                //             required={field.is_required}
                //           >
                //             <option value="">Select a job</option>
                //             {jobs.map((job: any) => (
                //               <option key={job.id} value={job.id}>
                //                 {job.title ?? job.job_title ?? `Job #${job.id}`}
                //               </option>
                //             ))}
                //           </select>
                //         )}
                //       </div>
                //     </div>
                //   );
                // }

                // if (column === "job_seeker_id") {
                //   return (
                //     <div key={field.id} className="flex items-center">
                //       <label className="w-48 font-medium shrink-0">
                //         {field.field_label}
                //         {field.is_required && <span className="text-red-500 ml-1">*</span>}
                //       </label>
                //       <div className="flex-1 relative">
                //         {isLoadingJobSeekers ? (
                //           <div className="p-2 text-gray-500">Loading job seekers...</div>
                //         ) : (
                //           <select
                //             value={String(fieldValue)}
                //             onChange={(e) => handlePlacementFieldChange(field.field_name, e.target.value)}
                //             className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                //             required={field.is_required}
                //           >
                //             <option value="">Select a job seeker</option>
                //             {jobSeekers.map((js: any) => (
                //               <option key={js.id} value={js.id}>
                //                 {(() => {
                //                   const name = js.full_name ?? `${js.first_name ?? ""} ${js.last_name ?? ""}`.trim();
                //                   return name || `Job Seeker #${js.id}`;
                //                 })()}
                //               </option>
                //             ))}
                //           </select>
                //         )}
                //       </div>
                //     </div>
                //   );
                // }

                // if (column === "organization_id") {
                //   return (
                //     <div key={field.id} className="flex items-center">
                //       <label className="w-48 font-medium shrink-0">
                //         {field.field_label}
                //         {(field.is_required) &&
                //           (hasValidValue() ? (
                //             <span className="text-green-500 ml-1">✔</span>
                //           ) : (
                //             <span className="text-red-500 ml-1">*</span>
                //           ))}
                //       </label>
                //       <div className="flex-1">
                //         <LookupField
                //           value={String(organizationIdValue)}
                //           onChange={(value) => {
                //             // Store the organization ID
                //             handleCustomFieldChange(field.field_name, value);
                //           }}
                //           lookupType="organizations"
                //           placeholder="Select an organization"
                //           required={field.is_required}
                //           disabled={true}
                //           className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                //         />
                //       </div>
                //     </div>
                //   );
                // }

                return (
                  <div key={field.id} className="flex items-center">
                    <label className="w-48 font-medium shrink-0">
                      {field.field_label}
                      {(field.is_required) &&
                        (hasValidValue() ? (
                          <span className="text-green-500 ml-1">✔</span>
                        ) : (
                          <span className="text-red-500 ml-1">*</span>
                        ))}
                    </label>
                    <div className="flex-1">
                        {
                          field?.field_label === "Organization" ? (
                            <LookupField
                              value={String(organizationIdValue)}
                              onChange={(value) => {
                                handleCustomFieldChange(field.field_name, value);
                              }}
                              lookupType="organizations"
                              placeholder="Select an organization"
                              required={field.is_required}
                              disabled={true}
                              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                          ) : (
                            <CustomFieldRenderer
                              field={field}
                              value={fieldValue}
                              allFields={customFields}
                              values={customFieldValues}
                              onChange={handlePlacementFieldChange}
                            />
                          )
                        }
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="h-20" aria-hidden="true" />
          <div className="sticky bottom-0 left-0 right-0 z-10 -mx-4 -mb-4 px-4 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className={`px-6 py-2 rounded ${isSubmitting || !canSubmit
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
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
