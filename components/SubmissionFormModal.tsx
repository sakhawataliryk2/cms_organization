"use client";

import { useState, useEffect, useRef } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { formatRecordId } from "@/lib/recordIdFormatter";
import { toast } from "sonner";
import StyledReactSelect, { type StyledSelectOption } from "@/components/StyledReactSelect";

export const SUBMISSION_STATUS_DEFAULT = "Submitted";
export const SUBMISSION_SOURCE_DEFAULT = "Recruiter";

const SUBMISSION_TEMPLATES = [
  {
    label: "Standard candidate summary",
    value:
      "Candidate has been pre-screened and is a strong fit for this role. Relevant experience and availability confirmed.",
  },
  {
    label: "Technical role summary",
    value:
      "Technical pre-screen completed. Skills align with job requirements. Ready for client submission.",
  },
  {
    label: "Senior/lead summary",
    value:
      "Senior candidate with leadership experience. Pre-screen positive. Notice period and salary expectations discussed.",
  },
];

interface Job {
  id: number | string;
  job_title?: string;
  record_number?: number | string;
  organization_name?: string;
  status?: string;
  archived_at?: string | null;
}

interface Document {
  id: string;
  document_name?: string;
  name?: string;
  document_type?: string;
  type?: string;
  created_at?: string;
  created_by_name?: string;
}

interface SubmissionFormModalProps {
  open: boolean;
  onClose: () => void;
  jobSeekerId: string;
  jobSeekerName: string;
  jobSeekerRecordId?: string;
  /** Optionally seed documents; the modal will always re-fetch from the API on open. */
  documents?: Document[];
  currentUserName: string;
  currentUserEmail?: string;
  hasPrescreenNote?: boolean;
  onSuccess: () => void;
}

export default function SubmissionFormModal({
  open,
  onClose,
  jobSeekerId,
  jobSeekerName,
  jobSeekerRecordId,
  documents: documentsProp = [],
  currentUserName,
  currentUserEmail,
  hasPrescreenNote = true,
  onSuccess,
}: SubmissionFormModalProps) {
  const [fetchedDocuments, setFetchedDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // Use API-fetched docs when available, otherwise fall back to the prop
  const documents = fetchedDocuments.length > 0 ? fetchedDocuments : documentsProp;
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [status, setStatus] = useState(SUBMISSION_STATUS_DEFAULT);
  const [submissionSource, setSubmissionSource] = useState(
    SUBMISSION_SOURCE_DEFAULT,
  );
  const [comments, setComments] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<
    Set<string>
  >(new Set());
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingSubmittedJobs, setIsLoadingSubmittedJobs] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const templatesDropdownRef = useRef<HTMLDivElement>(null);

  const getToken = () =>
    document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      "$1",
    );

  const fetchDocumentsForCandidate = async (candidateId: string) => {
    if (!candidateId) return;
    setIsLoadingDocuments(true);
    try {
      const res = await fetch(`/api/job-seekers/${candidateId}/documents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load documents");
      const docs: Document[] = Array.isArray(data.documents)
        ? data.documents
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      setFetchedDocuments(docs);
      // Auto-select all fetched documents
      setSelectedAttachmentIds(new Set(docs.map((d) => d.id)));
    } catch (e) {
      console.error("Error loading job seeker documents", e);
      // Fall back to the prop-supplied documents
      setFetchedDocuments([]);
      setSelectedAttachmentIds(new Set(documentsProp.map((d) => d.id)));
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedJobId("");
    setSelectedJob(null);
    setStatus(SUBMISSION_STATUS_DEFAULT);
    setSubmissionSource(SUBMISSION_SOURCE_DEFAULT);
    setComments("");
    setFetchedDocuments([]);
    setSelectedAttachmentIds(new Set(documentsProp.map((d) => d.id)));
    setValidationError(null);
    setSubmittedJobIds(new Set());
    void fetchJobs();
    void fetchSubmittedJobsForJobSeeker();
    void fetchDocumentsForCandidate(jobSeekerId);
  }, [open, jobSeekerId]);

  const fetchSubmittedJobsForJobSeeker = async () => {
    if (!jobSeekerId) return;
    setIsLoadingSubmittedJobs(true);
    try {
      const res = await fetch(`/api/job-seekers/${jobSeekerId}/applications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmittedJobIds(new Set());
        return;
      }
      const applications: any[] =
        data.applications || data.data || data.items || [];
      const ids = new Set<string>();
      if (Array.isArray(applications)) {
        applications.forEach((a: any) => {
          if (a?.job_id != null && String(a.job_id).trim() !== "") {
            ids.add(String(a.job_id));
          }
        });
      }
      setSubmittedJobIds(ids);
    } catch {
      setSubmittedJobIds(new Set());
    } finally {
      setIsLoadingSubmittedJobs(false);
    }
  };

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.jobs ?? data.data ?? [];
        const all = Array.isArray(list) ? list : [];
        // Only show non-archived jobs for submission
        const nonArchived = all.filter(
          (j: Job) => j.archived_at == null || j.archived_at === "",
        );
        setJobsList(nonArchived);
      } else {
        setJobsList([]);
      }
    } catch {
      setJobsList([]);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        templatesDropdownRef.current &&
        !templatesDropdownRef.current.contains(e.target as Node)
      )
        setShowTemplatesDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAttachment = (id: string) => {
    setSelectedAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAttachments = () => {
    setSelectedAttachmentIds(new Set(documents.map((d) => d.id)));
  };

  const selectNoneAttachments = () => {
    setSelectedAttachmentIds(new Set());
  };

  const applyTemplate = (text: string) => {
    setComments((c) => (c ? c + "\n\n" + text : text));
    setShowTemplatesDropdown(false);
  };

  const jobOptions: StyledSelectOption[] = jobsList.map((job) => {
    const isDisabled = submittedJobIds.has(String(job.id));
    const recordLabel = formatRecordId(job.record_number ?? job.id, "job");
    const jobTitle = job.job_title || "Untitled";
    return {
      label: isDisabled
        ? `${recordLabel} ${jobTitle} (Already submitted)`
        : `${recordLabel} ${jobTitle}`,
      value: String(job.id),
      isDisabled,
    };
  });

  const handleSubmit = async () => {
    setValidationError(null);
    if (!selectedJobId || !selectedJob) {
      setValidationError("Please select a job.");
      return;
    }
    if (submittedJobIds.has(String(selectedJobId))) {
      setValidationError(
        "This job seeker has already been submitted to this job. Duplicate submissions are not allowed.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const effectiveStatus = status || SUBMISSION_STATUS_DEFAULT;
      const isClientSubmissionStatus =
        effectiveStatus.trim().toLowerCase() === "client submission";

      // From Prescreen and Job Seeker view, creations should go through the unified
      // applications endpoint. Use type "submissions" by default and promote to
      // "client_submissions" only when the status is explicitly "Client Submission".
      const res = await fetch(`/api/job-seekers/${jobSeekerId}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          type: isClientSubmissionStatus ? "client_submissions" : "submissions",
          job_id: Number(selectedJobId),
          status: effectiveStatus,
          submission_source: submissionSource || SUBMISSION_SOURCE_DEFAULT,
          comments: comments || undefined,
          attachment_ids: Array.from(selectedAttachmentIds),
          submitted_by_name: currentUserName || undefined,
          submitted_by_email: currentUserEmail || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to create submission");
      }
      toast.success("Submission created successfully.");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to create submission",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <div className="flex flex-col max-h-[80vh] bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            Submission Form
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <FiX size={22} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto min-h-0 flex-1">
          {!hasPrescreenNote && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              <strong>Tip:</strong> Consider logging a Pre-Screen note first
              (Notes → Add Note → Action: Pre-Screen) to record candidate
              evaluation before submission.
            </div>
          )}

          {/* Added By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Added By
            </label>
            <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
              <span className="text-gray-900">{currentUserName || "—"}</span>
              <FiCheck className="text-green-600 shrink-0" size={18} />
            </div>
          </div>

          {/* Jobs (required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jobs{" "}
              {selectedJob ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-red-500">*</span>
              )}
            </label>
            <div className="relative">
              {isLoadingJobs ? (
                <div className="p-3 text-sm text-gray-500 border border-gray-300 rounded">
                  Loading jobs...
                </div>
              ) : isLoadingSubmittedJobs ? (
                <div className="p-3 text-sm text-gray-500 border border-gray-300 rounded">
                  Checking previously submitted jobs...
                </div>
              ) : jobOptions.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 border border-gray-300 rounded">
                  No jobs found
                </div>
              ) : (
                <StyledReactSelect
                  options={jobOptions}
                  value={
                    jobOptions.find((option) => option.value === selectedJobId) ??
                    null
                  }
                  isSearchable
                  isClearable
                  isOptionDisabled={(option) => option.isDisabled ?? false}
                  placeholder="Search or select job..."
                  noOptionsMessage={() => "No jobs found"}
                  onChange={(option) => {
                    if (!option) {
                      setSelectedJob(null);
                      setSelectedJobId("");
                      return;
                    }
                    const selected = jobsList.find(
                      (j) => String(j.id) === String(option.value),
                    );
                    if (!selected) {
                      setSelectedJob(null);
                      setSelectedJobId("");
                      return;
                    }
                    if (submittedJobIds.has(String(selected.id))) {
                      toast.error(
                        "This job seeker has already been submitted to this job. Duplicate submissions are not allowed.",
                      );
                      return;
                    }
                    setSelectedJob(selected);
                    setSelectedJobId(String(selected.id));
                  }}
                />
              )}
            </div>
          </div>

          {/* Candidates (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidates
            </label>
            <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
              <span
                className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0"
                aria-hidden
              />
              <span className="text-gray-900">
                {jobSeekerRecordId ? `${jobSeekerRecordId} ` : ""}
                {jobSeekerName || "—"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Submitted">Submitted</option>
                <option value="Client Submission">Client Submission</option>
                <option value="Interview">Interview</option>
                <option value="Client Rejected">Client Rejected</option>
                <option value="Candidate Withdrew">Candidate Withdrew</option>
                <option value="Placed">Placed</option>
              </select>
              <FiCheck className="text-green-600 shrink-0" size={18} />
            </div>
          </div>

          {/* Submission Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Submission Source
            </label>
            <select
              value={submissionSource}
              onChange={(e) => setSubmissionSource(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Recruiter">Recruiter</option>
              <option value="Web">Web</option>
              <option value="API">API</option>
              <option value="Referral">Referral</option>
            </select>
          </div>

          {/* Comments + Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments
            </label>
            <div className="flex gap-2 mb-2" ref={templatesDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowTemplatesDropdown(!showTemplatesDropdown)
                  }
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  SUBMISSION TEMPLATES
                  <span
                    className={`inline-block transition ${showTemplatesDropdown ? "rotate-180" : ""}`}
                  >
                    ▼
                  </span>
                </button>
                {showTemplatesDropdown && (
                  <div className="absolute z-10 mt-1 left-0 min-w-[220px] bg-white border border-gray-300 rounded shadow-lg py-1">
                    {SUBMISSION_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => applyTemplate(t.value)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Write candidate summary..."
              rows={6}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Select Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                SELECT ATTACHMENTS
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAttachments}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={selectNoneAttachments}
                  className="text-xs text-gray-600 hover:underline"
                >
                  Select none
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2">{jobSeekerName}</p>
            {isLoadingDocuments ? (
              <p className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
                Loading documents...
              </p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
                No documents available
              </p>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700">
                        Name
                      </th>
                      <th className="text-left p-2 font-medium text-gray-700">
                        Date Added
                      </th>
                      <th className="text-left p-2 font-medium text-gray-700">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="p-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAttachmentIds.has(doc.id)}
                              onChange={() => toggleAttachment(doc.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              {doc.document_name || doc.name || "Untitled"}
                            </span>
                          </label>
                        </td>
                        <td className="p-2 text-gray-600">
                          {doc.created_at
                            ? new Date(doc.created_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="p-2 text-gray-600">
                          {doc.document_type || doc.type || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {validationError && (
            <p className="text-sm text-red-600">{validationError}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-white rounded-b-lg shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !selectedJobId}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
