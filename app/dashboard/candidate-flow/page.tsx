// File: app/dashboard/candidate-flow/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiEye, FiX, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import SubmissionFormModal from '@/components/SubmissionFormModal';
import ClientSubmissionModal from '@/components/ClientSubmissionModal';
import AddNoteModal from '@/components/AddNoteModal';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { toast } from 'sonner';
import { getRecordNumberFromId } from '@/lib/getRecordNumberFromId';
import RecordNameResolver from '@/components/RecordNameResolver';

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

interface DragPayload {
  fromColumnId: string;
  candidate: PrescreenedCandidate | Candidate;
}

const PLACEHOLDER_COLUMNS: Omit<CandidateColumn, 'candidates' | 'count'>[] = [
  { id: 'submitted', title: 'Job Seekers Submitted', color: 'bg-slate-100', accent: 'border-slate-400' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-emerald-50', accent: 'border-emerald-400' },
  { id: 'interviews', title: 'Job Seekers with Interviews', color: 'bg-amber-50', accent: 'border-amber-400' },
  { id: 'offer', title: 'Job Seekers with Offer', color: 'bg-teal-50', accent: 'border-teal-400' },
  { id: 'starting', title: 'Job Seekers Starting', color: 'bg-sky-50', accent: 'border-sky-400' },
  { id: 'assignment', title: 'Job Seekers on Assignment', color: 'bg-violet-50', accent: 'border-violet-400' },
];

/** Fetches and displays job record number in client-safe way (useEffect). */
function JobRecordNumber({ jobNumericId }: { jobNumericId: number }) {
  const [recordNumber, setRecordNumber] = useState<number | null>(null);
  useEffect(() => {
    if (!jobNumericId || jobNumericId < 1) return;
    let cancelled = false;
    getRecordNumberFromId(jobNumericId, 'job').then((num) => {
      if (!cancelled && num != null) setRecordNumber(num);
    });
    return () => { cancelled = true; };
  }, [jobNumericId]);
  const display = recordNumber ?? jobNumericId;
  return <>{formatRecordId(display, 'job')}</>;
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

          // Exclude from all stages from Submitted through Assignment if Withdrew or Client rejected
          const hasWithdrew =
            apps.some((a: any) => normalizeStatus(a?.status) === 'withdrew') ||
            clientSubs.some((cs: any) => normalizeStatus(cs?.status) === 'withdrew');
          const hasClientRejected =
            apps.some((a: any) => normalizeStatus(a?.status) === 'client rejected') ||
            clientSubs.some((cs: any) => normalizeStatus(cs?.status) === 'client rejected');
          if (hasWithdrew || hasClientRejected) {
            return;
          }

          const getJobIdFromRecord = (record: any) => {
            if (!record) return null;
            return (
              record.job_id ??
              record.jobId ??
              record.job_id_id ??
              record.id ??
              null
            );
          };

          // Helper to build job label from a record that may have job_id/job_title
          const buildJobLabel = (record: any) => {
            if (!record) return '';
            if (record.job_id != null || record.jobId != null || record.job_id_id != null) {
              const rawId = record.job_id ?? record.jobId ?? record.job_id_id;
              return formatRecordId(rawId, 'job');
            }
            if (record.record_number != null) {
              return formatRecordId(record.record_number, 'job');
            }
            return record.job_title || '';
          };

          // Find applications by priority status (support both legacy and current labels)
          const appWithOffer = apps.find(
            (a: any) => normalizeStatus(a?.status) === 'offer extended'
          );
          const appWithInterview = apps.find(
            (a: any) => normalizeStatus(a?.status) === 'interview'
          );
          const appWithClientStatus = apps.find((a: any) => {
            const s = normalizeStatus(a?.status);
            return s === 'client submission' || s === 'client submitted';
          });
          const clientSubWithClientStatus = clientSubs.find((cs: any) => {
            const s = normalizeStatus(cs?.status);
            return s === 'client submission' || s === 'client submitted';
          });

          // 1) Highest priority: any application with Offer Extended
          if (appWithOffer) {
            nextOffer.push({
              id: c.id,
              name: c.name,
              jobId: buildJobLabel(appWithOffer),
              applicationId: appWithOffer.id,
              jobNumericId: getJobIdFromRecord(appWithOffer),
            });
            return;
          }

          // 2) Next: any application with Interview
          if (appWithInterview) {
            nextInterview.push({
              id: c.id,
              name: c.name,
              jobId: buildJobLabel(appWithInterview),
              applicationId: appWithInterview.id,
              jobNumericId: getJobIdFromRecord(appWithInterview),
            });
            return;
          }

          // 3) Next: any client submission *with Client Submission status* OR application with Client Submission status
          if (clientSubWithClientStatus || appWithClientStatus) {
            const source = appWithClientStatus || clientSubWithClientStatus;
            nextClientSubmitted.push({
              id: c.id,
              name: c.name,
              jobId: buildJobLabel(source),
              applicationId: source?.application_id ?? source?.applicationId ?? null,
              jobNumericId: getJobIdFromRecord(source),
            });
            return;
          }

          // 4) If there are client submissions but none are yet marked Client Submission,
          // treat them as generic Submitted (e.g. first-time submission from Prescreen).
          if (apps.length === 0 && clientSubs.length > 0) {
            const source = clientSubs[0];
            nextSubmitted.push({
              id: c.id,
              name: c.name,
              jobId: buildJobLabel(source),
              applicationId: source?.application_id ?? source?.applicationId ?? null,
              jobNumericId: getJobIdFromRecord(source),
            });
            return;
          }

          // 5) Fallback: they have applications but none of the above statuses → generic Submitted
          const latestApp = [...apps].sort(
            (a: any, b: any) =>
              new Date(b?.created_at || 0).getTime() -
              new Date(a?.created_at || 0).getTime()
          )[0];

          nextSubmitted.push({
            id: c.id,
            name: c.name,
            jobId: buildJobLabel(latestApp),
            applicationId: latestApp?.id,
            jobNumericId: getJobIdFromRecord(latestApp),
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

  const renderPrescreenedCard = (c: PrescreenedCandidate) => {
    return (
      <div
        key={c.id}
        draggable
        onDragStart={() =>
          setDragPayload({
            fromColumnId: "prescreened",
            candidate: c,
          })
        }
        className="w-full rounded-xl p-4 mb-3 bg-white border border-slate-200 shadow-sm flex flex-col justify-between cursor-move"
      >
        <button
          type="button"
          className="text-left"
          onClick={() => handleViewCandidate(c.id)}
        >
          <div className="text-slate-800 font-medium truncate">
            {c.name || `Record #${c.record_number ?? c.id}`}
          </div>

          <div className="text-slate-500 text-xs mt-0.5 truncate">
            {formatRecordId(c.record_number ?? c.id, 'jobSeeker')}
          </div>
        </button>
  
        <div className="mt-2 flex items-center justify-end text-teal-600 text-xs font-medium gap-1">
          <FiEye size={14} />
          <span>Preview</span>
        </div>
      </div>
    );
  };

  const renderStageCard = (candidate: Candidate, fromColumnId: string) => (
    <div
      key={candidate.id}
      draggable
      onDragStart={() =>
        setDragPayload({
          fromColumnId,
          candidate,
        })
      }
      className="w-full rounded-xl p-4 mb-3 bg-white border border-slate-200 shadow-sm flex flex-col justify-between cursor-move"
    >
      <div>
        <button
          type="button"
          className="text-left w-full"
          onClick={() => handleViewCandidate(candidate.id)}
        >
          <div className="text-slate-800 font-medium truncate">
            {candidate.name}
          </div>
        </button>
        {candidate.jobId && candidate.jobNumericId ? (
          <button
            type="button"
            className="text-slate-500 text-xs mt-0.5 truncate hover:underline"
            onClick={() => handleViewJob(candidate.jobNumericId)}
          >
            <JobRecordNumber jobNumericId={Number(candidate.jobNumericId)} />
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-end text-teal-600 text-xs font-medium gap-1">
        <FiEye size={14} />
        <span>Preview</span>
      </div>
    </div>
  );

  const anyLoading = loading || stageLoading;

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
              className="shrink-0 w-[280px] max-w-[280px] flex flex-col rounded-xl bg-white shadow-sm border border-slate-200 overflow-y-auto max-h-[500px]"
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
                  (column.candidates as PrescreenedCandidate[]).length === 0 && !anyLoading ? (
                    <p className="text-slate-500 text-sm py-4 text-center">
                      No candidates prescreened by you in the last 30 days.
                    </p>
                  ) : (
                    (column.candidates as PrescreenedCandidate[]).map(renderPrescreenedCard)
                  )
                ) : (() => {
                  const candidateList = column.candidates as Candidate[];
                  if (candidateList.length === 0 && !anyLoading) {
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
                  return candidateList.map((c) => renderStageCard(c, column.id));
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
              className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              <FiChevronLeft size={20} />
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-600 mb-1">Next</div>
          <button
            onClick={handleNext}
            className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm"
          >
            <FiChevronRight size={20} />
          </button>
        </div>
      </div>

      {modalCandidate && (
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
      )}

      {clientSubmissionContext && (
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
      )}

      {showAddNote && pendingStatusChange && noteModalDefaults && (
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
      )}
      {selectedJobSeekerId != null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-100">
              <div className="flex items-center gap-2">
                <FiUser className="text-slate-700" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">
                    <RecordNameResolver
                      id={selectedJobSeekerId}
                      type="job-seeker"
                      clickable={false}
                    />
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatRecordId(selectedJobSeekerId, 'jobSeeker')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobSeekerId(null)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
                aria-label="Close candidate preview"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-sm text-slate-600">
                Full candidate details are available in the Job Seeker record.
              </p>
              <button
                type="button"
                onClick={() => {
                  const id = selectedJobSeekerId;
                  setSelectedJobSeekerId(null);
                  router.push(`/dashboard/job-seekers/view?id=${id}`);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
              >
                <FiEye size={16} />
                Open Full Profile
              </button>
            </div>
          </div>
        </div>
      )}
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
                Full job details are available in the Job record.
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
    </div>
  );
}
