// File: app/dashboard/candidate-flow/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiEye, FiX, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import SubmissionFormModal from '@/components/SubmissionFormModal';
import { formatRecordId } from '@/lib/recordIdFormatter';

interface PrescreenedCandidate {
  id: number;
  name: string;
  record_number: number | null;
  latest_prescreen_at: string;
}

interface Candidate {
  id: number;
  name: string;
  jobId: string;
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

const PLACEHOLDER_COLUMNS: Omit<CandidateColumn, 'candidates' | 'count'>[] = [
  { id: 'submitted', title: 'Job Seekers Submitted', color: 'bg-slate-100', accent: 'border-slate-400' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-emerald-50', accent: 'border-emerald-400' },
  { id: 'interviews', title: 'Job Seekers with Interviews', color: 'bg-amber-50', accent: 'border-amber-400' },
  { id: 'offer', title: 'Job Seekers with Offer', color: 'bg-teal-50', accent: 'border-teal-400' },
  { id: 'starting', title: 'Job Seekers Starting', color: 'bg-sky-50', accent: 'border-sky-400' },
  { id: 'assignment', title: 'Job Seekers on Assignment', color: 'bg-violet-50', accent: 'border-violet-400' },
];

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
  const [draggedCandidate, setDraggedCandidate] = useState<PrescreenedCandidate | null>(null);
  const [modalCandidate, setModalCandidate] = useState<PrescreenedCandidate | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
                fetch(`/api/job-seekers/${c.id}/applications`, {
                  credentials: 'include',
                }),
                fetch(`/api/job-seekers/${c.id}/client-submissions`, {
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

          if (apps.length === 0 && clientSubs.length === 0) {
            nextPrescreened.push(c);
            return;
          }

          // If there is any client submission, treat as "Client Submitted"
          if (clientSubs.length > 0) {
            const latestClientSub = clientSubs[0];
            const jobIdLabel =
              latestClientSub?.job_id != null
                ? formatRecordId(latestClientSub.job_id, 'job')
                : latestClientSub?.job_title || '';

            nextClientSubmitted.push({
              id: c.id,
              name: c.name,
              jobId: jobIdLabel,
            });
            return;
          }

          if (apps.length === 0) {
            nextPrescreened.push(c);
            return;
          }

          const sortedApps = [...apps].sort(
            (a: any, b: any) =>
              new Date(b?.created_at || 0).getTime() -
              new Date(a?.created_at || 0).getTime()
          );

          const latest = sortedApps[0];
          const jobIdLabel =
            latest?.job_id != null
              ? formatRecordId(latest.job_id, 'job')
              : latest?.job_title || '';

          const status = String(latest?.status || '').toLowerCase();

          const baseCandidate: Candidate = {
            id: c.id,
            name: c.name,
            jobId: jobIdLabel,
          };

          if (status === 'client submission') {
            nextClientSubmitted.push(baseCandidate);
          } else if (status === 'interview') {
            nextInterview.push(baseCandidate);
          } else if (status === 'offer extended') {
            nextOffer.push(baseCandidate);
          } else {
            nextSubmitted.push(baseCandidate);
          }
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
    router.push(`/dashboard/job-seekers/view?id=${id}`);
  };

  const openSubmissionModalFor = (c: PrescreenedCandidate) => {
    setModalCandidate(c);
  };

  const closeSubmissionModal = () => {
    setModalCandidate(null);
  };

  const renderPrescreenedCard = (c: PrescreenedCandidate) => {
    return (
      <button
        type="button"
        key={c.id}
        draggable
        onDragStart={() => setDraggedCandidate(c)}
        onClick={() => handleViewCandidate(c.id)}
        className="w-full text-left rounded-xl p-4 mb-3 bg-white border border-green-200 shadow-sm hover:shadow-md hover:border-green-400 transition-all group cursor-move"
      >
        <div className="flex items-center gap-2 text-gray-800 font-medium">
          <FiUser className="text-green-600 shrink-0" size={16} />
          <span className="truncate">
            {c.name || `Record #${c.record_number ?? c.id}`}
          </span>
        </div>
        <div className="text-gray-500 text-sm mt-0.5">
          Record #{c.record_number ?? c.id}
        </div>
        <div className="mt-2 flex items-center justify-between text-green-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="rounded-full px-2 py-0.5 bg-green-50 border border-green-200 text-[11px]">
            Drag to "Job Seekers Submitted" to submit
          </span>
          <span className="flex items-center">
            <FiEye className="mr-1" size={14} />
            View
          </span>
        </div>
      </button>
    );
  };

  const renderSubmittedCard = (candidate: Candidate) => (
    <div
      key={candidate.id}
      className="w-full rounded-xl p-4 mb-3 bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
    >
      <div>
        <div className="text-slate-800 font-medium truncate">{candidate.name}</div>
        {candidate.jobId && (
          <div className="text-slate-500 text-xs mt-0.5 truncate">
            {candidate.jobId}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-end text-teal-600 text-xs font-medium gap-1">
        <FiEye size={14} />
        <button
          type="button"
          onClick={() => handleViewCandidate(candidate.id)}
          className="hover:underline"
        >
          View record
        </button>
      </div>
    </div>
  );

  const anyLoading = loading || stageLoading;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
        aria-label="Close and return to home"
      >
        <FiX size={24} />
      </button>

      <div className="grow overflow-auto">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold text-slate-800">Job Seeker Flow</h1>
          <p className="text-slate-600 text-sm mt-0.5">Pipeline by stage — PreScreened shows your last 30 days.</p>
        </div>
        <div className="flex overflow-x-auto gap-4 p-4 pb-8 min-h-[420px]">
          {columns.map((column) => (
            <div
              key={column.id}
              className="shrink-0 w-[300px] max-w-[300px] flex flex-col rounded-2xl bg-white/80 backdrop-blur-sm shadow-md border border-slate-200 overflow-hidden"
            >
              <div className={`px-4 py-3 border-b-2 ${column.accent} bg-white`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-800 text-sm leading-tight">
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
                className="flex-1 p-3 overflow-y-auto min-h-[360px]"
                onDragOver={(e) => {
                  if (column.id === 'submitted' && draggedCandidate) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => {
                  if (column.id === 'submitted' && draggedCandidate) {
                    e.preventDefault();
                    openSubmissionModalFor(draggedCandidate);
                    setDraggedCandidate(null);
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
                  return candidateList.map(renderSubmittedCard);
                })()}
              </div>
            </div>
          ))}
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
    </div>
  );
}
