"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiSearch, FiX } from "react-icons/fi";
import { formatRecordId } from "@/lib/recordIdFormatter";
import { toast } from "sonner";

interface ClientSubmissionModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string | number | null;
  job: any | null;
  jobHiringManager?: any | null;
  /**
   * Candidates that have some relationship with this job.
   * Expected shape (minimum):
   * { id, name, email, rawJobSeeker? }
   */
  candidates: any[];
  /**
   * Optional candidate to pre-select when opening the modal
   * (e.g. when invoked from the status dropdown row).
   */
  initialCandidate?: any | null;
  currentUserName: string;
  currentUserEmail?: string;
  /**
   * Invoked after a successful submission so the parent
   * can refresh applications / client submissions.
   */
  onSuccess: () => void;
}

interface JobSeekerDocument {
  id: string;
  document_name?: string;
  name?: string;
  document_type?: string;
  type?: string;
  created_at?: string;
  created_by_name?: string;
  distribution?: string;
}

interface HiringManager {
  id: string | number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  organization_name?: string;
}

interface InternalUser {
  id: string | number;
  name?: string;
  email?: string;
}

const DEFAULT_DISTRIBUTION = "general";

function getCandidateName(candidate: any | null | undefined) {
  if (!candidate) return "";
  return (
    candidate.name ||
    candidate.full_name ||
    `${(candidate.first_name || "").trim()} ${(candidate.last_name || "").trim()}`.trim() ||
    `Job Seeker #${candidate.id}`
  );
}

function extractPlainText(html: string): string {
  if (typeof window === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export default function ClientSubmissionModal({
  open,
  onClose,
  jobId,
  job,
  jobHiringManager,
  candidates,
  initialCandidate,
  currentUserName,
  currentUserEmail,
  onSuccess,
}: ClientSubmissionModalProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const candidateInputRef = useRef<HTMLDivElement | null>(null);

  const [documents, setDocuments] = useState<JobSeekerDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [documentDistribution, setDocumentDistribution] = useState<Record<string, string>>({});

  const [hiringManagers, setHiringManagers] = useState<HiringManager[]>([]);
  const [isLoadingHiringManagers, setIsLoadingHiringManagers] = useState(false);
  const [selectedHiringManagerIds, setSelectedHiringManagerIds] = useState<Set<string>>(new Set());
  const [hiringManagerSearch, setHiringManagerSearch] = useState("");

  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [isLoadingInternalUsers, setIsLoadingInternalUsers] = useState(false);
  const [selectedInternalUserIds, setSelectedInternalUserIds] = useState<Set<string>>(new Set());

  const [commentHtml, setCommentHtml] = useState("");
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayJob = useMemo(() => {
    if (!job && !jobId) return "—";
    const id = job?.id ?? jobId;
    const recordNumber = job?.record_number ?? id;
    const title = job?.job_title || job?.jobTitle || "";
    const prefix = recordNumber ? formatRecordId(recordNumber, "job") : `Job #${id}`;
    return `${prefix} ${title}`.trim();
  }, [job, jobId]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => String(c.id) === String(selectedCandidateId)) ?? null,
    [candidates, selectedCandidateId]
  );

  const filteredCandidates = useMemo(() => {
    const query = candidateSearchQuery.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((c) => {
      const name = getCandidateName(c).toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const id = String(c.id || "").toLowerCase();
      return (
        name.includes(query) ||
        email.includes(query) ||
        id.includes(query)
      );
    });
  }, [candidateSearchQuery, candidates]);

  // Initialize state when modal opens
  useEffect(() => {
    if (!open) return;

    const initialId = initialCandidate?.id ?? "";
    setSelectedCandidateId(initialId ? String(initialId) : "");
    setCandidateSearchQuery(initialId ? getCandidateName(initialCandidate) : "");
    setShowCandidateDropdown(false);

    setDocuments([]);
    setSelectedDocumentIds(new Set());
    setDocumentDistribution({});
    setCommentHtml("");
    const initialHMIds = new Set<string>();
    const initialHMs: HiringManager[] = [];

    if (jobHiringManager?.id != null) {
      initialHMIds.add(String(jobHiringManager.id));
      initialHMs.push({
        id: jobHiringManager.id,
        full_name:
          jobHiringManager.fullName ||
          jobHiringManager.full_name ||
          `${jobHiringManager.firstName || jobHiringManager.first_name || ""} ${jobHiringManager.lastName || jobHiringManager.last_name || ""}`.trim(),
        email: jobHiringManager.email && jobHiringManager.email !== "(Not provided)" ? jobHiringManager.email : undefined,
        organization_name:
          jobHiringManager.organization?.name ||
          jobHiringManager.organization_name ||
          job?.organization_name ||
          job?.company_name,
      });
    }

    setHiringManagers(initialHMs);
    setSelectedHiringManagerIds(initialHMIds);
    setSelectedInternalUserIds(new Set());

    if (initialId) {
      void fetchDocumentsForCandidate(String(initialId));
    }
    void fetchInternalUsers();
    void fetchHiringManagersForOrganization(job, jobHiringManager);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close candidate dropdown when clicking outside
  useEffect(() => {
    if (!showCandidateDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        candidateInputRef.current &&
        !candidateInputRef.current.contains(event.target as Node)
      ) {
        setShowCandidateDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCandidateDropdown]);

  const fetchDocumentsForCandidate = async (candidateId: string) => {
    if (!candidateId) return;
    setIsLoadingDocuments(true);
    try {
      const res = await fetch(`/api/job-seekers/${candidateId}/documents`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to load documents");
      }
      const docs: JobSeekerDocument[] = Array.isArray(data.documents)
        ? data.documents
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setDocuments(docs);
      const allIds = new Set<string>();
      const distMap: Record<string, string> = {};
      docs.forEach((d) => {
        if (d.id) {
          allIds.add(String(d.id));
          distMap[String(d.id)] = (d.distribution || d.document_type || DEFAULT_DISTRIBUTION).toString();
        }
      });
      setSelectedDocumentIds(allIds);
      setDocumentDistribution(distMap);
    } catch (e) {
      console.error("Error loading candidate documents", e);
      toast.error(
        e instanceof Error ? e.message : "Failed to load candidate documents"
      );
      setDocuments([]);
      setSelectedDocumentIds(new Set());
      setDocumentDistribution({});
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const fetchHiringManagersForOrganization = async (jobRef: any, hmRef: any) => {
    console.log("hmRef", hmRef);
    console.log("jobRef", jobRef);
    const orgId = jobRef?.customFields?.["Organization"];
    const orgName =
      hmRef?.organization?.name ||
      jobRef?.organization_name ||
      jobRef?.company_name ||
      "";

    const params = new URLSearchParams();
    if (orgId != null) {
      params.set("organization_id", String(orgId));
    }

    const queryString = params.toString();

    setIsLoadingHiringManagers(true);
    try {
      const endpoint = queryString
        ? `/api/hiring-managers?${queryString}`
        : "/api/hiring-managers";
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch hiring managers");
      }
      let hms: HiringManager[] =
        data.hiringManagers ||
        data.hiring_managers ||
        data.data ||
        data.items ||
        [];
      hms = Array.isArray(hms) ? hms : [];

      const jobOrgId = orgId != null ? String(orgId) : undefined;
      const orgNameLower = String(orgName || "").trim().toLowerCase();

      const filtered = hms.filter((hm) => {
        const hmOrgId =
          (hm as any).organization_id ??
          (hm as any).organizationId ??
          (hm as any).org_id;

        if (jobOrgId && hmOrgId != null) {
          return String(hmOrgId) === jobOrgId;
        }

        if (orgNameLower) {
          return String(hm.organization_name || "")
            .trim()
            .toLowerCase() === orgNameLower;
        }

        return false;
      });

      // Merge with any pre-seeded hiring managers (like jobHiringManager)
      setHiringManagers((prev) => {
        const byId: Record<string, HiringManager> = {};
        [...prev, ...filtered].forEach((hm) => {
          if (hm && hm.id != null) {
            byId[String(hm.id)] = hm;
          }
        });
        return Object.values(byId);
      });
    } catch (e) {
      console.error("Error fetching hiring managers", e);
      toast.error(
        e instanceof Error ? e.message : "Failed to load hiring managers"
      );
      setHiringManagers([]);
    } finally {
      setIsLoadingHiringManagers(false);
    }
  };

  const fetchInternalUsers = async () => {
    setIsLoadingInternalUsers(true);
    try {
      const res = await fetch("/api/users/active");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch internal users");
      }
      const users: InternalUser[] = data.users || data.data || [];
      setInternalUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      console.error("Error fetching internal users", e);
      toast.error(
        e instanceof Error ? e.message : "Failed to load internal users"
      );
      setInternalUsers([]);
    } finally {
      setIsLoadingInternalUsers(false);
    }
  };

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDocuments = () => {
    const all = new Set<string>();
    documents.forEach((d) => {
      if (d.id) all.add(String(d.id));
    });
    setSelectedDocumentIds(all);
  };

  const clearAllDocuments = () => {
    setSelectedDocumentIds(new Set());
  };

  const handleDocumentDistributionChange = (id: string, value: string) => {
    setDocumentDistribution((prev) => ({
      ...prev,
      [id]: value || DEFAULT_DISTRIBUTION,
    }));
  };

  const toggleHiringManagerSelection = (id: string) => {
    setSelectedHiringManagerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInternalUserSelection = (id: string) => {
    setSelectedInternalUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToolbarCommand = (command: string) => {
    if (typeof document === "undefined") return;
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand(command);
      setCommentHtml(editorRef.current.innerHTML);
    } catch (e) {
      console.error("Rich text command failed", e);
    }
  };

  const handleSubmit = async (mode: "compose" | "no-email") => {
    if (!selectedCandidateId) {
      toast.error("Please select a candidate.");
      return;
    }
    if (!jobId) {
      toast.error("Missing job context for submission.");
      return;
    }

    const attachments = Array.from(selectedDocumentIds);
    if (attachments.length === 0) {
      toast.error("Please select at least one document to submit.");
      return;
    }

    const comments_html = commentHtml || undefined;
    const comments = extractPlainText(commentHtml || "") || undefined;

    setIsSubmitting(true);
    try {
      const payload: any = {
        type: "client_submissions",
        job_id: Number(jobId),
        status: "Client Submission",
        comments,
        comments_html,
        attachment_ids: attachments,
        documents: attachments.map((id) => ({
          id,
          distribution: documentDistribution[id] || DEFAULT_DISTRIBUTION,
        })),
        hiring_manager_ids: Array.from(selectedHiringManagerIds),
        internal_email_notification:
          Array.from(selectedInternalUserIds).join(",") || null,
        submitted_by_name: currentUserName || undefined,
        submitted_by_email: currentUserEmail || undefined,
        // Always send backend email notifications (for internal users and HMs)
        // regardless of whether the user selects "Compose Email" or "Add Without Email".
        send_email: true,
      };

      const res = await fetch(
        `/api/job-seekers/${selectedCandidateId}/client-submissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to create client submission");
      }

      toast.success("Client submission created successfully.");

      // If user chose Compose Email, open their email client
      if (mode === "compose" && typeof window !== "undefined") {
        const toEmails = Array.from(selectedHiringManagerIds)
          .map((id) => {
            const hm = hiringManagers.find(
              (h) => String(h.id) === String(id)
            );
            return hm?.email;
          })
          .filter(Boolean) as string[];

        if (toEmails.length > 0) {
          const candidateName = getCandidateName(selectedCandidate);
          const subject = encodeURIComponent(
            `Candidate submission for ${displayJob} - ${candidateName}`
          );
          const body = encodeURIComponent(
            comments ||
              `Please see attached documents for ${candidateName} submitted to ${displayJob}.`
          );
          window.location.href = `mailto:${toEmails.join(
            ","
          )}?subject=${subject}&body=${body}`;
        }
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error("Error creating client submission", e);
      toast.error(
        e instanceof Error ? e.message : "Failed to create client submission"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <div className="flex flex-col max-h-[90vh] bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            Add Client Submission
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

        {/* Body */}
        <div className="p-4 space-y-6 overflow-y-auto min-h-0 flex-1">
          {/* Candidate lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidate <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={candidateInputRef}>
              <div className="flex border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                  type="text"
                  value={
                    selectedCandidate && !showCandidateDropdown
                      ? getCandidateName(selectedCandidate)
                      : candidateSearchQuery
                  }
                  onChange={(e) => {
                    setCandidateSearchQuery(e.target.value);
                    setShowCandidateDropdown(true);
                    if (selectedCandidateId) {
                      setSelectedCandidateId("");
                    }
                  }}
                  onFocus={() => setShowCandidateDropdown(true)}
                  placeholder="Search or select candidate..."
                  className="flex-1 px-3 py-2 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowCandidateDropdown((prev) => !prev)
                  }
                  className="px-2 text-gray-500 hover:bg-gray-100 rounded-r"
                  aria-label="Search candidates"
                >
                  <FiSearch size={18} />
                </button>
                {selectedCandidate && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidateId("");
                      setCandidateSearchQuery("");
                      setShowCandidateDropdown(true);
                      setDocuments([]);
                      setSelectedDocumentIds(new Set());
                      setDocumentDistribution({});
                    }}
                    className="px-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Clear candidate"
                  >
                    <FiX size={18} />
                  </button>
                )}
              </div>
              {showCandidateDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-56 overflow-y-auto">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      No candidates found
                    </div>
                  ) : (
                    filteredCandidates.slice(0, 50).map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          const id = String(candidate.id);
                          setSelectedCandidateId(id);
                          setCandidateSearchQuery("");
                          setShowCandidateDropdown(false);
                          void fetchDocumentsForCandidate(id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">
                          {getCandidateName(candidate)}
                        </span>
                        {candidate.email && (
                          <span className="block text-xs text-gray-500">
                            {candidate.email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedCandidate && !candidateSearchQuery && (
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                {getCandidateName(selectedCandidate)}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCandidateId("");
                    setCandidateSearchQuery("");
                    setShowCandidateDropdown(true);
                    setDocuments([]);
                    setSelectedDocumentIds(new Set());
                    setDocumentDistribution({});
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Job (auto-filled) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job
            </label>
            <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
              <span className="text-gray-900">{displayJob}</span>
              <FiCheck className="text-green-600 shrink-0" size={18} />
            </div>
          </div>

          {/* Hiring managers (contacts) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact (Hiring Managers)
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Tag one or more hiring managers from the client organization.
            </p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={hiringManagerSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setHiringManagerSearch(value);
                  void fetchHiringManagersForOrganization(job, jobHiringManager);
                }}
                placeholder="Search hiring managers..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="border border-gray-300 rounded max-h-40 overflow-y-auto">
              {isLoadingHiringManagers ? (
                <div className="p-3 text-sm text-gray-500">
                  Loading hiring managers...
                </div>
              ) : hiringManagers.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  No hiring managers found for this organization.
                </div>
              ) : (
                hiringManagers
                  .filter((hm) => {
                    const q = hiringManagerSearch.trim().toLowerCase();
                    if (!q) return true;
                    const name =
                      hm.name ||
                      hm.full_name ||
                      `${hm.first_name || ""} ${hm.last_name || ""}`.trim();
                    const email = hm.email || "";
                    return (
                      String(name || "").toLowerCase().includes(q) ||
                      String(email || "").toLowerCase().includes(q)
                    );
                  })
                  .map((hm) => {
                  const id = String(hm.id);
                  const name =
                    hm.name ||
                    hm.full_name ||
                    `${hm.first_name || ""} ${hm.last_name || ""}`.trim() ||
                    `Hiring Manager #${id}`;
                  const selected = selectedHiringManagerIds.has(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleHiringManagerSelection(id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          {name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {hm.organization_name || ""}{" "}
                          {hm.email ? `• ${hm.email}` : ""}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Comments - rich text editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Use this area to write a candidate summary, experience notes, and
              why they are a strong fit.
            </p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleToolbarCommand("bold")}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 font-semibold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => handleToolbarCommand("italic")}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 italic"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => handleToolbarCommand("underline")}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 underline"
              >
                U
              </button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              className="w-full min-h-[120px] p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm prose prose-sm max-w-none"
              onInput={(e) =>
                setCommentHtml((e.target as HTMLDivElement).innerHTML)
              }
              suppressContentEditableWarning
            />
          </div>

          {/* Candidate overview */}
          {selectedCandidate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overview of Candidate Details
              </label>
              <div className="border border-gray-200 rounded p-3 bg-gray-50 text-sm text-gray-800 space-y-1">
                <div className="font-semibold">
                  {getCandidateName(selectedCandidate)}
                </div>
                {selectedCandidate.email && (
                  <div>Email: {selectedCandidate.email}</div>
                )}
                {selectedCandidate.rawJobSeeker?.title && (
                  <div>Title: {selectedCandidate.rawJobSeeker.title}</div>
                )}
                {selectedCandidate.rawJobSeeker?.skills && (
                  <div>
                    Skills: {selectedCandidate.rawJobSeeker.skills}
                  </div>
                )}
                {selectedCandidate.rawJobSeeker?.summary && (
                  <div>
                    Summary: {selectedCandidate.rawJobSeeker.summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Internal email notification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Email Notification
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Tag internal team members who should receive email notifications
              about this submission.
            </p>
            <div className="border border-gray-300 rounded max-h-40 overflow-y-auto">
              {isLoadingInternalUsers ? (
                <div className="p-3 text-sm text-gray-500">
                  Loading internal users...
                </div>
              ) : internalUsers.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  No internal users available.
                </div>
              ) : (
                internalUsers.map((user) => {
                  const id = String(user.id);
                  const selected = selectedInternalUserIds.has(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleInternalUserSelection(id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-800">
                        {user.name || user.email || `User #${id}`}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Documents selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Documents to Submit
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllDocuments}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAllDocuments}
                  className="text-xs text-gray-600 hover:underline"
                >
                  Select none
                </button>
              </div>
            </div>
            {isLoadingDocuments ? (
              <p className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
                Loading documents...
              </p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
                No documents available for this candidate.
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
                      <th className="text-left p-2 font-medium text-gray-700">
                        Distribution
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const id = String(doc.id);
                      const checked = selectedDocumentIds.has(id);
                      const createdAt = doc.created_at
                        ? new Date(doc.created_at).toLocaleString()
                        : "—";
                      const type =
                        doc.document_type || doc.type || "—";
                      const dist =
                        documentDistribution[id] || DEFAULT_DISTRIBUTION;
                      return (
                        <tr
                          key={id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="p-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDocumentSelection(id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>
                                {doc.document_name ||
                                  doc.name ||
                                  "Untitled"}
                              </span>
                            </label>
                          </td>
                          <td className="p-2 text-gray-600">
                            {createdAt}
                          </td>
                          <td className="p-2 text-gray-600">{type}</td>
                          <td className="p-2 text-gray-600">
                            <select
                              value={dist}
                              onChange={(e) =>
                                handleDocumentDistributionChange(
                                  id,
                                  e.target.value
                                )
                              }
                              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="internal">Internal only</option>
                              <option value="general">General / client</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
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
            onClick={() => handleSubmit("compose")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isSubmitting ||
              !selectedCandidateId ||
              selectedDocumentIds.size === 0
            }
          >
            {isSubmitting ? "Submitting..." : "Compose Email"}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("no-email")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isSubmitting ||
              !selectedCandidateId ||
              selectedDocumentIds.size === 0
            }
          >
            {isSubmitting ? "Submitting..." : "Add Without Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

