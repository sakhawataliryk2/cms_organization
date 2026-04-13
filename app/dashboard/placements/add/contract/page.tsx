"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useMultipleAdd } from "@/contexts/MultipleAddContext";
import CustomFieldRenderer, {
  useCustomFields,
  isCustomFieldValueValid,
} from "@/components/CustomFieldRenderer";
import JobSummaryCard from "../JobSummaryCard";
import Link from "next/link";
import { FiX, FiInfo } from "react-icons/fi";
import Tooltip from "@/components/Tooltip";
import { getCustomFieldLabel } from "@/lib/getCustomFieldLabel";

// Map admin field labels to placement backend columns (all fields driven by admin; no hardcoded standard fields)
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Job Seeker": "job_seeker_id",
  "Job Seeker ID": "job_seeker_id",
  "Candidate": "job_seeker_id",
  "Job": "job_id",
  "Job ID": "job_id",
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

const PLACEMENT_SEGMENT = "contract" as const;
/** Job type must include this to match this form. */
const EXPECTED_JOB_TYPE = "contract";

/** Normalize job type (admin-driven) to Employment Type: Executive-Search | Direct-Hire | Contract. Uses .includes() for flexible matching. */
function getEmploymentTypeFromJob(job: any): string | null {
  const fromJob =
    job?.job_type ??
    job?.jobType ??
    job?.employment_type ??
    job?.employmentType;
  let raw = String(fromJob ?? "").trim();
  if (!raw && job?.custom_fields) {
    const cf = typeof job.custom_fields === "string" ? tryParseJson(job.custom_fields) : job.custom_fields;
    if (cf && typeof cf === "object") {
      raw = String(
        cf["Job Type"] ?? cf["job_type"] ?? cf["Employment Type"] ?? cf["employment_type"] ?? ""
      ).trim();
    }
  }
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("executive-search") || lower.includes("executive search")) return "Executive-Search";
  if (lower.includes("direct-hire") || lower.includes("direct hire")) return "Direct-Hire";
  if (lower.includes("contract")) return "Contract";
  return null;
}
function tryParseJson(s: string): object | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Resolve value to set for employment type field: use admin option that matches normalized type (via .includes) or the normalized string. */
function resolveEmploymentTypeOptionValue(field: any, normalizedType: string): string {
  const opts = field?.options;
  const keysToTry: string[] = [
    normalizedType.toLowerCase().replace(/-/g, " "),
    normalizedType.toLowerCase().replace(/-/g, ""),
    normalizedType.toLowerCase(),
  ];
  if (normalizedType === "Direct-Hire") keysToTry.push("direct hire", "direct");
  else if (normalizedType === "Executive-Search") keysToTry.push("executive search", "executive");
  else if (normalizedType === "Contract") keysToTry.push("contract");
  const matchOption = (o: string) => keysToTry.some((k) => String(o).toLowerCase().includes(k));
  const isPlaceholder = (o: string) => {
    const s = String(o).toLowerCase().trim();
    return !s || s === "select an option" || s === "select" || s === "choose";
  };
  if (Array.isArray(opts)) {
    const found = opts.find((o: string) => {
      const v = String(o).trim();
      return v && !isPlaceholder(v) && matchOption(v);
    });
    if (found) return String(found).trim();
  }
  if (opts && typeof opts === "object" && !Array.isArray(opts)) {
    const entries = Object.entries(opts);
    const found = entries.find(([, v]) => {
      const s = String(v).trim();
      return s && !isPlaceholder(s) && matchOption(s);
    });
    if (found) return String(found[1]).trim();
  }
  return normalizedType;
}

/** Normalize label for comparison: lowercase, collapse spaces, normalize % and punctuation (same as Job add contract). */
function normalizeLabelForMatch(label: string | null | undefined): string {
  if (label == null) return "";
  return String(label)
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/[_\s]+/g, " ")
    .trim();
}

/** Find the custom field whose label best matches one of the candidate labels (exact > includes > word overlap). Same as Job add contract. */
function findFieldByLabelMatch<T extends { field_label?: string | null }>(
  fields: T[],
  ...candidateLabels: string[]
): T | null {
  if (!fields?.length || !candidateLabels.length) return null;
  const normalizedCandidates = candidateLabels.map(normalizeLabelForMatch).filter(Boolean);
  if (!normalizedCandidates.length) return null;

  let best: { field: T; score: number } | null = null;

  for (const field of fields) {
    const fieldNorm = normalizeLabelForMatch(field.field_label);
    if (!fieldNorm) continue;
    for (const cand of normalizedCandidates) {
      if (fieldNorm === cand) {
        return field; // exact match wins
      }
      let score = 0;
      if (fieldNorm.includes(cand) || cand.includes(fieldNorm)) score = 0.8;
      else {
        const fieldWords = new Set(fieldNorm.split(/\s+/).filter(Boolean));
        const candWords = cand.split(/\s+/).filter(Boolean);
        const overlap = candWords.filter((w) => fieldWords.has(w)).length;
        if (candWords.length) score = overlap / candWords.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { field, score };
      }
    }
  }
  return best?.field ?? null;
}

export default function AddPlacement() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const placementId = searchParams.get("id");
  const jobIdFromUrl = searchParams.get("jobId");
  const organizationIdFromUrl = searchParams.get("organizationId");
  const jobSeekerIdFromUrl = searchParams.get("jobSeekerId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!placementId);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!placementId);
  const hasFetchedRef = useRef(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [jobTypeMismatch, setJobTypeMismatch] = useState(false);
  const [jobFetchError, setJobFetchError] = useState<string | null>(null);
  const [placementField21Label, setPlacementField21Label] = useState<string | null>(null);
  const [placementField22Label, setPlacementField22Label] = useState<string | null>(null);

  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
    resetCustomFields,
  } = useCustomFields("placements", {
    applyAutoCurrentDefaults: !placementId,
  });

  const { isMultipleAddMode } = useMultipleAdd();

  const [jobSeekers, setJobSeekers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobSeekers, setIsLoadingJobSeekers] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  /** Job seeker's organization ID — used to filter Billing contacts / HM lookups to those under the job seeker's org */
  const [billingContactsOrganizationId, setBillingContactsOrganizationId] = useState<string | undefined>(undefined);
  /** Full job fetched when user selects job from dropdown (list may not include start_date/pay_rate) */
  const [fetchedJobForPrefill, setFetchedJobForPrefill] = useState<any>(null);

  const sortedCustomFields = useMemo(() => {
    return [...customFields]
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .filter((f: any) => f?.field_name !== "Field_21" && f?.field_name !== "Field_22")
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
  const statusField = fieldByColumn.status;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [field21Label, field22Label] = await Promise.all([
        getCustomFieldLabel("placements", "Field_21"),
        getCustomFieldLabel("placements", "Field_22"),
      ]);
      if (cancelled) return;
      setPlacementField21Label(field21Label);
      setPlacementField22Label(field22Label);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Employment type field: admin-driven label (prefer "Employment Type" / "Employee Type", else "Job Type")
  const employmentTypeField = useMemo(() => {
    const withEmployment = sortedCustomFields.find((f: any) => {
      const label = String(f.field_label || "").toLowerCase().replace(/\s+/g, " ").trim();
      return label.includes("employment") || label === "employee type";
    });
    if (withEmployment) return withEmployment;
    return sortedCustomFields.find((f: any) => {
      const label = String(f.field_label || "").toLowerCase().replace(/\s+/g, " ").trim();
      return label.includes("job") && label.includes("type");
    }) ?? null;
  }, [sortedCustomFields]);

  // Pay Rate, Mark-up %, and Client Bill Rate — same label resolution as Job add contract
  const payRateField = useMemo(
    () => findFieldByLabelMatch(customFields, "Pay Rate", "pay rate"),
    [customFields]
  );
  const markUpField = useMemo(
    () =>
      findFieldByLabelMatch(
        customFields,
        "Mark-up %",
        "Mark-up",
        "Mark up",
        "Mark up %",
        "mark up percent",
        "Markup %",
        "Markup"
      ),
    [customFields]
  );
  const clientBillRateField = useMemo(
    () =>
      findFieldByLabelMatch(
        customFields,
        "Client Bill Rate",
        "client bill rate"
      ),
    [customFields]
  );

  const startDateField = fieldByColumn.start_date ?? findFieldByLabelMatch(customFields, "Start Date", "start date");
  const effectiveDateField = useMemo(
    () => findFieldByLabelMatch(customFields, "Effective Date", "Effective date", "effective date"),
    [customFields]
  );

  /** Get start date from job as YYYY-MM-DD for date inputs. Checks top-level and custom_fields. */
  const getStartDateFromJob = useCallback((job: any): string => {
    let raw = job?.start_date ?? job?.startDate ?? "";
    if (!raw && job?.custom_fields) {
      const cf = typeof job.custom_fields === "string" ? tryParseJson(job.custom_fields) : job.custom_fields;
      if (cf && typeof cf === "object") {
        raw = (cf as any)["Start Date"] ?? (cf as any).start_date ?? (cf as any).startDate ?? (cf as any)["Start date"] ?? "";
      }
    }
    if (!raw) return "";
    const s = String(raw).trim();
    if (s.includes("T")) return s.split("T")[0];
    return s;
  }, []);

  /** Get pay rate from job (top-level or custom_fields). */
  const getPayRateFromJob = useCallback((job: any): string => {
    const fromTop = job?.pay_rate ?? job?.payRate;
    if (fromTop != null && String(fromTop).trim() !== "") return String(fromTop).trim();
    const cf = typeof job?.custom_fields === "string" ? tryParseJson(job.custom_fields) : job?.custom_fields;
    if (cf && typeof cf === "object") {
      const v = (cf as any)["Pay Rate"] ?? (cf as any).pay_rate ?? (cf as any).payRate ?? (cf as any)["Pay rate"];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }, []);

  // When redirected from job application status changed to "placed" (jobId + jobSeekerId in URL), default status to Pending
  useEffect(() => {
    if (!statusField || placementId) return;
    if (!jobIdFromUrl || !jobSeekerIdFromUrl) return;
    const current = customFieldValues[statusField.field_name] ?? "";
    if (String(current).trim() === "") {
      handleCustomFieldChange(statusField.field_name, "Pending");
    }
  }, [statusField, jobIdFromUrl, jobSeekerIdFromUrl, placementId, handleCustomFieldChange, customFieldValues[statusField?.field_name ?? ""]]);

  // Prefer admin-configured lookup field for Job Seekers when available
  const jobSeekerLookupField = useMemo(
    () =>
      sortedCustomFields.find(
        (f: any) =>
          f.field_type === "lookup" &&
          String((f as any).lookup_type || "")
            .trim()
            .toLowerCase() === "job-seekers"
      ),
    [sortedCustomFields]
  );

  // Fetch job by jobId when coming from job-first flow (validate type and prefill)
  useEffect(() => {
    if (!jobIdFromUrl || placementId) return;
    let cancelled = false;
    const run = async () => {
      setJobFetchError(null);
      setJobTypeMismatch(false);
      setSelectedJob(null);
      setIsLoading(true);
      try {
        const res = await fetch(`/api/jobs/${jobIdFromUrl}`);
        if (cancelled) return;
        if (!res.ok) {
          setJobFetchError("Could not load job details. Please try again or choose another job.");
          return;
        }
        const data = await res.json();
        const job = data.job;
        const jobType = String(job?.job_type ?? job?.jobType ?? "").toLowerCase();
        const matches = jobType.includes(EXPECTED_JOB_TYPE) || jobType === "";
        if (!matches) {
          setJobTypeMismatch(true);
          return;
        }
        setSelectedJob(job);
        // Set billing contacts filter from job immediately so Billing contacts dropdown is filtered from first render
        const jobOrgId = job?.organization_id ?? job?.organizationId ?? job?.organization?.id;
        if (jobOrgId != null) {
          setBillingContactsOrganizationId(String(jobOrgId));
        }
      } catch {
        if (!cancelled) setJobFetchError("Could not load job details. Please try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [jobIdFromUrl, placementId]);

  // Prefill Job (and org, employment type, start date, pay rate, effective date) when selectedJob is set from job-first flow
  useEffect(() => {
    if (!jobField || !selectedJob) return;
    const id = selectedJob.id ?? selectedJob.Id;
    if (id != null) {
      handleCustomFieldChange(jobField.field_name, String(id));
    }
    if (organizationField) {
      const orgId = selectedJob.organization_id ?? selectedJob.organizationId ?? selectedJob.organization?.id;
      if (orgId != null) {
        handleCustomFieldChange(organizationField.field_name, String(orgId));
      }
    }
    if (employmentTypeField) {
      const empType = getEmploymentTypeFromJob(selectedJob);
      if (empType) {
        const valueToSet = resolveEmploymentTypeOptionValue(employmentTypeField, empType);
        if (valueToSet) handleCustomFieldChange(employmentTypeField.field_name, valueToSet);
      }
    }
    const startDateVal = getStartDateFromJob(selectedJob);
    if (startDateField && startDateVal) {
      handleCustomFieldChange(startDateField.field_name, startDateVal);
      if (effectiveDateField) handleCustomFieldChange(effectiveDateField.field_name, startDateVal);
    }
    const payRateVal = getPayRateFromJob(selectedJob);
    if (payRateField && payRateVal) {
      handleCustomFieldChange(payRateField.field_name, payRateVal);
    }
    // getStartDateFromJob and getPayRateFromJob are stable (useCallback []); omit from deps to keep array length constant
  }, [selectedJob, jobField, organizationField, employmentTypeField, startDateField, effectiveDateField, payRateField, handleCustomFieldChange]);

  // Prefill Job Seeker when coming from Jobs → Applied → Placement flow
  useEffect(() => {
    if (!jobSeekerIdFromUrl || placementId) return;
    // Prefer admin-configured lookup field when available
    const targetFieldName =
      jobSeekerLookupField?.field_name || candidateField?.field_name;
    if (!targetFieldName) return;
    if (!jobSeekerIdFromUrl.trim()) return;
    handleCustomFieldChange(targetFieldName, jobSeekerIdFromUrl);
  }, [jobSeekerIdFromUrl, placementId, jobSeekerLookupField, candidateField, handleCustomFieldChange]);

  // Resolve organization for Billing contacts: job seeker's organization (or job's org as fallback)
  const effectiveJobSeekerId = (() => {
    if (jobSeekerIdFromUrl?.trim()) return jobSeekerIdFromUrl.trim();
    const fromLookup = jobSeekerLookupField && customFieldValues[jobSeekerLookupField.field_name];
    const s1 = fromLookup != null && String(fromLookup).trim() !== "" ? String(fromLookup).trim() : null;
    if (s1) return s1;
    const fromCandidate = candidateField && customFieldValues[candidateField.field_name];
    return (fromCandidate != null && String(fromCandidate).trim() !== "" ? String(fromCandidate).trim() : null) || null;
  })();

  useEffect(() => {
    if (!effectiveJobSeekerId) {
      // No job seeker selected: use job's organization so HM/contacts still filter by job org if any
      let jobOrgId = selectedJob?.organization_id ?? selectedJob?.organizationId ?? selectedJob?.organization?.id;
      if (jobOrgId == null && jobField && jobs.length > 0) {
        const formJobId = customFieldValues[jobField.field_name];
        const job = formJobId ? jobs.find((j: any) => String(j.id) === String(formJobId)) : null;
        jobOrgId = job?.organization_id ?? job?.organizationId ?? job?.organization?.id;
      }
      setBillingContactsOrganizationId(jobOrgId != null ? String(jobOrgId) : undefined);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/job-seekers/${effectiveJobSeekerId}`);
        if (cancelled) return;
        if (!res.ok) {
          const jobOrgId = selectedJob?.organization_id ?? selectedJob?.organizationId ?? selectedJob?.organization?.id;
          if (jobOrgId != null) setBillingContactsOrganizationId(String(jobOrgId));
          return;
        }
        const data = await res.json();
        const js = data.jobSeeker ?? data.job_seeker ?? data;
        const orgId = js?.organization_id ?? js?.organizationId ?? js?.organization?.id;
        if (cancelled) return;
        if (orgId != null) {
          setBillingContactsOrganizationId(String(orgId));
        } else {
          const jobOrgId = selectedJob?.organization_id ?? selectedJob?.organizationId ?? selectedJob?.organization?.id;
          if (jobOrgId != null) setBillingContactsOrganizationId(String(jobOrgId));
        }
      } catch {
        if (!cancelled) {
          const jobOrgId = selectedJob?.organization_id ?? selectedJob?.organizationId ?? selectedJob?.organization?.id;
          if (jobOrgId != null) setBillingContactsOrganizationId(String(jobOrgId));
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [effectiveJobSeekerId, selectedJob?.id, selectedJob?.organization_id, selectedJob?.organizationId, selectedJob?.organization?.id, jobField?.field_name, jobs, customFieldValues[jobField?.field_name ?? ""]]);

  // Fetch job seekers and jobs on mount (for Job/Candidate dropdown options)
  useEffect(() => {
    fetchJobSeekers();
    fetchJobs();
  }, []);

  // Auto-populate organization when job is selected and jobs are loaded
  useEffect(() => {
    if (!jobField || jobs.length === 0) return;
    const selectedJobId = customFieldValues[jobField.field_name];
    const job = selectedJobId ? jobs.find((j: any) => String(j.id) === String(selectedJobId)) : null;
    if (!job) return;
    if (organizationField && (!customFieldValues[organizationField.field_name] || customFieldValues[organizationField.field_name] === "")) {
      const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
      if (orgId != null) {
        handleCustomFieldChange(organizationField.field_name, String(orgId));
      }
    }
    if (employmentTypeField) {
      const empType = getEmploymentTypeFromJob(job);
      if (empType) {
        const valueToSet = resolveEmploymentTypeOptionValue(employmentTypeField, empType);
        if (valueToSet) handleCustomFieldChange(employmentTypeField.field_name, valueToSet);
      }
    }
    const startDateVal = getStartDateFromJob(job);
    if (startDateField && startDateVal) {
      handleCustomFieldChange(startDateField.field_name, startDateVal);
      if (effectiveDateField) handleCustomFieldChange(effectiveDateField.field_name, startDateVal);
    }
    const payRateVal = getPayRateFromJob(job);
    if (payRateField && payRateVal) {
      handleCustomFieldChange(payRateField.field_name, payRateVal);
    }
    // getStartDateFromJob and getPayRateFromJob are stable (useCallback []); omit from deps to keep array length constant
  }, [jobs, customFieldValues, jobField, organizationField, employmentTypeField, startDateField, effectiveDateField, payRateField, handleCustomFieldChange]);

  // When user selects a job from the dropdown, fetch full job so we have start_date, pay_rate (list may omit them)
  const formJobId = jobField ? customFieldValues[jobField.field_name] : null;
  useEffect(() => {
    if (!formJobId || String(formJobId).trim() === "") {
      setFetchedJobForPrefill(null);
      return;
    }
    if (selectedJob && String(selectedJob.id ?? selectedJob.Id) === String(formJobId)) {
      setFetchedJobForPrefill(selectedJob);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/jobs/${formJobId}`);
        if (cancelled) return;
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;
        if (cancelled) return;
        setFetchedJobForPrefill(job || null);
      } catch {
        if (!cancelled) setFetchedJobForPrefill(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [formJobId, selectedJob?.id, selectedJob?.Id]);

  // Current job for prefilling: from URL (selectedJob) or from dropdown (fetchedJobForPrefill or list)
  const currentJobForPrefill = selectedJob ?? fetchedJobForPrefill ?? (jobField && formJobId && jobs.length > 0 ? jobs.find((j: any) => String(j.id) === String(formJobId)) : null);

  // Dedicated effect: set employment type whenever we have a current job and the field exists.
  useEffect(() => {
    if (!employmentTypeField || !currentJobForPrefill) return;
    const empType = getEmploymentTypeFromJob(currentJobForPrefill);
    if (!empType) return;
    const valueToSet = resolveEmploymentTypeOptionValue(employmentTypeField, empType);
    if (valueToSet) handleCustomFieldChange(employmentTypeField.field_name, valueToSet);
  }, [employmentTypeField, currentJobForPrefill, handleCustomFieldChange]);

  // Dedicated effect: set start date, pay rate, effective date from job when fields exist (runs when fields load or job becomes available)
  useEffect(() => {
    if (!currentJobForPrefill) return;
    const startDateVal = getStartDateFromJob(currentJobForPrefill);
    if (startDateField && startDateVal) {
      handleCustomFieldChange(startDateField.field_name, startDateVal);
      if (effectiveDateField) handleCustomFieldChange(effectiveDateField.field_name, startDateVal);
    }
    const payRateVal = getPayRateFromJob(currentJobForPrefill);
    if (payRateField && payRateVal) {
      handleCustomFieldChange(payRateField.field_name, payRateVal);
    }
  }, [currentJobForPrefill, startDateField, effectiveDateField, payRateField, handleCustomFieldChange]);

  // Compute Client Bill Rate from Pay Rate × (1 + Mark-up % / 100) — same as Job add contract
  useEffect(() => {
    if (!clientBillRateField || !payRateField || !markUpField) return;
    const payRaw = customFieldValues[payRateField.field_name];
    const markUpRaw = customFieldValues[markUpField.field_name];
    const payNum = parseFloat(String(payRaw ?? "").trim());
    const markUpNum = parseFloat(String(markUpRaw ?? "").replace(/%/g, "").trim());
    if (Number.isNaN(payNum) || Number.isNaN(markUpNum)) {
      return;
    }
    const computed = payNum * (1 + markUpNum / 100);
    const formatted =
      computed % 1 === 0
        ? String(Math.round(computed))
        : computed.toFixed(2);
    const current = customFieldValues[clientBillRateField.field_name];
    if (current === formatted) return;
    setCustomFieldValues((prev: Record<string, any>) => ({
      ...prev,
      [clientBillRateField.field_name]: formatted,
    }));
  }, [
    clientBillRateField,
    payRateField,
    markUpField,
    customFieldValues[payRateField?.field_name ?? ""],
    customFieldValues[markUpField?.field_name ?? ""],
    setCustomFieldValues,
  ]);

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
      if (field && BACKEND_COLUMN_BY_LABEL[field.field_label] === "job_id") {
        const job = jobs.find((j: any) => String(j.id) === String(value));
        if (job) {
          if (organizationField) {
            const orgId = job.organization_id ?? job.organizationId ?? job.organization?.id;
            if (orgId != null) {
              handleCustomFieldChange(organizationField.field_name, String(orgId));
            }
          }
          if (employmentTypeField) {
            const empType = getEmploymentTypeFromJob(job);
            if (empType) {
              const valueToSet = resolveEmploymentTypeOptionValue(employmentTypeField, empType);
              if (valueToSet) handleCustomFieldChange(employmentTypeField.field_name, valueToSet);
            }
          }
          const startDateVal = getStartDateFromJob(job);
          if (startDateField && startDateVal) {
            handleCustomFieldChange(startDateField.field_name, startDateVal);
            if (effectiveDateField) handleCustomFieldChange(effectiveDateField.field_name, startDateVal);
          }
          const payRateVal = getPayRateFromJob(job);
          if (payRateField && payRateVal) {
            handleCustomFieldChange(payRateField.field_name, payRateVal);
          }
        }
      }
      if (startDateField && effectiveDateField && fieldName === startDateField.field_name && value != null && String(value).trim() !== "") {
        handleCustomFieldChange(effectiveDateField.field_name, String(value).trim());
      }
    },
    [handleCustomFieldChange, sortedCustomFields, organizationField, employmentTypeField, startDateField, effectiveDateField, payRateField, jobs]
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
        // Prefer exact values from placement.custom_fields (source of truth for admin fields),
        // and only fall back to mapped top-level columns when custom_fields value is missing.
        sortedCustomFields.forEach((field: any) => {
          const label = field.field_label || field.field_name;
          if (existingCustomFields[label] != null) {
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

        // Set billing contacts org when editing so Billing contact dropdown filters by org from first paint
        const placementOrgId = placement.organization_id ?? placement.organizationId ?? placement.organization?.id;
        if (placementOrgId != null) {
          setBillingContactsOrganizationId(String(placementOrgId));
        } else if (placement.job_id && jobs.length > 0) {
          const job = jobs.find((j: any) => String(j.id) === String(placement.job_id));
          const jobOrgId = job?.organization_id ?? job?.organizationId ?? job?.organization?.id;
          if (jobOrgId != null) setBillingContactsOrganizationId(String(jobOrgId));
        } else if (placement.job_seeker_id) {
          try {
            const jsRes = await fetch(`/api/job-seekers/${placement.job_seeker_id}`);
            if (jsRes.ok) {
              const jsData = await jsRes.json();
              const js = jsData.jobSeeker ?? jsData.job_seeker ?? jsData;
              const orgId = js?.organization_id ?? js?.organizationId ?? js?.organization?.id;
              if (orgId != null) setBillingContactsOrganizationId(String(orgId));
            }
          } catch (_) { /* ignore */ }
        }
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
        placement_type: "Contract"
      };
      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit). Same as organizations/tasks.
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          if (column === "job_seeker_id" || column === "job_id" || column === "organization_id") {
            const str = String(value).trim();
            if (str === "") {
              apiData[column] = null;
            } else {
              const n = Number(str);
              apiData[column] = !isNaN(n) ? n : null;
            }
          } else {
            apiData[column] = value;
          }
        }
        customFieldsForDB[label] = value;
      });

      // Ensure job_id is always set from either:
      // - The Job field in admin mapping (label -> job_id), OR
      // - The selected job from job-first flow (jobIdFromUrl / selectedJob)
      if (apiData.job_id == null) {
        let finalJobId: number | null = null;

        // Try Job custom field (if present)
        if (jobField) {
          const jobLabel = jobField.field_label;
          const raw = customFieldsToSend[jobLabel];
          if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
            const n = Number(raw);
            if (!isNaN(n) && n > 0) {
              finalJobId = n;
            }
          }
        }

        // Fallback to selected job / URL param
        if (finalJobId == null) {
          const source = selectedJob?.id ?? (selectedJob as any)?.Id ?? jobIdFromUrl;
          if (source != null) {
            const n = Number(source);
            if (!isNaN(n) && n > 0) {
              finalJobId = n;
            }
          }
        }

        if (finalJobId != null) {
          apiData.job_id = finalJobId;
        }
      }

      if (apiData.job_id == null && jobIdFromUrl?.trim()) {
        const n = Number(jobIdFromUrl.trim());
        apiData.job_id = !Number.isNaN(n) && n > 0 ? n : null;
      }

      // When admin has configured a Job Seeker lookup field, treat it as the source of truth
      // for job_seeker_id regardless of its label.
      if (jobSeekerLookupField) {
        const rawJs = customFieldValues[jobSeekerLookupField.field_name];
        const jsStr = String(rawJs ?? "").trim();
        if (jsStr === "") {
          apiData.job_seeker_id = null;
        } else {
          const n = Number(jsStr);
          apiData.job_seeker_id = !isNaN(n) ? n : null;
        }
      }

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

      if ((apiData.organization_id === undefined || apiData.organization_id === null) && organizationIdFromUrl?.trim()) {
        const orgIdNum = Number(organizationIdFromUrl.trim());
        apiData.organization_id = !Number.isNaN(orgIdNum) ? orgIdNum : null;
      }

      if (placementField21Label && jobIdFromUrl?.trim()) {
        customFieldsForDB[placementField21Label] = jobIdFromUrl.trim();
      }
      if (placementField22Label && organizationIdFromUrl?.trim()) {
        customFieldsForDB[placementField22Label] = organizationIdFromUrl.trim();
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

      if (isMultipleAddMode && !isEditMode) {
        resetCustomFields();
        window.scrollTo(0, 0);
      } else {
        const id = isEditMode ? placementId : data.placement?.id;
        router.push(`/dashboard/placements/view?id=${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => router.back();

  const validationStatus = useMemo(() => {
    const v = validateCustomFields();
    return { isValid: v.isValid, message: v.message };
  }, [validateCustomFields]);

  const canSubmit = validationStatus.isValid;

  if (isLoading && (placementId || (jobIdFromUrl && !selectedJob && !jobTypeMismatch && !jobFetchError))) {
    return <LoadingScreen message={placementId ? "Loading placement data..." : "Loading job details..."} />;
  }

  if (jobTypeMismatch) {
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="border-b pb-4 mb-6 flex justify-between items-center">
            <h1 className="text-xl font-bold">Add Placement Contract</h1>
            <button onClick={handleGoBack} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">X</button>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-4">
            <p className="font-medium">This job&apos;s type doesn&apos;t match a Contract placement.</p>
            <p className="text-sm mt-1">Please choose another job or contact your administrator to update the job type.</p>
          </div>
          <Link href="/dashboard/placements/add" className="inline-flex items-center gap-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Back to Job Selection
          </Link>
        </div>
      </div>
    );
  }

  if (jobFetchError && jobIdFromUrl && !selectedJob) {
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="border-b pb-4 mb-6 flex justify-between items-center">
            <h1 className="text-xl font-bold">Add Placement Contract</h1>
            <button onClick={handleGoBack} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">X</button>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 mb-4">{jobFetchError}</div>
          <Link href="/dashboard/placements/add" className="inline-flex items-center gap-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Back to Job Selection
          </Link>
        </div>
      </div>
    );
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
        <div className="flex justify-between items-center border-b pb-4 mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Image src="/window.svg" alt="Placement" width={24} height={24} className="mr-2" />
            <h1 className="text-xl font-bold">{isEditMode ? "Edit" : "Add"} Placement Contract</h1>
          </div>
          <div className="flex items-center gap-4 gap-6">
            {jobIdFromUrl && !isEditMode && (
              <Link
                href="/dashboard/placements/add"
                className="inline-flex items-center gap-4 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Job Selection
              </Link>
            )}
            <button onClick={handleGoBack} className="text-gray-500 hover:text-gray-700">
              <span className="text-2xl font-bold"><FiX size={20} /></span>
            </button>
          </div>
        </div>

        {selectedJob && !isEditMode && (
          <div className="mb-4">
            <JobSummaryCard job={selectedJob} />
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Explicit Job Seeker selector so a real candidate is always chosen.
              Use this only when admin has NOT provided a Job Seeker lookup field. */}
          {!jobSeekerLookupField && candidateField && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Seeker
                {candidateField.is_required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={customFieldValues[candidateField.field_name] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handlePlacementFieldChange(
                    candidateField.field_name,
                    val === "" ? "" : val
                  );
                }}
              >
                <option value="">
                  {isLoadingJobSeekers ? "Loading job seekers..." : "Select Job Seeker"}
                </option>
                {jobSeekers.map((js: any) => {
                  const id = js.id ?? js.Id;
                  const fullName =
                    js.full_name ||
                    `${js.first_name || js.firstName || ""} ${js.last_name || js.lastName || ""}`.trim() ||
                    js.email ||
                    `Job Seeker #${id}`;
                  return (
                    <option key={id} value={id}>
                      {fullName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {customFieldsLoading ? (
              <div className="text-center py-4 text-gray-500">Loading custom fields...</div>
            ) : (
              sortedCustomFields.map((field: any) => {
                // const column = BACKEND_COLUMN_BY_LABEL[field.field_label];
                const fieldValue = customFieldValues[field.field_name] ?? field.default_value ?? "";

                // Hide Full Address field (combined display only; address is shown via Address group above)
                const labelNorm = (field.field_label ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
                const isFullAddressField =
                  labelNorm.includes("full") && labelNorm.includes("address");
                if (isFullAddressField) return null;

                const billingLabel = String((field.field_label ?? (field as any).label ?? field.field_name ?? "")).trim().toLowerCase();
                const isBillingContactLookup =
                  billingLabel.includes("billing") &&
                  field.field_type === "lookup" &&
                  ((field as any).lookup_type === "hiring-managers" || (field as any).lookup_type === "contacts");
                const isStatusReadOnlyFromRedirect = Boolean(
                  statusField && field.field_name === statusField.field_name && jobIdFromUrl && jobSeekerIdFromUrl && !placementId
                );
                const isClientBillRateField = clientBillRateField && field.id === clientBillRateField.id;
                const isClientBillRateEditable = isClientBillRateField && !field.is_read_only;
                const handlePlacementChangeWithBillRateClear = (name: string, value: any) => {
                  handlePlacementFieldChange(name, value);
                  if (
                    isClientBillRateField &&
                    name === clientBillRateField!.field_name &&
                    payRateField &&
                    markUpField
                  ) {
                    setCustomFieldValues((prev: Record<string, any>) => ({
                      ...prev,
                      [payRateField.field_name]: "",
                      [markUpField.field_name]: "",
                    }));
                  }
                };
                return (
                  <div
                    key={
                      isBillingContactLookup
                        ? `${field.id}-org-${billingContactsOrganizationId ?? "none"}`
                        : field.id
                    }
                    className="flex items-center gap-4"
                  >
                    <label className="w-48 font-medium shrink-0 flex items-center">
                      {field.field_label}
                      {isClientBillRateEditable && (
                        <Tooltip
                          text="Changing this value will clear Pay Rate and Mark-up %."
                          className="ml-2"
                        >
                          <FiInfo className="w-5 h-5 text-gray-600 shrink-0" aria-hidden />
                        </Tooltip>
                      )}
                    </label>
                    <div className="flex-1">
                      <CustomFieldRenderer
                        field={field}
                        value={fieldValue}
                        allFields={customFields}
                        values={customFieldValues}
                        onChange={isClientBillRateField ? handlePlacementChangeWithBillRateClear : handlePlacementFieldChange}
                        context={
                          billingContactsOrganizationId
                            ? { organizationIdOnlyForBillingContacts: billingContactsOrganizationId }
                            : undefined
                        }
                        forceReadOnly={isStatusReadOnlyFromRedirect}
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
              })
            )}
          </div>

          <div className="h-20" aria-hidden="true" />
          <div className="sticky bottom-0 left-0 right-0 z-10 -mx-4 -mb-4 px-4 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] flex justify-end items-center space-x-4">
            {process.env.NODE_ENV === "development" && !canSubmit && (
              <div className="text-red-500">
                Debug:
                <span>{validationStatus.message || "Missing required fields"}</span>
              </div>
            )}
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
