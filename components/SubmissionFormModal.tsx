"use client";

import { useState, useEffect, useRef } from "react";
import { FiCheck, FiX, FiSearch } from "react-icons/fi";
import { formatRecordId } from "@/lib/recordIdFormatter";
import { toast } from "sonner";

export const SUBMISSION_STATUS_DEFAULT = "Submitted";
export const SUBMISSION_SOURCE_DEFAULT = "Recruiter";

const SUBMISSION_TEMPLATES = [
  { label: "Standard candidate summary", value: "Candidate has been pre-screened and is a strong fit for this role. Relevant experience and availability confirmed." },
  { label: "Technical role summary", value: "Technical pre-screen completed. Skills align with job requirements. Ready for client submission." },
  { label: "Senior/lead summary", value: "Senior candidate with leadership experience. Pre-screen positive. Notice period and salary expectations discussed." },
];

interface Job {
  id: number | string;
  job_title?: string;
  record_number?: number | string;
  organization_name?: string;
  status?: string;
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
  documents: Document[];
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
  documents,
  currentUserName,
  currentUserEmail,
  hasPrescreenNote = true,
  onSuccess,
}: SubmissionFormModalProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [status, setStatus] = useState(SUBMISSION_STATUS_DEFAULT);
  const [submissionSource, setSubmissionSource] = useState(SUBMISSION_SOURCE_DEFAULT);
  const [comments, setComments] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const templatesDropdownRef = useRef<HTMLDivElement>(null);

  const getToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  useEffect(() => {
    if (!open) return;
    setSelectedJobId("");
    setSelectedJob(null);
    setStatus(SUBMISSION_STATUS_DEFAULT);
    setSubmissionSource(SUBMISSION_SOURCE_DEFAULT);
    setComments("");
    setSelectedAttachmentIds(new Set(documents.map((d) => d.id)));
    setJobSearchQuery("");
    setValidationError(null);
    fetchJobs();
  }, [open, jobSeekerId]);

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.jobs ?? data.data ?? [];
        setJobsList(Array.isArray(list) ? list : []);
      } else {
        setJobsList([]);
      }
    } catch {
      setJobsList([]);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const filteredJobs = jobSearchQuery.trim()
    ? jobsList.filter((j) => {
        const q = jobSearchQuery.toLowerCase();
        const title = (j.job_title || "").toLowerCase();
        const rec = String(formatRecordId(j.record_number ?? j.id, "job")).toLowerCase();
        const id = String(j.id).toLowerCase();
        return title.includes(q) || rec.includes(q) || id.includes(q);
      })
    : jobsList;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) setShowJobDropdown(false);
      if (templatesDropdownRef.current && !templatesDropdownRef.current.contains(e.target as Node)) setShowTemplatesDropdown(false);
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

  const handleSubmit = async () => {
    setValidationError(null);
    if (!selectedJobId || !selectedJob) {
      setValidationError("Please select a job.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/job-seekers/${jobSeekerId}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          type: "client_submissions",
          job_id: Number(selectedJobId),
          status: status || SUBMISSION_STATUS_DEFAULT,
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
      toast.error(e instanceof Error ? e.message : "Failed to create submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const displayJob = selectedJob
    ? `${formatRecordId(selectedJob.record_number ?? selectedJob.id, "job")} ${selectedJob.job_title || ""}`.trim()
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <div className="flex flex-col max-h-[80vh] bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Submission Form</h2>
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
              <strong>Tip:</strong> Consider logging a Pre-Screen note first (Notes → Add Note → Action: Pre-Screen) to record candidate evaluation before submission.
            </div>
          )}

          {/* Added By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Added By</label>
            <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
              <span className="text-gray-900">{currentUserName || "—"}</span>
              <FiCheck className="text-green-600 shrink-0" size={18} />
            </div>
          </div>

          {/* Jobs (required) */}
          <div ref={jobDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jobs <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="flex border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                  type="text"
                  value={selectedJob ? displayJob : jobSearchQuery}
                  onChange={(e) => {
                    setJobSearchQuery(e.target.value);
                    if (selectedJob) {
                      setSelectedJob(null);
                      setSelectedJobId("");
                    }
                    setShowJobDropdown(true);
                  }}
                  onFocus={() => setShowJobDropdown(true)}
                  placeholder="Search or select job..."
                  className="flex-1 px-3 py-2 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowJobDropdown(!showJobDropdown)}
                  className="px-2 text-gray-500 hover:bg-gray-100 rounded-r"
                  aria-label="Search jobs"
                >
                  <FiSearch size={18} />
                </button>
                {selectedJob && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJob(null);
                      setSelectedJobId("");
                      setJobSearchQuery("");
                      setShowJobDropdown(true);
                    }}
                    className="px-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Clear job"
                  >
                    <FiX size={18} />
                  </button>
                )}
              </div>
              {showJobDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-56 overflow-y-auto">
                  {isLoadingJobs ? (
                    <div className="p-3 text-sm text-gray-500">Loading jobs...</div>
                  ) : filteredJobs.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No jobs found</div>
                  ) : (
                    filteredJobs.slice(0, 50).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedJob(job);
                          setSelectedJobId(String(job.id));
                          setJobSearchQuery("");
                          setShowJobDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">
                          {formatRecordId(job.record_number ?? job.id, "job")} {job.job_title || "Untitled"}
                        </span>
                        {job.organization_name && (
                          <span className="block text-xs text-gray-500">{job.organization_name}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Candidates (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidates</label>
            <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden />
              <span className="text-gray-900">
                {jobSeekerRecordId ? `${jobSeekerRecordId} ` : ""}{jobSeekerName || "—"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Source</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <div className="flex gap-2 mb-2" ref={templatesDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  SUBMISSION TEMPLATES
                  <span className={`inline-block transition ${showTemplatesDropdown ? "rotate-180" : ""}`}>▼</span>
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
              <label className="block text-sm font-medium text-gray-700">SELECT ATTACHMENTS</label>
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
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">No documents available</p>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700">Name</th>
                      <th className="text-left p-2 font-medium text-gray-700">Date Added</th>
                      <th className="text-left p-2 font-medium text-gray-700">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAttachmentIds.has(doc.id)}
                              onChange={() => toggleAttachment(doc.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{doc.document_name || doc.name || "Untitled"}</span>
                          </label>
                        </td>
                        <td className="p-2 text-gray-600">
                          {doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="p-2 text-gray-600">{doc.document_type || doc.type || "—"}</td>
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
