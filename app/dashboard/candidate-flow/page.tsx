// File: app/dashboard/candidate-flow/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiX, FiChevronLeft, FiChevronRight, FiUser, FiRefreshCw } from 'react-icons/fi';
import { TbBinoculars } from 'react-icons/tb';
import { FaFacebookF, FaLinkedinIn } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from "nextjs-toploader/app";
import SubmissionFormModal from '@/components/SubmissionFormModal';
import ClientSubmissionModal from '@/components/ClientSubmissionModal';
import AddNoteModal from '@/components/AddNoteModal';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { toast } from 'sonner';
import RecordNameResolver, { type RecordType } from '@/components/RecordNameResolver';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import { getCustomFieldLabel } from '@/lib/getCustomFieldLabel';

interface PrescreenedCandidate {
  id: number;
  name: string;
  record_number: number | null;
  latest_prescreen_at: string;
}

interface Candidate {
  id: number;
  name: string;
  /**
   * Human-readable job label for display (record id / title).
   */
  jobId: string;
  /**
   * Primary application id used for status updates.
   */
  applicationId?: number | string;
  /**
   * Underlying job id used for planner navigation / submissions.
   */
  jobNumericId?: number | string | null;
}

interface CandidateColumn {
  id: string;
  title: string;
  color: string;
  accent: string;
  count?: number;
  candidates: Candidate[] | PrescreenedCandidate[];
  isPrescreenedColumn?: boolean;
}

interface JobSeekerProfilePreview {
  id: number;
  record_number?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  company_status?: string | null;
  mobile_phone?: string | null;
  direct_line?: string | null;
  linkedin_url?: string | null;
  date_added?: string | null;
  owner_name?: string | null;
  customFields?: unknown;
}

interface JobProfilePreview {
  id: number;
  record_number?: number | null;
  title?: string | null;
  status?: string | null;
  company?: string | null;
  company_name?: string | null;
  organization_name?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  job_type?: string | null;
  employment_type?: string | null;
  date_added?: string | null;
  owner_name?: string | null;
  customFields?: unknown;
}

interface DragPayload {
  fromColumnId: string;
  candidate: PrescreenedCandidate | Candidate;
}

const JOB_SEEKER_MODAL_FIELD_NAMES = [
  'Field_1',
  'Field_3',
  'Field_4',
  'Field_5',
  'Field_6',
  'Field_8',
  'Field_11',
  'Field_69',
  'Field_70',
] as const;

const JOB_MODAL_FIELD_NAMES = [
  'Field_1',
  'Field_2',
  'Field_22',
  'Field_4',
  'Field_6',
  'Field_8',
  'Field_12',
  'Field_13',
  'Field_14',
  'Field_15',
  'Field_17',
  'Field_24',
  'Field_69',
  'Field_70',
] as const;

const HIRING_MANAGER_CONTACT_FIELD_NAMES = [
  'Field_3',
  'Field_10',
  'Field_16',
  'Field_7',
] as const;

const PLACEHOLDER_COLUMNS: Omit<CandidateColumn, 'candidates' | 'count'>[] = [
  { id: 'submitted', title: 'Job Seekers Submitted', color: 'bg-slate-100', accent: 'border-slate-400' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-emerald-50', accent: 'border-emerald-400' },
  { id: 'interviews', title: 'Job Seekers with Interviews', color: 'bg-amber-50', accent: 'border-amber-400' },
  { id: 'offer', title: 'Job Seekers with Offer', color: 'bg-teal-50', accent: 'border-teal-400' },
  { id: 'starting', title: 'Job Seekers Starting', color: 'bg-sky-50', accent: 'border-sky-400' },
  { id: 'assignment', title: 'Job Seekers on Assignment', color: 'bg-violet-50', accent: 'border-violet-400' },
];

/** Displays job record id using the shared RecordNameResolver cache — no extra fetch. */
function JobRecordNumber({ jobNumericId }: { jobNumericId: number }) {
  return (
    <RecordNameResolver
      id={jobNumericId}
      type="job"
      clickable={false}
      onlyRecordNumber={true}
      className="text-slate-500 text-xs"
    />
  );
}

export default function CandidateFlowDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [prescreenedTotal, setPrescreenedTotal] = useState(0);
  const [prescreenedList, setPrescreenedList] = useState<PrescreenedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageLoading, setStageLoading] = useState(false);
  const [columns, setColumns] = useState<CandidateColumn[]>([]);
  const [prescreenedStage, setPrescreenedStage] = useState<PrescreenedCandidate[]>([]);
  const [submittedStage, setSubmittedStage] = useState<Candidate[]>([]);
  const [clientSubmittedStage, setClientSubmittedStage] = useState<Candidate[]>([]);
  const [interviewStage, setInterviewStage] = useState<Candidate[]>([]);
  const [offerStage, setOfferStage] = useState<Candidate[]>([]);
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [modalCandidate, setModalCandidate] = useState<PrescreenedCandidate | null>(null);
  const [clientSubmissionContext, setClientSubmissionContext] = useState<{
    candidateId: number;
    candidateName: string;
    jobId: number | string | null;
  } | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    candidateId: number | string;
    applicationId: number | string;
    newStatus: string;
  } | null>(null);
  const [noteModalDefaults, setNoteModalDefaults] = useState<{
    action: string;
    aboutReferences: {
      id: string;
      type: string;
      display: string;
      value: string;
    }[];
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedJobSeekerId, setSelectedJobSeekerId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedJobSeekerProfile, setSelectedJobSeekerProfile] = useState<JobSeekerProfilePreview | null>(null);
  const [loadingJobSeekerProfile, setLoadingJobSeekerProfile] = useState(false);
  const [jobSeekerFieldLabelsByName, setJobSeekerFieldLabelsByName] = useState<Record<string, string>>({});
  const [loadingJobSeekerFieldLabels, setLoadingJobSeekerFieldLabels] = useState(false);
  const [selectedJobProfile, setSelectedJobProfile] = useState<JobProfilePreview | null>(null);
  const [loadingJobProfile, setLoadingJobProfile] = useState(false);
  const [jobFieldLabelsByName, setJobFieldLabelsByName] = useState<Record<string, string>>({});
  const [loadingJobFieldLabels, setLoadingJobFieldLabels] = useState(false);
  const [selectedHiringManagerProfile, setSelectedHiringManagerProfile] = useState<Record<string, any> | null>(null);
  const [hiringManagerFieldLabelsByName, setHiringManagerFieldLabelsByName] = useState<Record<string, string>>({});
  const [loadingHiringManagerContact, setLoadingHiringManagerContact] = useState(false);
  const [hasHiringManagerLookup, setHasHiringManagerLookup] = useState(false);
  const [jobProfileRefreshTick, setJobProfileRefreshTick] = useState(0);

  const getToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1');

  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      try {
        const res = await fetch('/api/job-seekers/candidate-flow', { credentials: 'include' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success) {
          setPrescreenedTotal(data.prescreenedTotal ?? 0);
          setPrescreenedList(Array.isArray(data.prescreenedByUserLast30Days) ? data.prescreenedByUserLast30Days : []);
        }
      } catch (_) {
        if (mounted) {
          setPrescreenedTotal(0);
          setPrescreenedList([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, [reloadKey]);

  // Classify prescreened candidates into "still prescreened" vs "submitted"
  useEffect(() => {
    let cancelled = false;

    async function classifyStages() {
      if (prescreenedList.length === 0) {
        if (!cancelled) {
          setPrescreenedStage([]);
          setSubmittedStage([]);
        }
        return;
      }

      setStageLoading(true);
      try {
        const results = await Promise.all(
          prescreenedList.map(async (c) => {
            try {
              const [appsRes, clientSubsRes] = await Promise.all([
                fetch(`/api/job-seekers/${c.id}/applications?scope=current-user`, {
                  credentials: 'include',
                }),
                fetch(`/api/job-seekers/${c.id}/client-submissions?scope=current-user`, {
                  credentials: 'include',
                }),
              ]);

              let applications: any[] = [];
              if (appsRes.ok) {
                const data = await appsRes.json();
                applications = Array.isArray(data.applications) ? data.applications : [];
              }

              let clientSubmissions: any[] = [];
              if (clientSubsRes.ok) {
                const data = await clientSubsRes.json();
                clientSubmissions = Array.isArray(data.submissions) ? data.submissions : [];
              }

              return { applications, clientSubmissions };
            } catch {
              return { applications: [] as any[], clientSubmissions: [] as any[] };
            }
          })
        );

        if (cancelled) return;

        const nextPrescreened: PrescreenedCandidate[] = [];
        const nextSubmitted: Candidate[] = [];
        const nextClientSubmitted: Candidate[] = [];
        const nextInterview: Candidate[] = [];
        const nextOffer: Candidate[] = [];

        prescreenedList.forEach((c, idx) => {
          const apps = results[idx]?.applications || [];
          const clientSubs = results[idx]?.clientSubmissions || [];

          // Always keep prescreened candidates in the Prescreen column
          nextPrescreened.push(c);

          // If there is no downstream activity yet, they only appear in Prescreen
          if (apps.length === 0 && clientSubs.length === 0) {
            return;
          }

          const normalizeStatus = (s: any) => String(s || '').toLowerCase();

          const getJobIdFromRecord = (record: any) => {
            if (!record) return null;
            return record.job_id ?? record.jobId ?? record.job_id_id ?? record.id ?? null;
          };

          const buildJobLabel = (record: any) => {
            if (!record) return '';
            if (record.job_id != null || record.jobId != null || record.job_id_id != null) {
              const rawId = record.job_id ?? record.jobId ?? record.job_id_id;
              return formatRecordId(rawId, 'job');
            }
            if (record.record_number != null) return formatRecordId(record.record_number, 'job');
            return record.job_title || '';
          };

          // ── One card per application/submission so the same job seeker
          //    submitted to multiple jobs appears multiple times in the board. ──

          // Offer Extended
          apps.filter((a: any) => normalizeStatus(a?.status) === 'offer extended').forEach((a: any) => {
            nextOffer.push({ id: c.id, name: c.name, jobId: buildJobLabel(a), applicationId: a.id, jobNumericId: getJobIdFromRecord(a) });
          });

          // Interview
          apps.filter((a: any) => normalizeStatus(a?.status) === 'interview').forEach((a: any) => {
            nextInterview.push({ id: c.id, name: c.name, jobId: buildJobLabel(a), applicationId: a.id, jobNumericId: getJobIdFromRecord(a) });
          });

          // Client Submitted (apps)
          apps.filter((a: any) => { const s = normalizeStatus(a?.status); return s === 'client submission' || s === 'client submitted'; }).forEach((a: any) => {
            nextClientSubmitted.push({ id: c.id, name: c.name, jobId: buildJobLabel(a), applicationId: a.id, jobNumericId: getJobIdFromRecord(a) });
          });

          // Client Submitted (client_submissions table)
          clientSubs.filter((cs: any) => { const s = normalizeStatus(cs?.status); return s === 'client submission' || s === 'client submitted'; }).forEach((cs: any) => {
            nextClientSubmitted.push({ id: c.id, name: c.name, jobId: buildJobLabel(cs), applicationId: cs?.application_id ?? cs?.applicationId ?? null, jobNumericId: getJobIdFromRecord(cs) });
          });

          // Remaining apps → Submitted (skip withdrew/client rejected)
          const handledStatuses = new Set(['offer extended', 'interview', 'client submission', 'client submitted', 'withdrew', 'client rejected']);
          apps.filter((a: any) => !handledStatuses.has(normalizeStatus(a?.status))).forEach((a: any) => {
            nextSubmitted.push({ id: c.id, name: c.name, jobId: buildJobLabel(a), applicationId: a.id, jobNumericId: getJobIdFromRecord(a) });
          });

          // Client subs with no matching status → Submitted
          clientSubs.filter((cs: any) => { const s = normalizeStatus(cs?.status); return !handledStatuses.has(s); }).forEach((cs: any) => {
            nextSubmitted.push({ id: c.id, name: c.name, jobId: buildJobLabel(cs), applicationId: cs?.application_id ?? cs?.applicationId ?? null, jobNumericId: getJobIdFromRecord(cs) });
          });
        });

        setPrescreenedStage(nextPrescreened);
        setSubmittedStage(nextSubmitted);
        setClientSubmittedStage(nextClientSubmitted);
        setInterviewStage(nextInterview);
        setOfferStage(nextOffer);
      } finally {
        if (!cancelled) setStageLoading(false);
      }
    }

    classifyStages();

    return () => {
      cancelled = true;
    };
  }, [prescreenedList]);

  // Build columns from stage data
  useEffect(() => {
    const findPlaceholder = (id: string) =>
      PLACEHOLDER_COLUMNS.find((col) => col.id === id);

    const prescreenedColumn: CandidateColumn = {
      id: 'prescreened',
      title: 'Job Seekers PreScreened',
      color: 'bg-green-50',
      accent: 'border-green-500',
      count: prescreenedStage.length,
      candidates: prescreenedStage,
      isPrescreenedColumn: true,
    };

    const submittedColumn: CandidateColumn = {
      id: 'submitted',
      title: 'Job Seekers Submitted',
      color: 'bg-slate-50',
      accent: 'border-slate-500',
      count: submittedStage.length,
      candidates: submittedStage,
    };

    const clientMeta = findPlaceholder('client-submitted');
    const clientSubmittedColumn: CandidateColumn = {
      id: 'client-submitted',
      title: clientMeta?.title ?? 'Client Submitted',
      color: clientMeta?.color ?? 'bg-emerald-50',
      accent: clientMeta?.accent ?? 'border-emerald-400',
      count: clientSubmittedStage.length,
      candidates: clientSubmittedStage,
    };

    const interviewMeta = findPlaceholder('interviews');
    const interviewColumn: CandidateColumn = {
      id: 'interviews',
      title: interviewMeta?.title ?? 'Job Seekers with Interviews',
      color: interviewMeta?.color ?? 'bg-amber-50',
      accent: interviewMeta?.accent ?? 'border-amber-400',
      count: interviewStage.length,
      candidates: interviewStage,
    };

    const offerMeta = findPlaceholder('offer');
    const offerColumn: CandidateColumn = {
      id: 'offer',
      title: offerMeta?.title ?? 'Job Seekers with Offer',
      color: offerMeta?.color ?? 'bg-teal-50',
      accent: offerMeta?.accent ?? 'border-teal-400',
      count: offerStage.length,
      candidates: offerStage,
    };

    const others: CandidateColumn[] = PLACEHOLDER_COLUMNS.filter(
      (col) =>
        col.id !== 'submitted' &&
        col.id !== 'client-submitted' &&
        col.id !== 'interviews' &&
        col.id !== 'offer'
    ).map((col) => ({
      ...col,
      candidates: [],
    }));

    setColumns([
      prescreenedColumn,
      submittedColumn,
      clientSubmittedColumn,
      interviewColumn,
      offerColumn,
      ...others,
    ]);
  }, [
    prescreenedStage,
    submittedStage,
    clientSubmittedStage,
    interviewStage,
    offerStage,
  ]);

  const handlePrevious = () => router.push('/dashboard');
  const handleNext = () => router.push('/dashboard/sales-dashboard');
  const handleClose = () => router.push('/home');

  const handleViewCandidate = (id: number) => {
    setSelectedJobSeekerId(id);
  };

  const openJobSeekerProfilePage = (id: number) => {
    router.push(`/dashboard/job-seekers/view?id=${id}`);
  };

  const handleViewJob = (jobNumericId?: number | string | null) => {
    if (!jobNumericId) return;
    const numericId = Number(jobNumericId);
    if (!Number.isFinite(numericId)) return;
    setSelectedJobId(numericId);
  };

  const openSubmissionModalFor = (c: PrescreenedCandidate) => {
    setModalCandidate(c);
  };

  const closeSubmissionModal = () => {
    setModalCandidate(null);
  };

  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
    setNoteModalDefaults(null);
  };

  const openClientSubmissionModalFromBoard = (candidate: Candidate) => {
    setClientSubmissionContext({
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: candidate.jobNumericId ?? null,
    });
  };

  const goToInterviewPlannerFromBoard = (candidate: Candidate) => {
    const params = new URLSearchParams();
    params.set('addAppointment', '1');
    params.set('participantType', 'job_seeker');
    params.set('participantId', String(candidate.id));
    if (candidate.jobNumericId != null) {
      params.set('jobId', String(candidate.jobNumericId));
    }
    params.set('appointmentType', 'Interview');
    if (candidate.applicationId != null) {
      params.set('applicationId', String(candidate.applicationId));
      params.set('candidateId', String(candidate.id));
    }

    router.push(`/dashboard/planner?${params.toString()}`);
  };

  const updateApplicationStatusFromBoard = async (
    candidateId: number | string,
    applicationId: number | string,
    newStatus: string
  ) => {
    try {
      const token = getToken();
      const res = await fetch(
        `/api/job-seekers/${candidateId}/applications/${applicationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Failed to update status');
        return;
      }
      toast.success('Status updated');
      setReloadKey((k) => k + 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating application status from candidate flow:', err);
      toast.error('Failed to update status');
    }
  };

  const extendOfferFromBoard = (candidate: Candidate) => {
    if (candidate.applicationId == null) {
      toast.error('Missing application context for offer.');
      return;
    }

    setPendingStatusChange({
      candidateId: candidate.id,
      applicationId: candidate.applicationId,
      newStatus: 'Offer Extended',
    });

    const refs: {
      id: string;
      type: string;
      display: string;
      value: string;
    }[] = [];

    const jsName = candidate.name || `Job Seeker #${candidate.id}`;
    const jsDisplay = `${formatRecordId(candidate.id, 'jobSeeker')} ${jsName}`;
    refs.push({
      id: String(candidate.id),
      type: 'Job Seeker',
      display: jsDisplay,
      value: jsDisplay,
    });

    if (candidate.jobNumericId != null) {
      const jobPrefix = formatRecordId(candidate.jobNumericId, 'job');
      const jobDisplay = `${jobPrefix} ${candidate.jobId || ''}`.trim();
      refs.push({
        id: String(candidate.jobNumericId),
        type: 'Job',
        display: jobDisplay,
        value: jobDisplay,
      });
    }

    setNoteModalDefaults({
      action: 'Offer Extended',
      aboutReferences: refs,
    });
    setShowAddNote(true);
  };

  useEffect(() => {
    if (selectedJobSeekerId == null) {
      setSelectedJobSeekerProfile(null);
      setLoadingJobSeekerProfile(false);
      return;
    }

    let cancelled = false;
    const fetchJobSeekerProfile = async () => {
      setLoadingJobSeekerProfile(true);
      try {
        const token = getToken();
        const res = await fetch(`/api/job-seekers/${selectedJobSeekerId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSelectedJobSeekerProfile(null);
          return;
        }
        const record = (data.jobSeeker ?? data) as Record<string, any>;
        let normalizedCustomFields: Record<string, any> = {};
        const customSources = [
          record?.customFields,
          record?.custom_fields,
          record?.custom_fields_json,
          record?.job_seeker_custom_fields,
          record?.fields,
        ];
        for (const src of customSources) {
          if (!src) continue;
          try {
            const parsed = typeof src === 'string' ? JSON.parse(src) : src;
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                const k = String(
                  f?.field_label ?? f?.field_name ?? f?.label ?? f?.name ?? f?.key ?? ''
                ).trim();
                if (!k) return;
                const v =
                  f?.field_value ??
                  f?.value ??
                  f?.display_value ??
                  f?.displayValue ??
                  f?.selected_options ??
                  f?.selectedOptions ??
                  '';
                if (v != null && v !== '') normalizedCustomFields[k] = v;
              });
            } else if (parsed && typeof parsed === 'object') {
              normalizedCustomFields = { ...parsed, ...normalizedCustomFields };
            }
          } catch {
            // Ignore malformed custom field source
          }
        }
        setSelectedJobSeekerProfile({
          ...(record as JobSeekerProfilePreview),
          customFields: normalizedCustomFields,
        });
      } catch {
        if (!cancelled) setSelectedJobSeekerProfile(null);
      } finally {
        if (!cancelled) setLoadingJobSeekerProfile(false);
      }
    };

    void fetchJobSeekerProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedJobSeekerId]);

  useEffect(() => {
    if (selectedJobSeekerId == null) {
      setJobSeekerFieldLabelsByName({});
      setLoadingJobSeekerFieldLabels(false);
      return;
    }
    let cancelled = false;
    const loadFieldLabels = async () => {
      setLoadingJobSeekerFieldLabels(true);
      try {
        const entries = await Promise.all(
          JOB_SEEKER_MODAL_FIELD_NAMES.map(async (fieldName) => {
            const label = await getCustomFieldLabel('job-seekers', fieldName);
            return [fieldName, label || fieldName] as const;
          })
        );
        if (cancelled) return;
        setJobSeekerFieldLabelsByName(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setLoadingJobSeekerFieldLabels(false);
      }
    };
    void loadFieldLabels();
    return () => {
      cancelled = true;
    };
  }, [selectedJobSeekerId]);

  useEffect(() => {
    if (selectedJobId == null) {
      setSelectedJobProfile(null);
      setLoadingJobProfile(false);
      return;
    }

    let cancelled = false;
    const fetchJobProfile = async () => {
      setLoadingJobProfile(true);
      try {
        const token = getToken();
        const res = await fetch(`/api/jobs/${selectedJobId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSelectedJobProfile(null);
          return;
        }
        const record = (data.job ?? data) as Record<string, any>;
        let normalizedCustomFields: Record<string, any> = {};
        const customSources = [
          record?.customFields,
          record?.custom_fields,
          record?.custom_fields_json,
          record?.job_custom_fields,
          record?.fields,
        ];
        for (const src of customSources) {
          if (!src) continue;
          try {
            const parsed = typeof src === 'string' ? JSON.parse(src) : src;
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                const k = String(
                  f?.field_label ?? f?.field_name ?? f?.label ?? f?.name ?? f?.key ?? ''
                ).trim();
                if (!k) return;
                const v =
                  f?.field_value ??
                  f?.value ??
                  f?.display_value ??
                  f?.displayValue ??
                  f?.selected_options ??
                  f?.selectedOptions ??
                  '';
                if (v != null && v !== '') normalizedCustomFields[k] = v;
              });
            } else if (parsed && typeof parsed === 'object') {
              normalizedCustomFields = { ...parsed, ...normalizedCustomFields };
            }
          } catch {
            // Ignore malformed custom field source
          }
        }
        setSelectedJobProfile({
          ...(record as JobProfilePreview),
          customFields: normalizedCustomFields,
        });
      } catch {
        if (!cancelled) setSelectedJobProfile(null);
      } finally {
        if (!cancelled) setLoadingJobProfile(false);
      }
    };

    void fetchJobProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedJobId, jobProfileRefreshTick]);

  useEffect(() => {
    if (selectedJobId == null) {
      setJobFieldLabelsByName({});
      setLoadingJobFieldLabels(false);
      return;
    }
    let cancelled = false;
    const loadJobFieldLabels = async () => {
      setLoadingJobFieldLabels(true);
      try {
        const entries = await Promise.all(
          JOB_MODAL_FIELD_NAMES.map(async (fieldName) => {
            const label = await getCustomFieldLabel('jobs', fieldName);
            return [fieldName, label || fieldName] as const;
          })
        );
        if (cancelled) return;
        setJobFieldLabelsByName(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setLoadingJobFieldLabels(false);
      }
    };
    void loadJobFieldLabels();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId == null || !selectedJobProfile) {
      setSelectedHiringManagerProfile(null);
      setHiringManagerFieldLabelsByName({});
      setLoadingHiringManagerContact(false);
      setHasHiringManagerLookup(false);
      return;
    }

    let cancelled = false;
    const loadHiringManagerContact = async () => {
      setLoadingHiringManagerContact(true);
      try {
        const jobField22Label = (await getCustomFieldLabel('jobs', 'Field_22')) || 'Field_22';
        const jobCustomFields =
          (selectedJobProfile.customFields as Record<string, any> | undefined) || {};
        const hiringManagerLookupRaw = jobCustomFields[jobField22Label] ?? jobCustomFields.Field_22;
        const hiringManagerId = getLookupIdValue(hiringManagerLookupRaw);

        // If Field_22 is empty/null, do not render contact section.
        if (!hiringManagerId) {
          if (!cancelled) {
            setSelectedHiringManagerProfile(null);
            setHiringManagerFieldLabelsByName({});
            setHasHiringManagerLookup(false);
          }
          return;
        }
        if (!cancelled) {
          setHasHiringManagerLookup(true);
        }

        const hmLabelEntries = await Promise.all(
          HIRING_MANAGER_CONTACT_FIELD_NAMES.map(async (fieldName) => {
            const label = await getCustomFieldLabel('hiring-managers', fieldName);
            return [fieldName, label || fieldName] as const;
          })
        );
        if (cancelled) return;
        setHiringManagerFieldLabelsByName(Object.fromEntries(hmLabelEntries));

        const token = getToken();
        const hmRes = await fetch(`/api/hiring-managers/${encodeURIComponent(hiringManagerId)}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        const hmData = await hmRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!hmRes.ok) {
          setSelectedHiringManagerProfile(null);
          return;
        }

        const record = (hmData.hiringManager ?? hmData) as Record<string, any>;
        let normalizedCustomFields: Record<string, any> = {};
        const customSources = [
          record?.customFields,
          record?.custom_fields,
          record?.custom_fields_json,
          record?.hiring_manager_custom_fields,
          record?.fields,
        ];
        for (const src of customSources) {
          if (!src) continue;
          try {
            const parsed = typeof src === 'string' ? JSON.parse(src) : src;
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                const k = String(
                  f?.field_label ?? f?.field_name ?? f?.label ?? f?.name ?? f?.key ?? ''
                ).trim();
                if (!k) return;
                const v =
                  f?.field_value ??
                  f?.value ??
                  f?.display_value ??
                  f?.displayValue ??
                  f?.selected_options ??
                  f?.selectedOptions ??
                  '';
                if (v != null && v !== '') normalizedCustomFields[k] = v;
              });
            } else if (parsed && typeof parsed === 'object') {
              normalizedCustomFields = { ...parsed, ...normalizedCustomFields };
            }
          } catch {
            // Ignore malformed custom field source
          }
        }

        setSelectedHiringManagerProfile({
          ...record,
          customFields: normalizedCustomFields,
        });
      } finally {
        if (!cancelled) setLoadingHiringManagerContact(false);
      }
    };

    void loadHiringManagerContact();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId, selectedJobProfile, jobProfileRefreshTick]);

  const openAddTaskForJobSeeker = (id: number) => {
    setSelectedJobSeekerId(null);
    router.push(`/dashboard/tasks/add?relatedEntity=job_seeker&relatedEntityId=${id}`);
  };

  const openAddAppointmentForJob = (id: number) => {
    const params = new URLSearchParams();
    params.set('addAppointment', '1');
    params.set('jobId', String(id));
    setSelectedJobId(null);
    router.push(`/dashboard/planner?${params.toString()}`);
  };

  const openAddTaskForJob = (id: number) => {
    setSelectedJobId(null);
    router.push(`/dashboard/tasks/add?relatedEntity=job&relatedEntityId=${id}`);
  };

  const formatPreviewDate = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US');
  };

  const normalizeFieldLabel = (value: string) =>
    value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

  const formatPreviewValue = (value: any): string => {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) {
      return value
        .map((v) => formatPreviewValue(v))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object') {
      if (typeof value.value === 'string' || typeof value.value === 'number') {
        return String(value.value);
      }
      if (typeof value.display === 'string' || typeof value.display === 'number') {
        return String(value.display);
      }
      if (typeof value.label === 'string' || typeof value.label === 'number') {
        return String(value.label);
      }
      if (typeof value.name === 'string' || typeof value.name === 'number') {
        return String(value.name);
      }
      if (typeof value.title === 'string' || typeof value.title === 'number') {
        return String(value.title);
      }
      if (
        (typeof value.record_number === 'string' || typeof value.record_number === 'number') &&
        (typeof value.job_title === 'string' || typeof value.job_title === 'number')
      ) {
        return `${value.record_number} ${value.job_title}`.trim();
      }
      if (typeof value.job_title === 'string' || typeof value.job_title === 'number') {
        return String(value.job_title);
      }
      if (typeof value.record_number === 'string' || typeof value.record_number === 'number') {
        return String(value.record_number);
      }
      if (typeof value.id === 'string' || typeof value.id === 'number') {
        return String(value.id);
      }
      return '';
    }
    return String(value);
  };

  const extractCustomFieldEntries = (customFields: unknown): Array<{ label: string; value: any }> => {
    if (!customFields) return [];

    const out: Array<{ label: string; value: any }> = [];

    const visit = (source: any, depth = 0) => {
      if (!source || depth > 3) return;

      if (Array.isArray(source)) {
        source.forEach((item) => visit(item, depth + 1));
        return;
      }

      if (typeof source !== 'object') return;

      const label = String(
        source?.label ??
        source?.name ??
        source?.field_label ??
        source?.fieldName ??
        source?.field_name ??
        source?.key ??
        ''
      ).trim();
      const value =
        source?.value ??
        source?.field_value ??
        source?.fieldValue ??
        source?.display_value ??
        source?.displayValue ??
        source?.selected_options ??
        source?.selectedOptions ??
        source?.values;

      if (label) out.push({ label, value });

      const nestedCandidates = [
        source?.customFields,
        source?.custom_fields,
        source?.fields,
        source?.data,
        source?.items,
        source?.records,
      ];
      nestedCandidates.forEach((n) => visit(n, depth + 1));

      // Plain key/value object support
      Object.entries(source).forEach(([k, v]) => {
        if (k === 'customFields' || k === 'custom_fields' || k === 'fields') return;
        if (typeof v === 'object' && v !== null) return;
        out.push({ label: k, value: v });
      });
    };

    visit(customFields);
    return out.filter((entry) => entry.label);
  };

  const getFieldRawValue = (
    record: Record<string, any> | null | undefined,
    labels: string[],
    directKeys: string[] = []
  ) => {
    if (!record) return '';
    for (const key of directKeys) {
      const direct = record[key];
      const parsed = formatPreviewValue(direct);
      if (parsed) return direct;
    }

    const wanted = labels.map(normalizeFieldLabel);
    const customEntries = [
      ...extractCustomFieldEntries(record.customFields),
      ...extractCustomFieldEntries(record.custom_fields),
      ...extractCustomFieldEntries(record.fields),
    ];
    for (const entry of customEntries) {
      const normalizedLabel = normalizeFieldLabel(entry.label);
      const matched = wanted.some(
        (w) => normalizedLabel.includes(w) || w.includes(normalizedLabel)
      );
      if (!matched) continue;
      const value = formatPreviewValue(entry.value);
      if (value) return entry.value;
    }

    // Last fallback: match against direct record keys by label includes
    for (const [key, raw] of Object.entries(record)) {
      const normalizedKey = normalizeFieldLabel(key);
      const matched = wanted.some((w) => normalizedKey.includes(w) || w.includes(normalizedKey));
      if (!matched) continue;
      const value = formatPreviewValue(raw);
      if (value) return raw;
    }
    return '';
  };

  const getFieldValue = (
    record: Record<string, any> | null | undefined,
    labels: string[],
    directKeys: string[] = [],
    isDate = false
  ) => {
    const raw = getFieldRawValue(record, labels, directKeys);
    const formatted = formatPreviewValue(raw);
    if (!formatted) return '';
    return isDate ? formatPreviewDate(formatted) : formatted;
  };

  const getJobSeekerFieldLabel = (fieldName: string) =>
    jobSeekerFieldLabelsByName[fieldName] || fieldName;

  const getJobSeekerFieldValueByFieldName = (fieldName: string) => {
    const label = getJobSeekerFieldLabel(fieldName);
    if (!selectedJobSeekerProfile) return '';
    const customFields = selectedJobSeekerProfile.customFields as Record<string, any> | undefined;
    if (!customFields || typeof customFields !== 'object') return '';
    const value = customFields[label] ?? customFields[fieldName];
    return formatPreviewValue(value);
  };

  const getJobSeekerProfileFullName = () => {
    const firstName = getJobSeekerFieldValueByFieldName('Field_1')
      || String(selectedJobSeekerProfile?.first_name || '').trim();
    const lastName = getJobSeekerFieldValueByFieldName('Field_3')
      || String(selectedJobSeekerProfile?.last_name || '').trim();
    const joined = `${firstName} ${lastName}`.trim();
    if (joined) return joined;
    return String(selectedJobSeekerProfile?.name || '').trim();
  };

  const openPersonSearch = (platform: 'google' | 'linkedin' | 'facebook') => {
    const fullName = getJobSeekerProfileFullName();
    if (!fullName) return;
    const query = encodeURIComponent(fullName);
    const urls = {
      google: `https://www.google.com/search?q=${query}`,
      linkedin: `https://www.linkedin.com/search/results/all/?keywords=${query}`,
      facebook: `https://www.facebook.com/search/top/?q=${query}`,
    };
    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  };

  const openAddInterviewAppointmentForJobSeeker = (id: number) => {
    const params = new URLSearchParams();
    params.set('addAppointment', '1');
    params.set('participantType', 'job_seeker');
    params.set('participantId', String(id));
    params.set('candidateId', String(id));
    params.set('appointmentType', 'Interview');
    setSelectedJobSeekerId(null);
    router.push(`/dashboard/planner?${params.toString()}`);
  };

  const getJobFieldLabel = (fieldName: string) =>
    jobFieldLabelsByName[fieldName] || fieldName;

  const getJobFieldValueByFieldName = (fieldName: string) => {
    const label = getJobFieldLabel(fieldName);
    if (!selectedJobProfile) return '';
    const customFields = selectedJobProfile.customFields as Record<string, any> | undefined;
    if (!customFields || typeof customFields !== 'object') return '';
    return formatPreviewValue(customFields[label]);
  };

  const getHiringManagerFieldLabel = (fieldName: string) =>
    hiringManagerFieldLabelsByName[fieldName] || fieldName;

  const getHiringManagerFieldValueByFieldName = (fieldName: string) => {
    const label = getHiringManagerFieldLabel(fieldName);
    if (!selectedHiringManagerProfile) return '';
    const customFields = selectedHiringManagerProfile.customFields as Record<string, any> | undefined;
    if (!customFields || typeof customFields !== 'object') return '';
    return formatPreviewValue(customFields[label]);
  };

  const getHiringManagerFieldRawValueByFieldName = (fieldName: string) => {
    const label = getHiringManagerFieldLabel(fieldName);
    if (!selectedHiringManagerProfile) return '';
    const customFields = selectedHiringManagerProfile.customFields as Record<string, any> | undefined;
    if (!customFields || typeof customFields !== 'object') return '';
    return customFields[label];
  };

  const getJobFieldRawValueByFieldName = (fieldName: string) => {
    const label = getJobFieldLabel(fieldName);
    if (!selectedJobProfile) return '';
    const customFields = selectedJobProfile.customFields as Record<string, any> | undefined;
    if (!customFields || typeof customFields !== 'object') return '';
    return customFields[label];
  };

  const getJobFullAddress = () => {
    const parts = [
      getJobFieldValueByFieldName('Field_12'),
      getJobFieldValueByFieldName('Field_13'),
      getJobFieldValueByFieldName('Field_14'),
      getJobFieldValueByFieldName('Field_15'),
      getJobFieldValueByFieldName('Field_17'),
    ]
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  };

  const getLookupIdValue = (raw: any): string | null => {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return String(raw);
    if (typeof raw === 'string') {
      const cleaned = raw.trim();
      if (!cleaned) return null;
      if (/^\d+(,\s*\d+)*$/.test(cleaned)) return cleaned;
      return null;
    }
    if (Array.isArray(raw)) {
      const ids = raw
        .map((item) => getLookupIdValue(item))
        .filter(Boolean) as string[];
      return ids.length ? ids.join(',') : null;
    }
    if (typeof raw === 'object') {
      const candidate = raw.id ?? raw.value ?? raw.record_id ?? raw.recordId;
      return getLookupIdValue(candidate);
    }
    return null;
  };

  const renderDetailCellValue = (
    raw: any,
    fallbackText: string,
    lookupType?: RecordType | string
  ) => {
    if (!lookupType) return fallbackText || '-';
    const resolvedId = getLookupIdValue(raw);
    if (!resolvedId) return fallbackText || '-';
    return (
      <RecordNameResolver
        id={resolvedId}
        type={lookupType}
        clickable={true}
        fallback={fallbackText || '-'}
        className="text-slate-700"
      />
    );
  };

  const renderPrescreenedCard = (c: PrescreenedCandidate) => {
    return (
      <div
        key={`pre-${c.id}`}
        draggable
        onClick={() => openJobSeekerProfilePage(c.id)}
        onDragStart={() =>
          setDragPayload({
            fromColumnId: "prescreened",
            candidate: c,
          })
        }
        className="w-full rounded-xl p-4 mb-3 bg-white border border-slate-200 flex flex-col items-center justify-center text-center cursor-pointer"
      >
        <button
          type="button"
          className="w-full text-center"
          onClick={(e) => {
            e.stopPropagation();
            handleViewCandidate(c.id);
          }}
        >
          <div className="text-slate-800 font-medium truncate">
            {c.name || `Record #${c.record_number ?? c.id}`}
          </div>

          <div className="text-slate-500 text-xs mt-0.5 truncate">
            {formatRecordId(c.record_number ?? c.id, 'jobSeeker')}
          </div>
        </button>

        <div className="mt-2 flex items-center justify-center text-teal-600">
          <TbBinoculars size={24} />
        </div>
      </div>
    );
  };

  const renderStageCard = (candidate: Candidate, fromColumnId: string) => (
    <div
      key={`${fromColumnId}-${candidate.id}-${candidate.applicationId ?? candidate.jobNumericId ?? 'nojob'}`}
      draggable
      onClick={() => openJobSeekerProfilePage(candidate.id)}
      onDragStart={() =>
        setDragPayload({
          fromColumnId,
          candidate,
        })
      }
      className="w-full rounded-xl p-4 mb-3 bg-white border border-slate-200 flex flex-col items-center justify-center text-center cursor-pointer"
    >
      <div>
        <button
          type="button"
          className="text-center w-full"
          onClick={(e) => {
            e.stopPropagation();
            handleViewCandidate(candidate.id);
          }}
        >
          <div className="text-slate-800 font-medium">
            {candidate.name}
          </div>
        </button>
        {candidate.jobId && candidate.jobNumericId ? (
          <button
            type="button"
            className="text-slate-500 text-xs mt-0.5 truncate hover:underline text-center"
            onClick={(e) => {
              e.stopPropagation();
              handleViewJob(candidate.jobNumericId);
            }}
          >
            <JobRecordNumber jobNumericId={Number(candidate.jobNumericId)} />
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-center text-teal-600">
        <TbBinoculars size={24} />
      </div>
    </div>
  );

  const anyLoading = loading || stageLoading;

  // Search filter: matches JS record number (e.g. "JS 5", "js5", "JS#5", "5") or J record number
  const matchesSearch = (query: string, candidate: PrescreenedCandidate | Candidate, isPrescreen: boolean): boolean => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (isPrescreen) {
      const c = candidate as PrescreenedCandidate;
      // Match by name
      if (c.name && c.name.toLowerCase().includes(query.trim().toLowerCase())) return true;
      // Match by JS record number — strip prefix variants: js, js#, js , j s, etc.
      const rn = String(c.record_number ?? c.id);
      const jsVariants = [`js${rn}`, `js${rn}`, rn];
      return jsVariants.some((v) => q === v || q.includes(v) || v.includes(q));
    } else {
      const c = candidate as Candidate;
      // Match by name
      if (c.name && c.name.toLowerCase().includes(query.trim().toLowerCase())) return true;
      // Match JS record number from id
      const jsId = String(c.id);
      const jsVariants = [`js${jsId}`, jsId];
      if (jsVariants.some((v) => q === v || q.includes(v) || v.includes(q))) return true;
      // Match J record number from jobId string (e.g. "J 5", "J5")
      if (c.jobId) {
        const jobIdStr = c.jobId.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (q === jobIdStr || jobIdStr.includes(q) || q.includes(jobIdStr)) return true;
      }
      // Match raw jobNumericId
      if (c.jobNumericId != null) {
        const jn = String(c.jobNumericId);
        const jVariants = [`j${jn}`, jn];
        if (jVariants.some((v) => q === v || q.includes(v) || v.includes(q))) return true;
      }
      return false;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
        aria-label="Close and return to home"
      >
        <FiX size={24} />
      </button>

      <div className="grow flex flex-col">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-2xl font-bold text-slate-800">Job Seeker Flow</h1>
          <p className="text-slate-600 text-sm mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
            Pipeline by stage — PreScreened shows your last 30 days.
          </p>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-6">
          <div className="flex gap-4 h-full min-h-[420px]">
            {columns.map((column) => (
              <div
                key={column.id}
                className="shrink-0 w-[280px] max-w-[280px] flex flex-col rounded-xl bg-white   border border-slate-200 overflow-y-auto max-h-[500px]"
              >
                <div className={`px-4 py-3 border-b ${column.accent} bg-white`}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-800 text-sm leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      {column.title}
                    </h2>
                    {column.count !== undefined && (
                      <span className="shrink-0 min-w-[28px] h-7 px-2 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center">
                        {anyLoading ? '…' : column.count}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search JS# or J#…"
                    value={columnSearch[column.id] ?? ''}
                    onChange={(e) => setColumnSearch((prev) => ({ ...prev, [column.id]: e.target.value }))}
                    className="mt-2 w-full text-xs px-2 py-1 border border-slate-200 rounded bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
                <div
                  className="flex-1 p-3 overflow-y-auto"
                  onDragOver={(e) => {
                    if (!dragPayload) return;
                    const from = dragPayload.fromColumnId;
                    const to = column.id;

                    const allowed =
                      (from === 'prescreened' && to === 'submitted') ||
                      (from === 'submitted' && to === 'client-submitted') ||
                      (from === 'client-submitted' && to === 'interviews') ||
                      (from === 'interviews' && to === 'offer');

                    if (allowed) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(e) => {
                    if (!dragPayload) return;
                    const from = dragPayload.fromColumnId;
                    const to = column.id;

                    if (from === 'prescreened' && to === 'submitted') {
                      e.preventDefault();
                      const source = dragPayload.candidate as PrescreenedCandidate;
                      openSubmissionModalFor(source);
                      setDragPayload(null);
                      return;
                    }

                    const candidate = dragPayload.candidate as Candidate;

                    if (from === 'submitted' && to === 'client-submitted') {
                      e.preventDefault();
                      openClientSubmissionModalFromBoard(candidate);
                      setDragPayload(null);
                      return;
                    }

                    if (from === 'client-submitted' && to === 'interviews') {
                      e.preventDefault();
                      goToInterviewPlannerFromBoard(candidate);
                      setDragPayload(null);
                      return;
                    }

                    if (from === 'interviews' && to === 'offer') {
                      e.preventDefault();
                      void extendOfferFromBoard(candidate);
                      setDragPayload(null);
                    }
                  }}
                >
                  {column.isPrescreenedColumn ? (
                    (() => {
                      const search = columnSearch[column.id] ?? '';
                      const filtered = (column.candidates as PrescreenedCandidate[]).filter(
                        (c) => matchesSearch(search, c, true)
                      );
                      if (filtered.length === 0 && !anyLoading) {
                        return (
                          <p className="text-slate-500 text-sm py-4 text-center">
                            {search ? 'No matches.' : 'No candidates prescreened by you in the last 30 days.'}
                          </p>
                        );
                      }
                      return filtered.map(renderPrescreenedCard);
                    })()
                  ) : (() => {
                    const search = columnSearch[column.id] ?? '';
                    const candidateList = column.candidates as Candidate[];
                    const filtered = candidateList.filter((c) => matchesSearch(search, c, false));
                    if (filtered.length === 0 && !anyLoading) {
                      if (search) {
                        return <p className="text-slate-400 text-sm py-4 text-center">No matches.</p>;
                      }
                      if (column.id === 'submitted') {
                        return (
                          <p className="text-slate-400 text-sm py-4 text-center">
                            No candidates submitted yet.
                          </p>
                        );
                      }
                      return (
                        <p className="text-slate-400 text-sm py-4 text-center">
                          No records yet.
                        </p>
                      );
                    }
                    return filtered.map((c) => renderStageCard(c, column.id));
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-white/90">
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-600 mb-1">Previous</div>
            <button
              onClick={handlePrevious}
              className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded-xl flex items-center justify-center transition-colors  "
            >
              <FiChevronLeft size={20} />
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-600 mb-1">Next</div>
          <button
            onClick={handleNext}
            className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded-xl flex items-center justify-center transition-colors  "
          >
            <FiChevronRight size={20} />
          </button>
        </div>
      </div>


      {
        modalCandidate && (
          <SubmissionFormModal
            open={Boolean(modalCandidate)}
            onClose={closeSubmissionModal}
            jobSeekerId={String(modalCandidate.id)}
            jobSeekerName={modalCandidate.name}
            jobSeekerRecordId={
              modalCandidate.record_number != null
                ? formatRecordId(modalCandidate.record_number, 'jobSeeker')
                : undefined
            }
            documents={[]}
            currentUserName={user?.name || ''}
            currentUserEmail={user?.email || ''}
            hasPrescreenNote={true}
            onSuccess={() => {
              closeSubmissionModal();
              setReloadKey((k) => k + 1);
            }}
          />
        )
      }

      {
        clientSubmissionContext && (
          <ClientSubmissionModal
            open={true}
            onClose={() => setClientSubmissionContext(null)}
            jobId={clientSubmissionContext.jobId}
            job={null}
            jobHiringManager={null}
            candidates={[
              {
                id: clientSubmissionContext.candidateId,
                name: clientSubmissionContext.candidateName,
              },
            ]}
            initialCandidate={{
              id: clientSubmissionContext.candidateId,
              name: clientSubmissionContext.candidateName,
            }}
            currentUserName={user?.name || ''}
            currentUserEmail={user?.email || ''}
            onSuccess={() => {
              setClientSubmissionContext(null);
              setReloadKey((k) => k + 1);
            }}
          />
        )
      }

      {
        showAddNote && pendingStatusChange && noteModalDefaults && (
          <AddNoteModal
            open={showAddNote}
            onClose={handleCloseAddNoteModal}
            entityType="job-seeker"
            entityId={String(pendingStatusChange.candidateId)}
            entityDisplay={
              noteModalDefaults.aboutReferences.find((ref) => ref.type === 'Job Seeker')
                ?.display
            }
            defaultAction={noteModalDefaults.action}
            defaultAboutReferences={noteModalDefaults.aboutReferences}
            onSuccess={async () => {
              if (
                pendingStatusChange &&
                pendingStatusChange.applicationId != null &&
                pendingStatusChange.candidateId != null
              ) {
                await updateApplicationStatusFromBoard(
                  pendingStatusChange.candidateId,
                  pendingStatusChange.applicationId,
                  pendingStatusChange.newStatus
                );
                setPendingStatusChange(null);
              }
            }}
          />
        )
      }
      {
        selectedJobSeekerId != null && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-400">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-400 bg-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <FiUser className="text-teal-700 shrink-0" size={16} />
                  <div className="text-base font-semibold text-slate-800 truncate">
                    {getJobSeekerProfileFullName() || (
                      <RecordNameResolver id={selectedJobSeekerId} type="job-seeker" clickable={false} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <button type="button" onClick={() => openPersonSearch('google')} aria-label="Search on Google">
                      <FcGoogle size={18} />
                    </button>
                    <button type="button" onClick={() => openPersonSearch('linkedin')} className="text-[#0A66C2]" aria-label="Search on LinkedIn">
                      <FaLinkedinIn size={16} />
                    </button>
                    <button type="button" onClick={() => openPersonSearch('facebook')} className="text-[#1877F2]" aria-label="Search on Facebook">
                      <FaFacebookF size={16} />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJobSeekerId(null)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
                  aria-label="Close candidate preview"
                >
                  <FiX size={16} />
                </button>
              </div>

              <div className="grid grid-cols-4 border-b border-slate-400 text-xs">
                {[
                  { label: 'ID', value: formatRecordId(selectedJobSeekerProfile?.record_number ?? selectedJobSeekerId, 'jobSeeker') },
                  { label: getJobSeekerFieldLabel('Field_1'), value: getJobSeekerFieldValueByFieldName('Field_1') || '-' },
                  { label: getJobSeekerFieldLabel('Field_3'), value: getJobSeekerFieldValueByFieldName('Field_3') || '-' },
                  { label: getJobSeekerFieldLabel('Field_11'), value: getJobSeekerFieldValueByFieldName('Field_11') || '-' },
                ].map((item) => (
                  <div key={item.label} className="border-r border-slate-300 last:border-r-0">
                    <div className="px-2 py-1 font-semibold text-slate-700 bg-slate-100">{item.label}</div>
                    <div className="px-2 py-1 text-slate-800 truncate">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2 border-b border-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedJobSeekerId;
                    setSelectedJobSeekerId(null);
                    router.push(`/dashboard/job-seekers/view?id=${id}`);
                  }}
                  className="px-5 py-1 rounded-full bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300"
                >
                  Open Full Profile
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 p-3">
                {(loadingJobSeekerProfile || loadingJobSeekerFieldLabels) ? (
                  <div className="text-sm text-slate-600">Loading details...</div>
                ) : (
                  <div className="border border-slate-300 bg-white">
                    <div className="px-3 py-2 text-sm font-semibold text-slate-700 border-b border-slate-300">Details</div>
                    {[
                      'Field_4',
                      'Field_5',
                      'Field_11',
                      'Field_8',
                      'Field_6',
                      'Field_69',
                      'Field_70',
                    ].map((fieldName) => {
                      const label = getJobSeekerFieldLabel(fieldName);
                      const value = getJobSeekerFieldValueByFieldName(fieldName);
                      const isStatus = fieldName === 'Field_4';
                      const isOrganizationLookup = fieldName === 'Field_5';
                      const isOwnerLookup = fieldName === 'Field_69';
                      return (
                        <div key={fieldName} className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200 last:border-b-0">
                          <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">{label}:</div>
                          <div className="px-3 py-2 text-slate-800">
                            {isStatus ? (
                              <FieldValueRenderer
                                value={value || ''}
                                fieldInfo={{ name: 'Field_4', label, fieldType: 'status' }}
                                entityType="job-seekers"
                                recordId={selectedJobSeekerId}
                              />
                            ) : (
                              <FieldValueRenderer
                                value={value || '-'}
                                fieldInfo={{
                                  name: fieldName,
                                  label,
                                  fieldType: isOrganizationLookup || isOwnerLookup ? 'lookup' : undefined,
                                  lookupType: isOrganizationLookup ? 'organization' : isOwnerLookup ? 'owner' : undefined,
                                }}
                                entityType="job-seekers"
                                recordId={selectedJobSeekerId}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 px-3 py-3 border-t border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => openAddInterviewAppointmentForJobSeeker(selectedJobSeekerId)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-1.5"
                >
                  Add Appt
                </button>
                <button
                  type="button"
                  onClick={() => openAddTaskForJobSeeker(selectedJobSeekerId)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-1.5"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )
      }
      {
        selectedJobId != null && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
            <div className="bg-white w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-400">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-400 bg-slate-100">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {formatRecordId(selectedJobProfile?.record_number ?? selectedJobId, 'job')}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {getJobFieldValueByFieldName('Field_1') || selectedJobProfile?.title || 'Job'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className='px-5 py-1 rounded-full bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300'
                    onClick={() => router.push(`/dashboard/jobs/view?id=${selectedJobId}`)}
                  >
                    Open full Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobProfileRefreshTick((v) => v + 1)}
                    className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
                    aria-label="Refresh job record"
                    title="Refresh"
                  >
                    <FiRefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJobId(null)}
                    className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
                    aria-label="Close job preview"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 p-3">
                {(loadingJobProfile || loadingJobFieldLabels) ? (
                  <div className="text-sm text-slate-600">Loading details...</div>
                ) : (
                  <div className="border border-slate-300 bg-white">
                    <div className="px-3 py-2 text-sm font-semibold text-slate-700 border-b border-slate-300">Details</div>
                    {[
                      'Field_4',
                      'Field_24',
                      '__EMPLOYMENT_TYPE__',
                      'Field_8',
                      '__FULL_ADDRESS__',
                      'Field_69',
                      'Field_70',
                      'Field_2',
                    ].map((fieldName: any) => {
                      if (fieldName === '__EMPLOYMENT_TYPE__') {
                        const employmentType = String(
                          selectedJobProfile?.employment_type ??
                          selectedJobProfile?.job_type ??
                          ''
                        ).trim();
                        return (
                          <div key={fieldName} className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200">
                            <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">Employment Type:</div>
                            <div className="px-3 py-2 text-slate-800">{employmentType || '-'}</div>
                          </div>
                        );
                      }
                      if (fieldName === '__FULL_ADDRESS__') {
                        const fullAddressLabel = [
                          getJobFieldLabel('Field_12'),
                          getJobFieldLabel('Field_13'),
                          getJobFieldLabel('Field_14'),
                          getJobFieldLabel('Field_15'),
                          getJobFieldLabel('Field_17'),
                        ].join(', ');
                        return (
                          <div key={fieldName} className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200">
                            <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">{fullAddressLabel}:</div>
                            <div className="px-3 py-2 text-slate-800">{getJobFullAddress() || '-'}</div>
                          </div>
                        );
                      }

                      const label = getJobFieldLabel(fieldName);
                      const value = getJobFieldValueByFieldName(fieldName);
                      const isStatus = fieldName === 'Field_4';
                      const isOwnerLookup = fieldName === 'Field_69';
                      const isOrganizationLookup = fieldName === 'Field_2';
                      return (
                        <div key={fieldName} className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200">
                          <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">{label}:</div>
                          <div className="px-3 py-2 text-slate-800">
                            {isStatus ? (
                              <FieldValueRenderer
                                value={value || ''}
                                fieldInfo={{ name: 'Field_4', label, fieldType: 'status', lookupType: 'jobs' }}
                                entityType="jobs"
                                recordId={selectedJobId}
                              />
                            ) : (
                              <FieldValueRenderer
                                value={value || '-'}
                                fieldInfo={{
                                  name: fieldName,
                                  label,
                                  fieldType: isOwnerLookup || isOrganizationLookup ? 'lookup' : undefined,
                                  lookupType: isOwnerLookup ? 'owner' : isOrganizationLookup ? 'organization' : undefined,
                                }}
                                entityType="jobs"
                                recordId={selectedJobId}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {hasHiringManagerLookup && (
                      <>
                        <div className="px-3 py-2 text-sm font-semibold text-slate-700 border-t border-slate-300 bg-slate-50">
                          Hiring Manager Details
                        </div>
                        {loadingHiringManagerContact ? (
                          <div className="px-3 py-2 text-xs text-slate-600">Loading contact details...</div>
                        ) : (
                          selectedHiringManagerProfile ? (
                            <>
                              <div className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200">
                                <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">
                                  {getJobFieldLabel('Field_22')}:
                                </div>
                                <div className="px-3 py-2 text-slate-800">
                                  {renderDetailCellValue(
                                    getJobFieldRawValueByFieldName('Field_22'),
                                    getJobFieldValueByFieldName('Field_22'),
                                    'hiring-managers'
                                  )}
                                </div>
                              </div>
                              {HIRING_MANAGER_CONTACT_FIELD_NAMES.map((fieldName) => {
                                const label = getHiringManagerFieldLabel(fieldName);
                                const value = getHiringManagerFieldValueByFieldName(fieldName);
                                const normalizedLabel = String(label || '').toLowerCase().trim();
                                const isEmailLikeLabel =
                                  normalizedLabel.includes('email') ||
                                  normalizedLabel.includes('e-mail');
                                const isEmailLikeValue =
                                  typeof value === 'string' &&
                                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
                                const isPrimaryEmail = fieldName === 'Field_16' || isEmailLikeLabel || isEmailLikeValue;
                                const isStatus = fieldName === 'Field_7' && !isPrimaryEmail;
                                const isOrganizationLookup = fieldName === 'Field_3';
                                const rawValue = getHiringManagerFieldRawValueByFieldName(fieldName);
                                return (
                                  <div key={fieldName} className="grid grid-cols-[220px_1fr] text-xs border-b border-slate-200 last:border-b-0">
                                    <div className="px-3 py-2 bg-slate-50 text-slate-600 font-medium">{label}:</div>
                                    <div className="px-3 py-2 text-slate-800">
                                      {isStatus ? (
                                        <FieldValueRenderer
                                          value={value || ''}
                                          fieldInfo={{ name: fieldName, label, fieldType: 'status' }}
                                          entityType="hiring-managers"
                                          recordId={selectedHiringManagerProfile?.id}
                                        />
                                      ) : (
                                        isOrganizationLookup ? renderDetailCellValue(rawValue, value, 'organization') : (
                                          isPrimaryEmail && value ? (
                                            <a
                                              href={`mailto:${String(value).trim()}`}
                                              className="text-blue-600 hover:underline break-all"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {value}
                                            </a>
                                          ) : (
                                            <FieldValueRenderer
                                              value={value || '-'}
                                              fieldInfo={{ name: fieldName, label }}
                                              entityType="hiring-managers"
                                              recordId={selectedHiringManagerProfile?.id}
                                            />
                                          )
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <div className="px-3 py-2 text-xs text-slate-600">Contact details unavailable.</div>
                          )
                        )}
                      </>
                    )}

                    <div className="px-3 py-2 text-sm font-semibold text-slate-700 border-t border-slate-300 bg-slate-50">
                      {getJobFieldLabel('Field_6')}
                    </div>
                    <div className="px-3 py-3 text-sm text-slate-800">
                      <FieldValueRenderer
                        value={getJobFieldValueByFieldName('Field_6') || '-'}
                        fieldInfo={{ name: 'Field_6', label: getJobFieldLabel('Field_6') }}
                        entityType="jobs"
                        recordId={selectedJobId}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
