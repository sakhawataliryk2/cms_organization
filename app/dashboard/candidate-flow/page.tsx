// File: app/dashboard/candidate-flow/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiEye, FiX, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

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
  { id: 'submitted', title: 'Candidates Submitted', color: 'bg-slate-100', accent: 'border-slate-400' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-emerald-50', accent: 'border-emerald-400' },
  { id: 'interviews', title: 'Candidates with Interviews', color: 'bg-amber-50', accent: 'border-amber-400' },
  { id: 'offer', title: 'Candidates with Offer', color: 'bg-teal-50', accent: 'border-teal-400' },
  { id: 'starting', title: 'Candidates Starting', color: 'bg-sky-50', accent: 'border-sky-400' },
  { id: 'assignment', title: 'Candidates on Assignment', color: 'bg-violet-50', accent: 'border-violet-400' },
];

export default function CandidateFlowDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [prescreenedTotal, setPrescreenedTotal] = useState(0);
  const [prescreenedList, setPrescreenedList] = useState<PrescreenedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<CandidateColumn[]>([]);

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
  }, []);

  useEffect(() => {
    const prescreenedColumn: CandidateColumn = {
      id: 'prescreened',
      title: 'Candidates PreScreened',
      color: 'bg-green-50',
      accent: 'border-green-500',
      count: prescreenedTotal,
      candidates: prescreenedList,
      isPrescreenedColumn: true,
    };
    const others: CandidateColumn[] = PLACEHOLDER_COLUMNS.map((col) => ({
      ...col,
      candidates: [], // Empty for now; other stages can be wired later
    }));
    setColumns([prescreenedColumn, ...others]);
  }, [prescreenedTotal, prescreenedList]);

  const handlePrevious = () => router.push('/dashboard');
  const handleNext = () => router.push('/dashboard/sales-dashboard');
  const handleClose = () => router.push('/home');

  const handleViewCandidate = (id: number) => {
    router.push(`/dashboard/job-seekers/view?id=${id}`);
  };

  const renderPrescreenedCard = (c: PrescreenedCandidate) => (
    <button
      type="button"
      key={c.id}
      onClick={() => handleViewCandidate(c.id)}
      className="w-full text-left rounded-xl p-4 mb-3 bg-white border border-green-200 shadow-sm hover:shadow-md hover:border-green-400 transition-all group"
    >
      <div className="flex items-center gap-2 text-gray-800 font-medium">
        <FiUser className="text-green-600 shrink-0" size={16} />
        <span className="truncate">{c.name || `Record #${c.record_number ?? c.id}`}</span>
      </div>
      <div className="text-gray-500 text-sm mt-0.5">
        Record #{c.record_number ?? c.id}
      </div>
      <div className="mt-2 flex items-center justify-end text-green-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <FiEye className="mr-1" size={14} />
        View
      </div>
    </button>
  );

  const renderPlaceholderCard = (candidate: Candidate, color: string) => (
    <div
      key={candidate.id}
      className={`${color} rounded-xl p-4 mb-3 border border-white/50 shadow-sm flex flex-col items-center transition-all`}
    >
      <div className="text-gray-700 font-medium">{candidate.name}</div>
      <div className="text-gray-600 text-sm">{candidate.jobId}</div>
      <div className="mt-1 text-gray-500">
        <FiEye size={18} />
      </div>
    </div>
  );

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
          <h1 className="text-2xl font-bold text-slate-800">Candidate Flow</h1>
          <p className="text-slate-600 text-sm mt-0.5">Pipeline by stage — PreScreened shows your last 30 days.</p>
        </div>
        <div className="flex overflow-x-auto gap-4 p-4 pb-8 min-h-[420px]">
          {columns.map((column) => (
            <div
              key={column.id}
              className="shrink-0 w-[280px] flex flex-col rounded-2xl bg-white/80 backdrop-blur shadow-lg border border-slate-200/80 overflow-hidden"
            >
              <div className={`px-4 py-3 border-b-2 ${column.accent} bg-white`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-800 text-sm leading-tight">
                    {column.title}
                  </h2>
                  {column.count !== undefined && (
                    <span className="shrink-0 min-w-[28px] h-7 px-2 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center">
                      {loading ? '…' : column.count}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-3 overflow-y-auto">
                {column.isPrescreenedColumn ? (
                  (column.candidates as PrescreenedCandidate[]).length === 0 && !loading ? (
                    <p className="text-slate-500 text-sm py-4 text-center">No candidates prescreened by you in the last 30 days.</p>
                  ) : (
                    (column.candidates as PrescreenedCandidate[]).map(renderPrescreenedCard)
                  )
                ) : (column.candidates as Candidate[]).length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">No records yet.</p>
                ) : (
                  (column.candidates as Candidate[]).map((c) => renderPlaceholderCard(c, column.color))
                )}
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
    </div>
  );
}
