'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'sonner';
import { formatRecordId } from '@/lib/recordIdFormatter';
import RecordNameResolver from '@/components/RecordNameResolver';

export type SmartMatchMode = 'job' | 'seeker';

export type SmartMatchRow = {
  id: number;
  record_number?: number | string | null;
  name?: string;
  title?: string;
  skills?: string;
  certifications?: string;
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

const LIMITS = [10, 20, 50] as const;

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
  if (s.length <= max) return s || '—';
  return `${s.slice(0, max)}…`;
}

function scorePct(score?: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '—';
  return `${Math.round(score * 100)}%`;
}

function statusLabel(status?: string) {
  if (status === 'submitted') return 'Submitted';
  if (status === 'saved') return 'Saved';
  return 'Fetched';
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
    skills: String(snap.skills || ''),
    certifications: String(snap.certifications || ''),
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
      skills: row.skills,
      certifications: row.certifications,
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
  const [openActionId, setOpenActionId] = useState<number | null>(null);

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

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
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

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-xs font-semibold uppercase text-gray-500">
              <th className="px-3 py-2 text-left w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">{mode === 'job' ? 'Candidate' : 'Job'}</th>
              <th className="px-3 py-2 text-left">Title</th>
              {mode === 'job' ? (
                <>
                  <th className="px-3 py-2 text-left">Skills</th>
                  <th className="px-3 py-2 text-left">Certifications</th>
                  <th className="px-3 py-2 text-left">Organization</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Skills</th>
                  <th className="px-3 py-2 text-left">Remote</th>
                </>
              )}
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Match reason</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50 align-top">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    disabled={row.status === 'submitted'}
                  />
                </td>
                <td className="px-3 py-2 text-gray-700">{row.rank ?? '—'}</td>
                <td className="px-3 py-2">
                  {mode === 'job' ? (
                    <RecordNameResolver
                      id={row.id}
                      type="jobSeeker"
                      fallback={row.name || `Job Seeker #${row.record_number || row.id}`}
                      clickable={true}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-blue-600 font-medium text-left"
                      onClick={() => openRecord(row)}
                    >
                      {formatRecordId(row.record_number ?? row.id, 'job')}{' '}
                      {row.title || 'Untitled job'}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{clip(row.title, 60)}</td>
                {mode === 'job' ? (
                  <>
                    <td className="px-3 py-2 text-gray-700">{clip(row.skills)}</td>
                    <td className="px-3 py-2 text-gray-700">{clip(row.certifications, 60)}</td>
                    <td className="px-3 py-2 text-gray-700">{clip(row.organization, 40)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-gray-700">{clip(row.category, 40)}</td>
                    <td className="px-3 py-2 text-gray-700">{clip(row.skills)}</td>
                    <td className="px-3 py-2 text-gray-700">{clip(row.remote, 30)}</td>
                  </>
                )}
                <td className="px-3 py-2 text-gray-700">
                  {clip(row.location || [row.city, row.state].filter(Boolean).join(', '), 40)}
                </td>
                <td className="px-3 py-2 text-gray-700 max-w-xs">{row.match_reason || '—'}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{scorePct(row.score)}</td>
                <td className="px-3 py-2">
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
                </td>
                <td className="px-3 py-2 relative">
                  <button
                    type="button"
                    className="text-sm border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-50"
                    disabled={row.status === 'submitted' || !!busy}
                    onClick={() =>
                      setOpenActionId((cur) => (cur === row.id ? null : row.id))
                    }
                  >
                    Actions
                  </button>
                  {openActionId === row.id && row.status !== 'submitted' ? (
                    <div className="absolute right-2 z-20 mt-1 w-36 bg-white border border-gray-200 rounded shadow text-sm">
                      {row.status !== 'saved' ? (
                        <button
                          type="button"
                          className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setOpenActionId(null);
                            saveSelected([row]);
                          }}
                        >
                          Save
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                        onClick={() => {
                          setOpenActionId(null);
                          submitRows([row]);
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-sm text-gray-500">
                  {busy === 'run'
                    ? 'Ranking matches…'
                    : 'No matches yet. Choose 10, 20, or 50 and run Smart Match.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
