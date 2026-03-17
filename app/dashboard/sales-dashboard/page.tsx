'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useAuth } from '@/lib/auth';
import { FiX, FiChevronLeft, FiBriefcase, FiEye, FiUser } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import RecordNameResolver from '@/components/RecordNameResolver';
import { formatRecordId } from '@/lib/recordIdFormatter';
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

const COLUMN_CONFIG: { id: string; title: string; color: string; accent: string }[] = [
  { id: 'submission', title: 'Submission', color: 'bg-green-50', accent: 'border-green-500' },
  { id: 'client-submitted', title: 'Client Submitted', color: 'bg-blue-50', accent: 'border-blue-500' },
  { id: 'interview', title: 'Interview', color: 'bg-emerald-100', accent: 'border-emerald-500' },
  { id: 'offer-extended', title: 'Offer Extended', color: 'bg-amber-100', accent: 'border-amber-500' },
  { id: 'placement', title: 'Placement', color: 'bg-teal-100', accent: 'border-teal-600' },
];

const COLUMN_ID_TO_STATUS: Record<string, string> = {
  submission: 'Submitted',
  'client-submitted': 'Client Submission',
  interview: 'Interview',
  'offer-extended': 'Offer Extended',
  placement: 'Placement',
};

const DraggableCard = memo(function DraggableCard({
  app,
  columnId,
  onTileClick,
  onJobClick,
}: {
  app: ApplicationTile;
  columnId: string;
  onTileClick: (app: ApplicationTile) => void;
  onJobClick?: (app: ApplicationTile) => void;
}) {
  const id = `app-${columnId}-${app.id}-${app.jobSeekerId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { application: app, columnId },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg p-3 border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTileClick(app);
        }}
        className="w-full text-left text-gray-800 font-medium mb-1 flex items-start gap-2"
      >
        <FiUser className="text-slate-500 shrink-0 mt-0.5" size={14} />
        <span className="line-clamp-1">
          <RecordNameResolver
            id={app.jobSeekerId}
            type="job-seeker"
            clickable={false}
          />
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (app.jobId && onJobClick) {
            onJobClick(app);
          }
        }}
        className="text-gray-600 text-xs mb-0.5 hover:underline"
      >
        {app.jobId ? (
          <span>
            <span className="font-medium">Job </span>
            <span>{formatRecordId(app.jobId, 'job')}</span>
          </span>
        ) : (
          'Job —'
        )}
      </button>
      <div className="text-gray-800 text-sm font-semibold mb-1 line-clamp-1 flex items-start gap-2">
        <FiBriefcase className="text-slate-500 shrink-0 mt-0.5" size={14} />
        <span className="line-clamp-2">{app.jobTitle || app.companyName || '—'}</span>
      </div>
      <div className="flex items-center justify-end text-slate-600 text-xs">
        <FiEye className="mr-1 opacity-70 group-hover:opacity-100" size={14} />
        <span className="font-medium">Preview</span>
      </div>
    </div>
  );
});

const DroppableColumn = memo(function DroppableColumn({
  column,
  onTileClick,
  onJobClick,
}: {
  column: Column;
  onTileClick: (app: ApplicationTile) => void;
  onJobClick?: (app: ApplicationTile) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[280px] flex flex-col rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden ${isOver ? 'ring-1 ring-teal-300' : ''}`}
    >
      <div className={`px-4 py-3 border-b-2 ${column.accent} bg-white`}>
        <h2 className="font-semibold text-slate-800 text-sm">{column.title}</h2>
      </div>
      <div className={`flex-1 bg-slate-50/50 p-3 overflow-y-auto space-y-3 min-h-[120px] ${column.color}`}>
        {column.applications.map((app) => (
          <DraggableCard
            key={`${column.id}-${app.id}-${app.jobSeekerId}`}
            app={app}
            columnId={column.id}
            onTileClick={onTileClick}
            onJobClick={onJobClick}
          />
        ))}
      </div>
    </div>
  );
});

export default function SalesDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [board, setBoard] = useState<Record<string, ApplicationTile[]>>({
    submission: [],
    'client-submitted': [],
    interview: [],
    'offer-extended': [],
    placement: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobSeekerId, setSelectedJobSeekerId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/job-seekers/applications/board');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load board');
      if (data.board) setBoard(data.board);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
      toast.error(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const columns: Column[] = useMemo(
    () =>
      COLUMN_CONFIG.map((config) => ({
        ...config,
        applications: board[config.id] ?? [],
      })),
    [board]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      if (!activeId.startsWith('app-')) return;
      const overId = String(over.id);
      const fromColumnId = active.data.current?.columnId as string | undefined;
      if (!fromColumnId || overId === fromColumnId) return;
      if (!COLUMN_CONFIG.some((c) => c.id === overId)) return;

      const app = active.data.current?.application as ApplicationTile | undefined;
      if (!app) return;

      const newStatus = COLUMN_ID_TO_STATUS[overId];
      if (!newStatus) return;

      const prevBoard = { ...board };
      setBoard((b) => {
        const next = { ...b };
        next[fromColumnId] = (next[fromColumnId] || []).filter(
          (a) => !(a.id === app.id && a.jobSeekerId === app.jobSeekerId)
        );
        const cleanedTarget = (next[overId] || []).filter(
          (a) => !(a.id === app.id && a.jobSeekerId === app.jobSeekerId)
        );
        next[overId] = [...cleanedTarget, { ...app, status: newStatus }];
        return next;
      });

      try {
        const res = await fetch(
          `/api/job-seekers/${app.jobSeekerId}/applications/${app.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          setBoard(prevBoard);
          toast.error(data.message || 'Failed to update status');
        }
      } catch {
        setBoard(prevBoard);
        toast.error('Failed to update status');
      }
    },
    [board]
  );

  const handleClose = () => router.push('/home');
  const handlePrevious = () => router.push('/dashboard/candidate-flow');

  const handleTileClick = useCallback((application: ApplicationTile) => {
    if (application.jobSeekerId) {
      setSelectedJobSeekerId(application.jobSeekerId);
    }
  }, []);

  const handleJobClick = useCallback((application: ApplicationTile) => {
    if (application.jobId) {
      setSelectedJobId(application.jobId);
    }
  }, []);

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
          Applications by stage — drag cards to move; click a card to view candidate.
        </p>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>

      <div className="grow overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600">
            Loading...
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full min-w-max pb-4">
              {columns.map((column) => (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  onTileClick={handleTileClick}
                  onJobClick={handleJobClick}
                />
              ))}
            </div>
          </DndContext>
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
                Candidate details are managed in the Job Seeker profile.
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
    </div>
  );
}
