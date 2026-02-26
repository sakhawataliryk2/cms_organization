'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { FiX, FiChevronLeft, FiBriefcase, FiEye } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

interface ApplicationTile {
  id: number;
  companyName: string;
  jobId: string;
  jobName: string;
  viewCount: number;
  candidateId?: number;
}

interface Column {
  id: string;
  title: string;
  color: string;
  accent: string;
  applications: ApplicationTile[];
}

const COLUMN_CONFIG: { id: string; title: string; color: string; accent: string }[] = [
  { id: 'submission', title: 'Submission', color: 'bg-green-50', accent: 'border-green-500' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-blue-50', accent: 'border-blue-500' },
  { id: 'interview', title: 'Interview', color: 'bg-emerald-100', accent: 'border-emerald-500' },
  { id: 'offer-extended', title: 'Offer Extended', color: 'bg-amber-100', accent: 'border-amber-500' },
  { id: 'placement', title: 'Placement', color: 'bg-teal-100', accent: 'border-teal-600' },
];

const SAMPLE_APPLICATIONS: Record<string, Omit<ApplicationTile, 'id'>[]> = {
  submission: [
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 5 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 3 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 7 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 2 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 4 },
  ],
  'client-submitted': [
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 8 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 6 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 9 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 1 },
  ],
  interview: [
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 12 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 15 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 10 },
  ],
  'offer-extended': [
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 20 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 18 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 22 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 19 },
  ],
  placement: [
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 25 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 30 },
    { companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 28 },
  ],
};

function buildColumns(): Column[] {
  let idCounter = 0;
  return COLUMN_CONFIG.map((config) => ({
    ...config,
    applications: (SAMPLE_APPLICATIONS[config.id] ?? []).map((app) => ({
      ...app,
      id: ++idCounter,
    })),
  }));
}

export default function SalesDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [columns, setColumns] = useState<Column[]>(buildColumns);

  const handleClose = () => router.push('/home');
  const handlePrevious = () => router.push('/dashboard/candidate-flow');

  const handleTileClick = (application: ApplicationTile) => {
    if (application.candidateId) {
      router.push(`/dashboard/job-seekers/view?id=${application.candidateId}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
        aria-label="Close and return to home"
      >
        <FiX size={24} />
      </button>

      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-slate-800">Sales Dashboard</h1>
        <p className="text-slate-600 text-sm mt-0.5">Applications by stage — click a card to view candidate.</p>
      </div>

      <div className="grow overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="shrink-0 w-[280px] flex flex-col rounded-2xl bg-white/80 backdrop-blur shadow-lg border border-slate-200/80 overflow-hidden"
            >
              <div className={`px-4 py-3 border-b-2 ${column.accent} bg-white`}>
                <h2 className="font-semibold text-slate-800 text-sm">
                  {column.title}
                </h2>
              </div>
              <div className="flex-1 bg-slate-50/50 p-3 overflow-y-auto space-y-3">
                {column.applications.map((app) => (
                  <button
                    type="button"
                    key={app.id}
                    onClick={() => handleTileClick(app)}
                    className={`w-full text-left ${column.color} rounded-xl p-4 border border-white/60 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all group`}
                  >
                    <div className="flex items-start gap-2 text-gray-800 font-medium mb-1">
                      <FiBriefcase className="text-slate-500 shrink-0 mt-0.5" size={14} />
                      <span className="line-clamp-1">{app.companyName}</span>
                    </div>
                    <div className="text-gray-600 text-sm mb-0.5">{app.jobId}</div>
                    <div className="text-gray-800 text-sm font-semibold mb-2 line-clamp-1">{app.jobName}</div>
                    <div className="flex items-center justify-end text-slate-600 text-xs">
                      <FiEye className="mr-1 opacity-70 group-hover:opacity-100" size={14} />
                      <span className="font-medium">#{app.viewCount}</span>
                    </div>
                  </button>
                ))}
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
      </div>
    </div>
  );
}
