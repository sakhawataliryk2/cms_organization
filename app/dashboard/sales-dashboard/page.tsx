'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { FiX, FiChevronLeft, FiEye } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import RecordNameResolver from '@/components/RecordNameResolver';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { getCustomFieldLabel } from '@/lib/getCustomFieldLabel';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import { getRecordNumberFromId } from '@/lib/getRecordNumberFromId';
import { BsFillBinocularsFill } from 'react-icons/bs';
import { Binoculars } from 'lucide-react';
import AddNoteModal from '@/components/AddNoteModal';
import ClientSubmissionModal from '@/components/ClientSubmissionModal';
import { useAuth } from '@/lib/auth';

interface ApplicationTile {
  id: number;
  jobSeekerId: number;
  jobId?: number;
  jobTitle: string;
  companyName: string;
  clientName?: string;
  status?: string;
  createdAt?: string;
  candidateId?: number;
}

interface Column {
  id: string;
  title: string;
  color: string;
  accent: string;
  applications: ApplicationTile[];
}

interface JobCard {
  jobId: number;
  jobTitle: string;
  companyDisplay: string;
  companyRefValue: string;
  applicationsInStatus: ApplicationTile[];
}

interface ModalContext {
  columnId: string;
  jobId: number;
}

const COLUMN_CONFIG: { id: string; title: string; color: string; accent: string }[] = [
  { id: 'submission', title: 'Submission', color: 'bg-green-50', accent: 'border-green-500' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-blue-50', accent: 'border-blue-500' },
  { id: 'interview', title: 'Interview', color: 'bg-emerald-100', accent: 'border-emerald-500' },
  { id: 'offer-extended', title: 'Offer Extended', color: 'bg-amber-100', accent: 'border-amber-500' },
  { id: 'placement', title: 'Placement', color: 'bg-teal-100', accent: 'border-teal-600' },
];

const APPLICATION_STATUS_OPTIONS = [
  'Submitted',
  'Client Submission',
  'Interview',
  'Client Rejected',
  'Job Seeker Withdrew',
  'Offer Extended',
  'Placed',
] as const;

const COLUMN_PRIORITY: string[] = [
  'placement',
  'offer-extended',
  'interview',
  'client-submitted',
  'submission',
];

const COLUMN_RANK: Record<string, number> = {
  submission: 1,
  'client-submitted': 2,
  interview: 3,
  'offer-extended': 4,
  placement: 5,
};

function appIdentityKey(app: ApplicationTile): string {
  const hasCandidateAndJob = app.jobSeekerId != null && app.jobId != null;
  if (hasCandidateAndJob) {
    return `candidate-job:${String(app.jobSeekerId)}:${String(app.jobId)}`;
  }
  if (app.id != null) return `app:${app.id}`;
  return `fallback:${String(app.jobSeekerId)}:${String(app.jobId ?? '')}:${String(app.id ?? '')}`;
}

function applyStagePriorityFiltering(
  sourceBoard: Record<string, ApplicationTile[]>
): Record<string, ApplicationTile[]> {
  const next: Record<string, ApplicationTile[]> = {
    submission: [],
    'client-submitted': [],
    interview: [],
    'offer-extended': [],
    placement: [],
  };

  const seen = new Set<string>();

  for (const columnId of COLUMN_PRIORITY) {
    const items = Array.isArray(sourceBoard[columnId]) ? sourceBoard[columnId] : [];
    items.forEach((app) => {
      const statusNorm = String(app.status || '').trim().toLowerCase();
      if (statusNorm === 'client rejected' || statusNorm === 'job seeker withdrew' || statusNorm === 'withdrew') {
        return;
      }
      const key = appIdentityKey(app);
      if (seen.has(key)) return;
      seen.add(key);
      next[columnId].push(app);
    });
  }

  return next;
}

function getColumnForStatus(status: unknown): keyof Record<string, ApplicationTile[]> | null {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'submission';
  if (normalized === 'client rejected' || normalized === 'job seeker withdrew' || normalized === 'withdrew') {
    return null;
  }
  if (normalized === 'placed' || normalized === 'placement' || normalized === 'starting' || normalized === 'assignment') {
    return 'placement';
  }
  if (normalized === 'offer extended') return 'offer-extended';
  if (normalized === 'interview') return 'interview';
  if (normalized === 'client submission' || normalized === 'client submitted') return 'client-submitted';
  if (normalized === 'submission' || normalized === 'submitted') return 'submission';
  return 'submission';
}

function normalizeBoardByStatus(
  incomingBoard: Record<string, ApplicationTile[]>
): Record<string, ApplicationTile[]> {
  const next: Record<string, ApplicationTile[]> = {
    submission: [],
    'client-submitted': [],
    interview: [],
    'offer-extended': [],
    placement: [],
  };

  const bestByIdentity = new Map<string, { rank: number; app: ApplicationTile; columnId: string }>();

  Object.values(incomingBoard).forEach((apps) => {
    (Array.isArray(apps) ? apps : []).forEach((app) => {
      const columnId = getColumnForStatus(app?.status);
      if (!columnId) return;
      const key = appIdentityKey(app);
      const rank = COLUMN_RANK[columnId] ?? 0;
      const existing = bestByIdentity.get(key);
      if (!existing || rank > existing.rank) {
        bestByIdentity.set(key, { rank, app, columnId });
      }
    });
  });

  bestByIdentity.forEach(({ app, columnId }) => {
    next[columnId].push(app);
  });

  return next;
}

function normalizePayload(data: any) {
  if (!data || typeof data !== 'object') return null;
  return data.job || data.jobSeeker || data.data || data;
}

function extractCustomFieldsRecord(payload: any): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const direct = payload.customFields || payload.custom_fields;
  if (direct && typeof direct === 'object') return direct;
  const nested = payload.data;
  if (nested && typeof nested === 'object') {
    return (
      nested.customFields ||
      nested.custom_fields ||
      {}
    );
  }
  return {};
}

function getCustomFieldValueByLabel(customFields: Record<string, any>, label?: string | null, fallbackFieldName?: string) {
  if (!customFields || typeof customFields !== 'object') return '';
  if (label) {
    if (customFields[label] != null) return String(customFields[label]).trim();
    const lowered = label.trim().toLowerCase();
    for (const key of Object.keys(customFields)) {
      if (key.trim().toLowerCase() === lowered && customFields[key] != null) {
        return String(customFields[key]).trim();
      }
    }
  }
  if (fallbackFieldName && customFields[fallbackFieldName] != null) {
    return String(customFields[fallbackFieldName]).trim();
  }
  return '';
}

const JobStatusCard = memo(function JobStatusCard({
  card,
  columnId,
  onOpenApplications,
  onOpenJob,
  onOpenOrganization,
  jobRecordNumber,
}: {
  card: JobCard;
  columnId: string;
  onOpenApplications: (card: JobCard, columnId: string) => void;
  onOpenJob: (jobId: number) => void;
  onOpenOrganization: (organizationId: string) => void;
  jobRecordNumber?: number | null;
}) {
  return (
    <div className="rounded-2xl px-5 py-4 border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors w-full min-h-[160px] flex flex-col justify-between items-center text-center">

      {/* Company Name */}
      <div>
        <RecordNameResolver id={card.companyRefValue} type="organization" clickable />
      </div>

      {/* Job ID */}
      <div>
        <button
          type="button"
          className="text-base font-semibold text-slate-800 hover:underline"
        >
          Job ID #{jobRecordNumber ?? card.jobId}
        </button>
      </div>

      {/* Job Title */}
      <div>
        <RecordNameResolver id={card.jobId} type="job" clickable />
      </div>

      {/* View Applications */}
      <div className="flex items-center justify-center mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenApplications(card, columnId);
          }}
          className="p-2 rounded-full hover:bg-slate-100 transition"
          aria-label="Open applications in this status"
        >
          <Binoculars className="text-slate-600" size={18} />
        </button>
      </div>
    </div>
  );
});

const DroppableColumn = memo(function DroppableColumn({
  column,
  onOpenApplications,
  onOpenJob,
  onOpenOrganization,
  jobRecordNumbers,
}: {
  column: Omit<Column, 'applications'> & { jobs: JobCard[] };
  onOpenApplications: (card: JobCard, columnId: string) => void;
  onOpenJob: (jobId: number) => void;
  onOpenOrganization: (organizationId: string) => void;
  jobRecordNumbers: Record<number, number | null>;
}) {
  return (
    <div
      className="shrink-0 w-[300px] flex flex-col rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden"
    >
      <div className={`px-4 py-3 border-b-2 ${column.accent} bg-white`}>
        <h2 className="font-semibold text-slate-800 text-sm">
          {column.title} ({column.jobs.length})
        </h2>
      </div>
      <div className={`flex-1 bg-slate-50/50 p-3 overflow-y-auto space-y-3 min-h-[120px] ${column.color}`}>
        {column.jobs.map((card) => (
          <JobStatusCard
            key={`${column.id}-${card.jobId}`}
            card={card}
            columnId={column.id}
            onOpenApplications={onOpenApplications}
            onOpenJob={onOpenJob}
            onOpenOrganization={onOpenOrganization}
            jobRecordNumber={jobRecordNumbers[card.jobId]}
          />
        ))}
      </div>
    </div>
  );
});

export default function SalesDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [board, setBoard] = useState<Record<string, JobCard[]>>({
    submission: [],
    'client-submitted': [],
    interview: [],
    'offer-extended': [],
    placement: [],
  });
  const [rawBoard, setRawBoard] = useState<Record<string, ApplicationTile[]>>({
    submission: [],
    'client-submitted': [],
    interview: [],
    'offer-extended': [],
    placement: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [previewContext, setPreviewContext] = useState<ModalContext | null>(null);
  const [jobCompanyFieldLabel, setJobCompanyFieldLabel] = useState<string>('');
  const [jobSeekerStatusFieldLabel, setJobSeekerStatusFieldLabel] = useState<string>('');
  const [jobCompanyByJobId, setJobCompanyByJobId] = useState<Record<number, { display: string; ref: string }>>({});
  const [jobRecordNumbers, setJobRecordNumbers] = useState<Record<number, number | null>>({});
  const [jobSeekerStatusById, setJobSeekerStatusById] = useState<Record<number, string>>({});
  const [loadingModalStatuses, setLoadingModalStatuses] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    candidateId: number | string;
    applicationId: number | string;
    newStatus: string;
  } | null>(null);
  const [noteModalDefaults, setNoteModalDefaults] = useState<{
    action?: string;
    aboutReferences?: {
      id: string;
      type: string;
      display: string;
      value: string;
    }[];
  } | null>(null);
  const [showClientSubmissionModal, setShowClientSubmissionModal] = useState(false);
  const [clientSubmissionCandidate, setClientSubmissionCandidate] = useState<any | null>(null);
  const [clientSubmissionJob, setClientSubmissionJob] = useState<any | null>(null);

  const buildJobBoard = useCallback(
    (
      sourceBoard: Record<string, ApplicationTile[]>,
      companyMap: Record<number, { display: string; ref: string }>
    ): Record<string, JobCard[]> => {
      const result: Record<string, JobCard[]> = {
        submission: [],
        'client-submitted': [],
        interview: [],
        'offer-extended': [],
        placement: [],
      };

      for (const config of COLUMN_CONFIG) {
        const apps = Array.isArray(sourceBoard[config.id]) ? sourceBoard[config.id] : [];
        const grouped = new Map<number, JobCard>();
        apps.forEach((app) => {
          if (!app.jobId) return;
          const existing = grouped.get(app.jobId);
          if (!existing) {
            const companyInfo = companyMap[app.jobId];
            grouped.set(app.jobId, {
              jobId: app.jobId,
              jobTitle: app.jobTitle || '—',
              companyDisplay: companyInfo?.display || app.companyName || 'Company —',
              companyRefValue: companyInfo?.ref || '',
              applicationsInStatus: [app],
            });
          } else {
            existing.applicationsInStatus.push(app);
          }
        });
        result[config.id] = Array.from(grouped.values());
      }
      return result;
    },
    []
  );

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/job-seekers/applications/board');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load board');
      const incomingBoard = data?.board && typeof data.board === 'object' ? data.board : {};
      const normalizedRaw: Record<string, ApplicationTile[]> = {
        submission: Array.isArray(incomingBoard.submission) ? incomingBoard.submission : [],
        'client-submitted': Array.isArray(incomingBoard['client-submitted']) ? incomingBoard['client-submitted'] : [],
        interview: Array.isArray(incomingBoard.interview) ? incomingBoard.interview : [],
        'offer-extended': Array.isArray(incomingBoard['offer-extended']) ? incomingBoard['offer-extended'] : [],
        placement: Array.isArray(incomingBoard.placement) ? incomingBoard.placement : [],
      };
      const statusNormalizedBoard = normalizeBoardByStatus(normalizedRaw);
      setRawBoard(applyStagePriorityFiltering(statusNormalizedBoard));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
      toast.error(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jobLabel, seekerLabel] = await Promise.all([
          getCustomFieldLabel('jobs', 'Field_2'),
          getCustomFieldLabel('job-seekers', 'Field_4'),
        ]);
        if (cancelled) return;
        setJobCompanyFieldLabel(jobLabel || '');
        setJobSeekerStatusFieldLabel(seekerLabel || '');
      } catch {
        if (cancelled) return;
        setJobCompanyFieldLabel('');
        setJobSeekerStatusFieldLabel('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    setBoard(buildJobBoard(rawBoard, jobCompanyByJobId));
  }, [rawBoard, jobCompanyByJobId, buildJobBoard]);

  useEffect(() => {
    const jobIds = new Set<number>();
    Object.values(rawBoard).forEach((apps) => {
      apps.forEach((app) => {
        if (app.jobId) jobIds.add(app.jobId);
      });
    });
    const missing = Array.from(jobIds).filter((id) => !jobCompanyByJobId[id]);
    if (missing.length === 0) {
      setBoard(buildJobBoard(rawBoard, jobCompanyByJobId));
      return;
    }
    let cancelled = false;
    (async () => {
      const nextMap: Record<number, { display: string; ref: string }> = {};
      await Promise.all(
        missing.map(async (jobId) => {
          try {
            const res = await fetch(`/api/jobs/${jobId}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const payload = normalizePayload(data);
            const customFields = extractCustomFieldsRecord(payload);
            const fieldValue = getCustomFieldValueByLabel(customFields, jobCompanyFieldLabel, 'Field_2');
            nextMap[jobId] = {
              display: fieldValue || String(payload?.organization_name || payload?.company_name || ''),
              ref: fieldValue || '',
            };
          } catch {
            // Ignore per-item fetch errors.
          }
        })
      );
      if (cancelled) return;
      setJobCompanyByJobId((prev) => {
        const merged = { ...prev, ...nextMap };
        setBoard(buildJobBoard(rawBoard, merged));
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rawBoard, jobCompanyFieldLabel, jobCompanyByJobId, buildJobBoard]);

  useEffect(() => {
    const jobIds = new Set<number>();
    Object.values(rawBoard).forEach((apps) => {
      apps.forEach((app) => {
        if (app.jobId) jobIds.add(app.jobId);
      });
    });
    const missing = Array.from(jobIds).filter((id) => !(id in jobRecordNumbers));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<number, number | null> = {};
      await Promise.all(
        missing.map(async (jobId) => {
          const recordNumber = await getRecordNumberFromId(jobId, 'job');
          updates[jobId] = recordNumber;
        })
      );
      if (cancelled) return;
      setJobRecordNumbers((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [rawBoard, jobRecordNumbers]);

  const columns: Array<Omit<Column, 'applications'> & { jobs: JobCard[] }> = useMemo(
    () =>
      COLUMN_CONFIG.map((config) => ({
        ...config,
        jobs: board[config.id] ?? [],
      })),
    [board]
  );

  const handleClose = () => router.push('/home');
  const handlePrevious = () => router.push('/dashboard/candidate-flow');
  const handleOpenJob = useCallback(
    (jobId: number) => {
      setSelectedJobId(jobId);
    },
    []
  );

  const handleOpenOrganization = useCallback(
    (organizationId: string) => {
      if (!organizationId) return;
      router.push(`/dashboard/organizations/view?id=${encodeURIComponent(organizationId)}`);
    },
    [router]
  );

  const handleOpenApplications = useCallback((card: JobCard, columnId: string) => {
    setPreviewContext({ columnId, jobId: card.jobId });
  }, []);

  const previewCard = useMemo(() => {
    if (!previewContext) return null;
    return (board[previewContext.columnId] || []).find((card) => card.jobId === previewContext.jobId) || null;
  }, [previewContext, board]);

  const candidatesForClientSubmission = useMemo(() => {
    if (!previewCard) return [];
    const seen = new Set<string>();
    const out: Array<{ id: number; name: string }> = [];
    previewCard.applicationsInStatus.forEach((app) => {
      const key = String(app.jobSeekerId);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        id: app.jobSeekerId,
        name: `Job Seeker #${app.jobSeekerId}`,
      });
    });
    return out;
  }, [previewCard]);

  useEffect(() => {
    if (!previewCard) return;
    const missingIds = previewCard.applicationsInStatus
      .map((app) => app.jobSeekerId)
      .filter((id) => id != null && !jobSeekerStatusById[id]);
    if (missingIds.length === 0) return;
    let cancelled = false;
    setLoadingModalStatuses(true);
    (async () => {
      const updates: Record<number, string> = {};
      await Promise.all(
        missingIds.map(async (jobSeekerId) => {
          try {
            const res = await fetch(`/api/job-seekers/${jobSeekerId}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const payload = normalizePayload(data);
            const customFields = extractCustomFieldsRecord(payload);
            const value = getCustomFieldValueByLabel(customFields, jobSeekerStatusFieldLabel, 'Field_4');
            updates[jobSeekerId] = value;
          } catch {
            // Ignore per-item failures.
          }
        })
      );
      if (cancelled) return;
      setJobSeekerStatusById((prev) => ({ ...prev, ...updates }));
      setLoadingModalStatuses(false);
    })();
    return () => {
      cancelled = true;
      setLoadingModalStatuses(false);
    };
  }, [previewCard, jobSeekerStatusById, jobSeekerStatusFieldLabel]);

  const updateApplicationStatus = useCallback(
    async (jobSeekerId: number | string, applicationId: number | string, newStatus: string) => {
      try {
        const res = await fetch(
          `/api/job-seekers/${jobSeekerId}/applications/${applicationId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
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
        await fetchBoard();
      } catch (err) {
        console.error('Error updating application status:', err);
        toast.error('Failed to update status');
      }
    },
    [fetchBoard]
  );

  const handleApplicationStatusChange = useCallback(
    async (app: ApplicationTile, newStatus: string) => {
      const applicationId = app.id;
      const jobSeekerId = app.jobSeekerId;
      const effectiveJobId = app.jobId ?? previewCard?.jobId;

      if (newStatus === 'Client Submission') {
        setClientSubmissionCandidate({
          id: jobSeekerId,
          name: `Job Seeker #${jobSeekerId}`,
          rawApplication: app,
        });
        if (effectiveJobId) {
          try {
            const jobRes = await fetch(`/api/jobs/${effectiveJobId}`);
            const jobData = await jobRes.json().catch(() => ({}));
            if (jobRes.ok) {
              setClientSubmissionJob(jobData?.job ?? jobData?.data ?? jobData);
            } else {
              setClientSubmissionJob(null);
            }
          } catch {
            setClientSubmissionJob(null);
          }
        }
        setShowClientSubmissionModal(true);
        return;
      }

      if (newStatus === 'Interview') {
        const params = new URLSearchParams();
        params.set('addAppointment', '1');
        params.set('participantType', 'job_seeker');
        params.set('participantId', String(jobSeekerId));
        if (effectiveJobId) params.set('jobId', String(effectiveJobId));
        params.set('appointmentType', 'Interview');
        params.set('applicationId', String(applicationId));
        params.set('candidateId', String(jobSeekerId));
        router.push(`/dashboard/planner?${params.toString()}`);
        return;
      }

      if (newStatus === 'Placed' || newStatus === 'Placement') {
        const params = new URLSearchParams();
        if (effectiveJobId) params.set('jobId', String(effectiveJobId));
        params.set('jobSeekerId', String(jobSeekerId));
        router.push(`/dashboard/placements/add?${params.toString()}`);
        return;
      }

      if (
        newStatus === 'Job Seeker Withdrew' ||
        newStatus === 'Client Rejected' ||
        newStatus === 'Offer Extended'
      ) {
        setPendingStatusChange({
          candidateId: jobSeekerId,
          applicationId,
          newStatus,
        });

        const refs: {
          id: string;
          type: string;
          display: string;
          value: string;
        }[] = [];

        if (effectiveJobId) {
          const jobRecord = jobRecordNumbers[effectiveJobId] ?? effectiveJobId;
          const jobDisplay = `${formatRecordId(jobRecord, 'job')} ${previewCard?.jobTitle || ''}`.trim();
          refs.push({
            id: String(effectiveJobId),
            type: 'Job',
            display: jobDisplay,
            value: jobDisplay,
          });
        }

        const jsDisplay = `${formatRecordId(jobSeekerId, 'jobSeeker')} Job Seeker #${jobSeekerId}`;
        refs.push({
          id: String(jobSeekerId),
          type: 'Job Seeker',
          display: jsDisplay,
          value: jsDisplay,
        });

        setNoteModalDefaults({
          action: newStatus,
          aboutReferences: refs,
        });
        setShowAddNote(true);
        return;
      }

      await updateApplicationStatus(jobSeekerId, applicationId, newStatus);
    },
    [previewCard, router, jobRecordNumbers, updateApplicationStatus]
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
        aria-label="Close and return to home"
      >
        <FiX size={24} />
      </button>

      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-slate-800">Sales Dashboard</h1>
        <p className="text-slate-600 text-sm mt-0.5">
          Applications by stage grouped as job cards.
        </p>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>

      <div className="grow overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600">
            Loading...
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max pb-4">
            {columns.map((column) => (
              <DroppableColumn
                key={column.id}
                column={column}
                onOpenApplications={handleOpenApplications}
                onOpenJob={handleOpenJob}
                onOpenOrganization={handleOpenOrganization}
                jobRecordNumbers={jobRecordNumbers}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-white/90">
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-600 mb-1">Previous</div>
            <button
              onClick={handlePrevious}
              className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              <FiChevronLeft size={20} />
            </button>
          </div>
        </div>
      </div>

      {selectedJobId != null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-100">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">
                  Job Preview
                </span>
                <span className="text-xs text-slate-500">
                  {formatRecordId(selectedJobId, 'job')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobId(null)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
                aria-label="Close job preview"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-sm text-slate-600">
                Job order details are managed in the Job record.
              </p>
              <button
                type="button"
                onClick={() => {
                  const id = selectedJobId;
                  setSelectedJobId(null);
                  router.push(`/dashboard/jobs/view?id=${id}`);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
              >
                <FiEye size={16} />
                Open Job Order
              </button>
            </div>
          </div>
        </div>
      )}

      {previewContext != null && previewCard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
            {/* <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-100">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">
                  {previewCard.jobTitle || 'Job'}
                </span>
                <span className="text-xs text-slate-500">
                  {COLUMN_CONFIG.find((c) => c.id === previewContext.columnId)?.title || 'Status'} •{' '}
                  {previewCard.applicationsInStatus.length} application{previewCard.applicationsInStatus.length === 1 ? '' : 's'}
                </span>
              </div>

            </div> */}
            <div className="flex-1 overflow-auto p-4 relative">
              <div className="flex justify-end relative">
                <button
                  type="button"
                  onClick={() => setPreviewContext(null)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-600 absolute top-4 right-4"
                  aria-label="Close applications preview"
                >
                  <FiX size={18} />
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left p-2 font-semibold text-slate-700">Candidate Name</th>
                      <th className="text-left p-2 font-semibold text-slate-700">Submission Date</th>
                      <th className="text-left p-2 font-semibold text-slate-700">Client Status</th>
                      <th className="text-left p-2 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCard.applicationsInStatus.map((app) => (
                      <tr key={`${app.id}-${app.jobSeekerId}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="p-2">
                          <RecordNameResolver id={app.jobSeekerId} type="job-seeker" clickable />
                        </td>
                        <td className="p-2">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-2">
                          {loadingModalStatuses && !jobSeekerStatusById[app.jobSeekerId] ? (
                            <span className="text-slate-500">Loading...</span>
                          ) : (
                            <FieldValueRenderer
                              value={jobSeekerStatusById[app.jobSeekerId] || '—'}
                              fieldInfo={{
                                fieldType: 'status',
                                label: jobSeekerStatusFieldLabel || 'Status',
                                name: 'Field_4',
                                key: 'Field_4',
                              }}
                              entityType="job-seekers"
                              recordId={app.jobSeekerId}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <select
                            value={app.status || 'Submitted'}
                            onChange={(e) => void handleApplicationStatusChange(app, e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                          >
                            {APPLICATION_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClientSubmissionModal && (
        <ClientSubmissionModal
          open={showClientSubmissionModal}
          onClose={() => {
            setShowClientSubmissionModal(false);
            setClientSubmissionCandidate(null);
            setClientSubmissionJob(null);
          }}
          jobId={previewCard?.jobId ?? clientSubmissionJob?.id ?? null}
          job={clientSubmissionJob ?? null}
          jobHiringManager={null}
          candidates={candidatesForClientSubmission}
          initialCandidate={clientSubmissionCandidate}
          currentUserName={user?.name || ''}
          currentUserEmail={user?.email || ''}
          onSuccess={() => {
            void fetchBoard();
            setShowClientSubmissionModal(false);
          }}
        />
      )}

      {showAddNote && (
        <AddNoteModal
          open={showAddNote}
          onClose={() => {
            setShowAddNote(false);
            setNoteModalDefaults(null);
          }}
          entityType="job"
          entityId={String(previewCard?.jobId ?? '')}
          entityDisplay={previewCard?.jobTitle || `Job #${previewCard?.jobId ?? ''}`}
          defaultAction={noteModalDefaults?.action}
          defaultAboutReferences={noteModalDefaults?.aboutReferences}
          onSuccess={() => {
            if (pendingStatusChange?.applicationId != null) {
              void updateApplicationStatus(
                pendingStatusChange.candidateId,
                pendingStatusChange.applicationId,
                pendingStatusChange.newStatus
              );
              setPendingStatusChange(null);
            }
            setShowAddNote(false);
            setNoteModalDefaults(null);
          }}
        />
      )}
    </div>
  );
}
