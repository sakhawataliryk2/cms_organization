'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'sonner';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { formatRecordId } from '@/lib/recordIdFormatter';
import RecordNameResolver from '@/components/RecordNameResolver';
import ActionDropdown from '@/components/ActionDropdown';
import SortableColumnHeader, {
  type ColumnFilterState,
  type ColumnSortState,
} from '@/components/SortableColumnHeader';

export type SmartMatchMode = 'job' | 'seeker';

export type SmartMatchRow = {
  id: number;
  record_number?: number | string | null;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  organization?: string;
  city?: string;
  state?: string;
  location?: string;
  category?: string;
  remote?: string;
  job_type?: string;
  score?: number;
  rank?: number;
  match_reason?: string;
  status?: 'fetched' | 'saved' | 'submitted';
  application_id?: number | null;
};

type SavedItem = {
  job_id?: number;
  job_seeker_id?: number;
  rank?: number;
  vector_score?: number;
  match_reason?: string;
  snapshot?: Record<string, unknown>;
  status?: string;
  application_id?: number | null;
};

type ColumnDef = {
  key: string;
  label: string;
  filterType: 'text' | 'select' | 'number';
};

const LIMITS = [10, 20, 50] as const;

const STATUS_FILTER_OPTIONS = [
  { label: 'Fetched', value: 'fetched' },
  { label: 'Saved', value: 'saved' },
  { label: 'Submitted', value: 'submitted' },
];

function storageKey(mode: SmartMatchMode, entityId: string) {
  return mode === 'job'
    ? `smartMatch:fetch:job:${entityId}`
    : `smartMatch:fetch:seeker:${entityId}`;
}

function getToken() {
  return document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1');
}

function clip(text: unknown, max = 80) {
  const s = String(text || '').trim();
  if (s.length <= max) return s || 'N/A';
  return `${s.slice(0, max)}…`;
}

function scorePct(score?: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'N/A';
  return `${Math.round(score * 100)}%`;
}

function statusLabel(status?: string) {
  if (status === 'submitted') return 'Submitted';
  if (status === 'saved') return 'Saved';
  return 'Fetched';
}

function columnsForMode(mode: SmartMatchMode): ColumnDef[] {
  if (mode === 'job') {
    return [
      { key: 'rank', label: 'Rank', filterType: 'number' },
      { key: 'name', label: 'Candidate', filterType: 'text' },
      { key: 'title', label: 'Title', filterType: 'text' },
      { key: 'email', label: 'Primary Email', filterType: 'text' },
      { key: 'phone', label: 'Primary Phone', filterType: 'text' },
      { key: 'organization', label: 'Organization', filterType: 'text' },
      { key: 'location', label: 'Location', filterType: 'text' },
      { key: 'match_reason', label: 'Match Reason', filterType: 'text' },
      { key: 'score', label: 'Score', filterType: 'number' },
      { key: 'status', label: 'Status', filterType: 'select' },
    ];
  }
  return [
    { key: 'rank', label: 'Rank', filterType: 'number' },
    { key: 'title', label: 'Job', filterType: 'text' },
    { key: 'category', label: 'Category', filterType: 'text' },
    { key: 'remote', label: 'Remote', filterType: 'text' },
    { key: 'location', label: 'Location', filterType: 'text' },
    { key: 'match_reason', label: 'Match Reason', filterType: 'text' },
    { key: 'score', label: 'Score', filterType: 'number' },
    { key: 'status', label: 'Status', filterType: 'select' },
  ];
}

function toRowFromSaved(item: SavedItem, mode: SmartMatchMode): SmartMatchRow | null {
  const id = mode === 'job' ? Number(item.job_seeker_id) : Number(item.job_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const snap = item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : {};
  return {
    id,
    record_number: (snap.record_number as string | number | null) ?? null,
    name: String(snap.name || ''),
    title: String(snap.title || ''),
    email: String(snap.email || ''),
    phone: String(snap.phone || ''),
    organization: String(snap.organization || ''),
    city: String(snap.city || ''),
    state: String(snap.state || ''),
    location: String(snap.location || ''),
    category: String(snap.category || ''),
    remote: String(snap.remote || ''),
    job_type: String(snap.job_type || ''),
    score: item.vector_score != null ? Number(item.vector_score) : undefined,
    rank: item.rank ?? undefined,
    match_reason: item.match_reason || '',
    status: item.status === 'submitted' ? 'submitted' : 'saved',
    application_id: item.application_id ?? null,
  };
}

function mergeRows(fetched: SmartMatchRow[], saved: SmartMatchRow[]) {
  const byId = new Map<number, SmartMatchRow>();
  for (const row of fetched) {
    byId.set(Number(row.id), { ...row, status: row.status || 'fetched' });
  }
  for (const row of saved) {
    byId.set(Number(row.id), row);
  }
  return [...byId.values()].sort((a, b) => (a.rank || 999) - (b.rank || 999));
}

function itemPayload(row: SmartMatchRow) {
  return {
    id: row.id,
    rank: row.rank,
    score: row.score,
    match_reason: row.match_reason,
    snapshot: {
      name: row.name,
      record_number: row.record_number,
      title: row.title,
      email: row.email,
      phone: row.phone,
      organization: row.organization,
      city: row.city,
      state: row.state,
      location: row.location,
      category: row.category,
      remote: row.remote,
      job_type: row.job_type,
    },
  };
}

function rowLocation(row: SmartMatchRow) {
  return String(row.location || [row.city, row.state].filter(Boolean).join(', ')).trim();
}

function getColumnValue(row: SmartMatchRow, key: string, mode: SmartMatchMode) {
  switch (key) {
    case 'rank':
      return row.rank ?? '';
    case 'name':
      return row.name || '';
    case 'title':
      return mode === 'seeker'
        ? `${formatRecordId(row.record_number ?? row.id, 'job')} ${row.title || ''}`.trim()
        : row.title || '';
    case 'email':
      return row.email || '';
    case 'phone':
      return row.phone || '';
    case 'organization':
      return row.organization || '';
    case 'location':
      return rowLocation(row);
    case 'category':
      return row.category || '';
    case 'remote':
      return row.remote || '';
    case 'match_reason':
      return row.match_reason || '';
    case 'score':
      return typeof row.score === 'number' && Number.isFinite(row.score)
        ? Math.round(row.score * 100)
        : '';
    case 'status':
      return row.status || 'fetched';
    default:
      return '';
  }
}

type Props = {
  mode: SmartMatchMode;
  entityId: string;
};

export default function SmartMatchShortlistPanel({ mode, entityId }: Props) {
  const router = useRouter();
  const [limit, setLimit] = useState<number>(20);
  const [busy, setBusy] = useState<'run' | 'save' | 'submit' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fetched, setFetched] = useState<SmartMatchRow[]>([]);
  const [saved, setSaved] = useState<SmartMatchRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const columnsCatalog = useMemo(() => columnsForMode(mode), [mode]);
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columnsForMode(mode).map((c) => c.key)
  );

  useEffect(() => {
    setColumnOrder(columnsForMode(mode).map((c) => c.key));
    setColumnSorts({});
    setColumnFilters({});
  }, [mode]);

  const visibleColumns = useMemo(() => {
    const allowed = new Set(columnsCatalog.map((c) => c.key));
    const ordered = columnOrder.filter((key) => allowed.has(key));
    for (const col of columnsCatalog) {
      if (!ordered.includes(col.key)) ordered.push(col.key);
    }
    return ordered;
  }, [columnOrder, columnsCatalog]);

  const rows = useMemo(() => mergeRows(fetched, saved), [fetched, saved]);

  const loadSaved = useCallback(async () => {
    if (!entityId) return;
    const path =
      mode === 'job'
        ? `/api/jobs/${entityId}/smart-match-shortlist`
        : `/api/job-seekers/${entityId}/smart-match-shortlist`;
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to load saved matches');
    }
    const items = Array.isArray(data.items) ? data.items : [];
    setSaved(
      items
        .map((item: SavedItem) => toRowFromSaved(item, mode))
        .filter(Boolean) as SmartMatchRow[],
    );
  }, [entityId, mode]);

  useEffect(() => {
    if (!entityId) return;
    try {
      const raw = localStorage.getItem(storageKey(mode, entityId));
      if (raw) {
        const parsed = JSON.parse(raw);
        const matches = Array.isArray(parsed?.matches) ? parsed.matches : [];
        setFetched(
          matches.map((m: SmartMatchRow) => ({
            ...m,
            id: Number(m.id),
            status: 'fetched' as const,
          })),
        );
        if (parsed?.limit === 10 || parsed?.limit === 20 || parsed?.limit === 50) {
          setLimit(parsed.limit);
        }
      } else {
        setFetched([]);
      }
    } catch {
      setFetched([]);
    }
    loadSaved().catch((err) => {
      console.error(err);
    });
  }, [entityId, mode, loadSaved]);

  const handleColumnSort = (columnKey: string) => {
    setColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === 'asc') return { ...prev, [columnKey]: 'desc' };
      if (current === 'desc') {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: 'asc' };
    });
  };

  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters((prev) => {
      const nextValue = value.trim();
      if (!nextValue) {
        if (!(columnKey in prev)) return prev;
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: nextValue };
    });
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleColumns.indexOf(String(active.id));
    const newIndex = visibleColumns.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setColumnOrder(arrayMove(visibleColumns, oldIndex, newIndex));
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === '') return;
      const col = columnsCatalog.find((c) => c.key === columnKey);
      result = result.filter((row) => {
        const value = getColumnValue(row, columnKey, mode);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();
        if (col?.filterType === 'number') {
          return String(value) === String(filterValue);
        }
        if (col?.filterType === 'select') {
          return valueStr === filterStr;
        }
        return valueStr.includes(filterStr);
      });
    });

    const sortEntries = Object.entries(columnSorts).filter(([, dir]) => dir);
    if (sortEntries.length > 0) {
      result.sort((a, b) => {
        for (const [columnKey, dir] of sortEntries) {
          const av = getColumnValue(a, columnKey, mode);
          const bv = getColumnValue(b, columnKey, mode);
          const aNum = Number(av);
          const bNum = Number(bv);
          let cmp = 0;
          if (Number.isFinite(aNum) && Number.isFinite(bNum) && String(av) !== '' && String(bv) !== '') {
            cmp = aNum - bNum;
          } else {
            cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
          }
          if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }
    return result;
  }, [rows, columnFilters, columnSorts, columnsCatalog, mode]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (
      filteredAndSortedRows.length > 0 &&
      filteredAndSortedRows.every((r) => selected.has(r.id))
    ) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredAndSortedRows.map((r) => r.id)));
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));

  const runMatch = async () => {
    if (!entityId || busy) return;
    setBusy('run');
    setMessage(null);
    try {
      const path =
        mode === 'job'
          ? `/api/jobs/${entityId}/ai-match`
          : `/api/job-seekers/${entityId}/ai-match`;
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Smart Match failed');
      }
      const matches: SmartMatchRow[] = (Array.isArray(data.matches) ? data.matches : []).map(
        (m: SmartMatchRow, i: number) => ({
          ...m,
          id: Number(m.id),
          rank: m.rank || i + 1,
          status: 'fetched' as const,
        }),
      );
      setFetched(matches);
      setSelected(new Set());
      localStorage.setItem(
        storageKey(mode, entityId),
        JSON.stringify({ limit, fetchedAt: new Date().toISOString(), matches }),
      );
      if (data.message) {
        setMessage(data.message);
        toast.info(data.message);
      } else if (matches.length === 0) {
        const empty =
          mode === 'job'
            ? 'No matching job seekers found.'
            : 'No matching jobs found.';
        setMessage(empty);
        toast.info(empty);
      } else {
        toast.success(`Ranked ${matches.length} ${mode === 'job' ? 'job seeker(s)' : 'job(s)'}.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Smart Match failed';
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const saveSelected = async (rowsToSave = selectedRows) => {
    if (!entityId || busy) return;
    const unsaved = rowsToSave.filter((r) => r.status !== 'submitted');
    if (unsaved.length === 0) {
      toast.info('Select at least one match to save.');
      return;
    }
    setBusy('save');
    try {
      const path =
        mode === 'job'
          ? `/api/jobs/${entityId}/smart-match-shortlist`
          : `/api/job-seekers/${entityId}/smart-match-shortlist`;
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ items: unsaved.map(itemPayload) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to save matches');
      toast.success(data.message || `Saved ${unsaved.length} match(es).`);
      await loadSaved();
      setSelected(new Set());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save matches');
    } finally {
      setBusy(null);
    }
  };

  const submitRows = async (rowsToSubmit: SmartMatchRow[]) => {
    if (!entityId || busy) return;
    const eligible = rowsToSubmit.filter((r) => r.status !== 'submitted');
    if (eligible.length === 0) {
      toast.info('Select saved matches to submit.');
      return;
    }
    const needSave = eligible.filter((r) => r.status !== 'saved' && r.status !== 'submitted');
    setBusy('submit');
    try {
      if (needSave.length > 0) {
        const savePath =
          mode === 'job'
            ? `/api/jobs/${entityId}/smart-match-shortlist`
            : `/api/job-seekers/${entityId}/smart-match-shortlist`;
        const saveRes = await fetch(savePath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ items: needSave.map(itemPayload) }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(saveData?.message || 'Save before submit failed');
      }
      const submitPath =
        mode === 'job'
          ? `/api/jobs/${entityId}/smart-match-shortlist/submit`
          : `/api/job-seekers/${entityId}/smart-match-shortlist/submit`;
      const body =
        mode === 'job'
          ? { jobSeekerIds: eligible.map((r) => r.id) }
          : { jobIds: eligible.map((r) => r.id) };
      const res = await fetch(submitPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Submit failed');
      toast.success(data.message || `Submitted ${data.submitted} of ${data.total}.`);
      await loadSaved();
      setSelected(new Set());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(null);
    }
  };

  const openRecord = (row: SmartMatchRow) => {
    if (mode === 'job') {
      router.push(`/dashboard/job-seekers/view?id=${row.id}`);
    } else {
      router.push(`/dashboard/jobs/view?id=${row.id}`);
    }
  };

  const renderCell = (row: SmartMatchRow, key: string) => {
    if (key === 'name' && mode === 'job') {
      return (
        <RecordNameResolver
          id={row.id}
          type="jobSeeker"
          fallback={row.name || `Job Seeker #${row.record_number || row.id}`}
          clickable={true}
        />
      );
    }
    if (key === 'title' && mode === 'seeker') {
      return (
        <button
          type="button"
          className="text-blue-600 font-medium text-left"
          onClick={(e) => {
            e.stopPropagation();
            openRecord(row);
          }}
        >
          {formatRecordId(row.record_number ?? row.id, 'job')} {row.title || 'Untitled job'}
        </button>
      );
    }
    if (key === 'score') {
      return scorePct(row.score);
    }
    if (key === 'status') {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
            row.status === 'submitted'
              ? 'bg-green-100 text-green-800'
              : row.status === 'saved'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
          }`}
        >
          {statusLabel(row.status)}
        </span>
      );
    }
    if (key === 'match_reason') {
      return row.match_reason || 'N/A';
    }
    const value = getColumnValue(row, key, mode);
    return clip(value, key === 'match_reason' ? 160 : 80);
  };

  const allVisibleSelected =
    filteredAndSortedRows.length > 0 &&
    filteredAndSortedRows.every((r) => selected.has(r.id));

  return (
    <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">AI Smart Match</h2>
          <p className="text-xs text-gray-500 mt-1">
            Fetch ranks into this browser only. Check rows and Save to keep them on this record.
            Submit creates a real job application.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600">
            Results
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={!!busy}
              className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={runMatch}
            disabled={!!busy || !entityId}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {busy === 'run' ? 'Ranking…' : 'Run Smart Match'}
          </button>
          <button
            type="button"
            onClick={() => saveSelected()}
            disabled={!!busy || selectedRows.length === 0}
            className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm disabled:opacity-50"
          >
            {busy === 'save' ? 'Saving…' : 'Save selected'}
          </button>
          <button
            type="button"
            onClick={() => submitRows(selectedRows)}
            disabled={!!busy || selectedRows.length === 0}
            className="px-3 py-1.5 bg-black text-white rounded text-sm disabled:opacity-50"
          >
            {busy === 'submit' ? 'Submitting…' : 'Submit selected'}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-amber-800 mb-3">{message}</p> : null}

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Actions
                </th>
                <SortableContext items={visibleColumns} strategy={horizontalListSortingStrategy}>
                  {visibleColumns.map((key) => {
                    const columnInfo = columnsCatalog.find((c) => c.key === key);
                    if (!columnInfo) return null;
                    return (
                      <SortableColumnHeader
                        key={key}
                        id={key}
                        columnKey={key}
                        label={columnInfo.label}
                        sortState={columnSorts[key] || null}
                        filterValue={columnFilters[key] || null}
                        onSort={() => handleColumnSort(key)}
                        onFilterChange={(value) => handleColumnFilter(key, value)}
                        filterType={columnInfo.filterType}
                        filterOptions={key === 'status' ? STATUS_FILTER_OPTIONS : undefined}
                        className={key === 'match_reason' ? 'min-w-[32rem]' : undefined}
                      />
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openRecord(row)}
                >
                  <td
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (row.status !== 'submitted') toggle(row.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded pointer-events-none"
                      checked={selected.has(row.id)}
                      readOnly
                      disabled={row.status === 'submitted'}
                    />
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionDropdown
                      label="Actions"
                      disabled={row.status === 'submitted' || !!busy}
                      options={[
                        ...(row.status !== 'saved' && row.status !== 'submitted'
                          ? [{ label: 'Save', action: () => saveSelected([row]) }]
                          : []),
                        ...(row.status !== 'submitted'
                          ? [{ label: 'Submit', action: () => submitRows([row]) }]
                          : []),
                      ]}
                    />
                  </td>
                  {visibleColumns.map((key) => (
                    <td
                      key={key}
                      className={`px-6 py-4 text-sm text-gray-500 ${
                        key === 'match_reason'
                          ? 'min-w-[32rem] max-w-[40rem] whitespace-normal leading-5'
                          : 'whitespace-nowrap'
                      }`}
                    >
                      {renderCell(row, key)}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + visibleColumns.length}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                  >
                    {busy === 'run'
                      ? 'Ranking matches…'
                      : rows.length > 0
                        ? 'No matches found matching your filters.'
                        : 'No matches yet. Choose 10, 20, or 50 and run Smart Match.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
