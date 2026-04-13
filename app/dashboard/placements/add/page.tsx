// app/dashboard/placements/add/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { formatRecordId } from "@/lib/recordIdFormatter";
import { getCustomFieldLabel } from "@/lib/getCustomFieldLabel";
import StyledReactSelect, { type StyledSelectOption } from "@/components/StyledReactSelect";

/** Map job_type from API to placement add segment (URL path). */
function jobTypeToPlacementSegment(jobType: string): string {
  const t = String(jobType || "").toLowerCase().replace(/\s+/g, "-");
  if (t.includes("direct")) return "direct-hire";
  if (t.includes("executive")) return "executive-search";
  return "contract";
}

/** Whether the job type is recognized for placements. */
function isKnownJobType(jobType: string): boolean {
  const t = String(jobType || "").toLowerCase();
  return t.includes("direct") || t.includes("executive") || t.includes("contract") || t === "";
}

type JobItem = {
  id: number | string;
  job_title?: string;
  jobTitle?: string;
  job_type?: string;
  jobType?: string;
  category?: string;
  organization_name?: string;
  organizationName?: string;
  status?: string;
  archived_at?: string | null;
  archivedAt?: string | null;
  record_number?: number | string | null;
  recordNumber?: number | string | null;
  custom_fields?: Record<string, any> | string | null;
};

function parseCustomFieldsObject(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, any>;
  return {};
}

async function getOrganizationValueFromJobCustomFields(job: any): Promise<string | null> {
  const customFields = parseCustomFieldsObject(job?.custom_fields);
  const jobsField2Label = await getCustomFieldLabel("jobs", "Field_2");
  if (jobsField2Label && customFields && typeof customFields === "object") {
    const value = customFields[jobsField2Label];
    if (value != null) {
      const asString = String(value).trim();
      if (asString) return asString;
    }
  }

  // Fallback for jobs where Field_2 is empty: still pass organization id in URL.
  const fallbackOrgId = job?.organization_id ?? job?.organizationId ?? job?.organization?.id;
  if (fallbackOrgId == null) return null;
  const fallback = String(fallbackOrgId).trim();
  return fallback || null;
}

export default function AddPlacementLanding() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Edit mode: id = placement id → fetch placement and redirect by placement_type
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const redirectForEdit = async () => {
      try {
        const res = await fetch(`/api/placements/${id}`);
        if (!res.ok) {
          router.replace(`/dashboard/placements/add/contract?id=${id}`);
          return;
        }
        const data = await res.json();
        const type = String(data?.placement?.placement_type || "").toLowerCase();
        let segment = "contract";
        if (type.includes("direct")) segment = "direct-hire";
        else if (type.includes("executive")) segment = "executive-search";
        router.replace(`/dashboard/placements/add/${segment}?id=${id}`);
      } catch {
        router.replace(`/dashboard/placements/add/contract?id=${id}`);
      }
    };
    redirectForEdit();
  }, [searchParams, router]);

  // Fetch jobs for job-first add flow (when no placement id)
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) return;
    const load = async () => {
      setJobsLoading(true);
      setSelectError(null);
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          setSelectError("Failed to load jobs.");
          return;
        }
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch {
        setSelectError("Failed to load jobs.");
      } finally {
        setJobsLoading(false);
      }
    };
    load();
  }, [searchParams]);

  // If jobId is already in the URL (coming from Jobs → Applied → Placement),
  // skip the job-selection screen and immediately redirect to the correct
  // placement type step, preserving jobSeekerId if present.
  useEffect(() => {
    const placementId = searchParams.get("id");
    const jobId = searchParams.get("jobId");
    if (placementId || !jobId) return;

    let cancelled = false;
    const run = async () => {
      setSelectError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (cancelled) return;
        if (!res.ok) {
          setSelectError("Could not load job details. Please try another job.");
          return;
        }
        const data = await res.json();
        const job = data.job;
        const jobType = job?.job_type ?? job?.jobType ?? "";
        if (!isKnownJobType(jobType) && jobType !== "") {
          setSelectError(
            "This job's type is not configured for placements. Please choose another job or contact your administrator."
          );
          return;
        }
        const segment = jobTypeToPlacementSegment(jobType);
        const jobSeekerId = searchParams.get("jobSeekerId");
        const organizationId = await getOrganizationValueFromJobCustomFields(job);
        const qs = new URLSearchParams();
        qs.set("jobId", String(jobId));
        if (organizationId) qs.set("organizationId", organizationId);
        if (jobSeekerId) qs.set("jobSeekerId", jobSeekerId);
        router.replace(`/dashboard/placements/add/${segment}?${qs.toString()}`);
      } catch {
        if (!cancelled) {
          setSelectError("Could not load job details. Please try again.");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  const jobOptions = useMemo((): StyledSelectOption[] => {
    const nonArchived = jobs.filter(
      (job) => (job.archived_at ?? job.archivedAt) == null
    );
    return nonArchived.map((job) => {
      const id = String(job.id);
      const recordNum = job.record_number ?? job.recordNumber ?? job.id;
      const title = job.job_title ?? job.jobTitle ?? "Untitled Job";
      const name = `${formatRecordId(recordNum, "job")} - ${title}`;
      const org = job.organization_name ?? job.organizationName ?? "";
      return { value: id, label: org ? `${name} (${org})` : name };
    });
  }, [jobs]);

  const handleJobSelect = async (jobId: string) => {
    if (!jobId) return;
    setSelectError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setSelectError("Could not load job details. Please try another job.");
        return;
      }
      const data = await res.json();
      const job = data.job;
      const jobType = job?.employment_type ?? job?.employmentType ?? job?.job_type ?? job?.jobType ?? "";
      if (!isKnownJobType(jobType) && jobType !== "") {
        setSelectError(
          "This job's type is not configured for placements. Please choose another job or contact your administrator."
        );
        return;
      }
      const segment = jobTypeToPlacementSegment(jobType);
      const jobSeekerId = searchParams.get("jobSeekerId");
      const organizationId = await getOrganizationValueFromJobCustomFields(job);
      const qs = new URLSearchParams();
      qs.set("jobId", jobId);
      if (organizationId) qs.set("organizationId", organizationId);
      if (jobSeekerId) qs.set("jobSeekerId", jobSeekerId);
      router.push(`/dashboard/placements/add/${segment}?${qs.toString()}`);
    } catch {
      setSelectError("Could not load job details. Please try again.");
    }
  };

  const handleContinue = () => {
    if (selectedJobId) handleJobSelect(selectedJobId);
  };

  const handleGoBack = () => {
    router.back();
  };

  // When in edit mode (id present), we redirect in useEffect; show minimal UI until redirect
  const placementId = searchParams.get("id");
  if (placementId) {
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
            <div className="flex items-center">
              <div className="bg-red-100 border border-red-300 p-2 mr-3">
                <Image src="/window.svg" alt="Placement" width={24} height={24} className="text-red-600" />
              </div>
              <h1 className="text-xl font-bold">Add Placement</h1>
            </div>
          </div>
          <p className="text-gray-600">Loading placement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
          <div className="flex items-center">
            <div className="bg-red-100 border border-red-300 p-2 mr-3">
              <Image src="/window.svg" alt="Placement" width={24} height={24} className="text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Add Placement</h1>
          </div>
          <button
            onClick={handleGoBack}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 font-medium">
            Select a job to add a placement. The placement type will be set automatically based on the job type.
          </p>
          {selectError && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {selectError}
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="w-48 font-medium shrink-0">Job:</label>
            <div className="flex-1">
              <StyledReactSelect
                value={jobOptions.find((opt) => opt.value === selectedJobId) || null}
                options={jobOptions}
                onChange={(opt) => setSelectedJobId((opt as StyledSelectOption)?.value || "")}
                placeholder="Search or select Job"
                isLoading={jobsLoading}
              />
            </div>
          </div>
          {jobs.length === 0 && !jobsLoading && (
            <p className="text-gray-500 text-sm">No jobs available. Create a job first to add a placement.</p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedJobId.trim()}
              onClick={handleContinue}
              className={`px-4 py-2 rounded text-white ${!selectedJobId.trim() ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
