'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { FiX } from 'react-icons/fi';
import ModuleListGuard from '@/components/ModuleListGuard';

type LogLevel = 'info' | 'success' | 'error' | 'warn' | string;

type LogLine = {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
  raw?: unknown;
};

type RunInfo = {
  id: number;
  status: string;
  total_found?: number;
  total_pending?: number;
  total_migrated?: number;
  total_failed?: number;
  total_skipped?: number;
  total_undone?: number;
  module_counts?: Record<string, number>;
  last_error?: string | null;
  started_by_name?: string | null;
};

async function consumeNdjson(
  response: Response,
  onEvent: (evt: Record<string, unknown>) => void,
) {
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as Record<string, unknown>);
      } catch {
        onEvent({
          type: 'progress',
          level: 'warn',
          message: `Unparseable log line: ${line.slice(0, 200)}`,
        });
      }
    }
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as Record<string, unknown>);
    } catch {
      /* ignore trailing partial */
    }
  }
}

export default function StorageMigrationPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    storage?: Record<string, unknown>;
    env?: {
      ok?: boolean;
      configured?: boolean;
      canUpload?: boolean;
      canMigrate?: boolean;
      summary?: string;
      missing?: string[];
      warnings?: string[];
    };
    latestRun?: RunInfo | null;
    activeRun?: RunInfo | null;
    itemCounts?: Record<string, number> | null;
  } | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const logIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const appendLog = useCallback((level: LogLevel, message: string, raw?: unknown) => {
    logIdRef.current += 1;
    setLogs((prev) => [
      ...prev,
      {
        id: logIdRef.current,
        ts: new Date().toLocaleTimeString(),
        level,
        message,
        raw,
      },
    ]);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/storage-migration/status', {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success) {
        setStatus(data);
      } else {
        appendLog('error', data?.message || 'Failed to load status');
      }
    } catch (e: unknown) {
      appendLog('error', e instanceof Error ? e.message : 'Status request failed');
    }
  }, [appendLog]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!runningRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      try {
        navigator.sendBeacon?.(
          '/api/admin/storage-migration/stop',
          new Blob([JSON.stringify({})], { type: 'application/json' }),
        );
      } catch {
        /* ignore */
      }
      abortRef.current?.abort();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const runAction = async (action: string, body: Record<string, unknown> = {}) => {
    if (busy && action !== 'stop') return;
    if (action === 'stop') {
      try {
        await fetch('/api/admin/storage-migration/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        abortRef.current?.abort();
        appendLog('warn', 'Stop requested — finishing current document, then pausing.');
        await refreshStatus();
      } catch (e: unknown) {
        appendLog('error', e instanceof Error ? e.message : 'Stop failed');
      }
      return;
    }

    setBusy(true);
    runningRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    appendLog('info', `Starting action: ${action}`);

    try {
      const res = await fetch(`/api/admin/storage-migration/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string })?.message || `Request failed (${res.status})`,
        );
      }

      await consumeNdjson(res, (evt) => {
        const level = String(evt.level || (evt.type === 'error' ? 'error' : 'info'));
        const message = String(evt.message || JSON.stringify(evt));
        appendLog(level, message, evt);
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        appendLog('warn', 'Stream aborted (stop or browser close).');
      } else {
        appendLog('error', e instanceof Error ? e.message : 'Action failed');
      }
    } finally {
      setBusy(false);
      runningRef.current = false;
      abortRef.current = null;
      await refreshStatus();
    }
  };

  const run = status?.activeRun || status?.latestRun;
  const storage = status?.storage;
  const env = status?.env;

  const levelClass = (level: LogLevel) => {
    if (level === 'error') return 'text-red-700';
    if (level === 'success') return 'text-green-700';
    if (level === 'warn') return 'text-amber-700';
    return 'text-gray-800';
  };

  return (
    <ModuleListGuard module="admin">
      <div className="bg-gray-200 min-h-screen p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Storage Migration
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Start migration Vercel Blob → AWS
                </p>
                <p className="text-xs text-gray-500 mt-2 max-w-2xl">
                  Live DB safe mode: each file is downloaded, uploaded to S3, then that one
                  URL is updated. Closing the browser stops after the current file — it does
                  not reverse completed rows. Use Undo to restore Blob URLs from the audit
                  map for a run.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/admin')}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <FiX size={24} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="border border-gray-200 rounded p-3">
                <div className="font-medium text-gray-800 mb-2">S3 configuration</div>
                <div className="text-gray-600 space-y-1 font-mono text-xs">
                  <div>configured: {String(storage?.configured ?? '—')}</div>
                  <div>region: {String(storage?.region ?? '—')}</div>
                  <div>bucket: {String(storage?.bucket ?? '—')}</div>
                  <div>credentials: {String(storage?.credentialMode ?? '—')}</div>
                  <div>env ok: {String(env?.ok ?? '—')}</div>
                  <div>can upload: {String(env?.canUpload ?? '—')}</div>
                  <div>can migrate: {String(env?.canMigrate ?? '—')}</div>
                  {env?.missing && env.missing.length > 0 ? (
                    <div className="text-red-600">missing/errors: {env.missing.join(', ')}</div>
                  ) : null}
                  {env?.warnings && env.warnings.length > 0 ? (
                    <div className="text-amber-700">warnings: {env.warnings.join(', ')}</div>
                  ) : null}
                  {env?.summary ? (
                    <div className="text-gray-700 whitespace-pre-wrap normal-case font-sans text-xs mt-1">
                      {env.summary}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use <span className="font-medium">Validate env</span> for a full check including live S3 HeadBucket.
                </p>
              </div>
              <div className="border border-gray-200 rounded p-3">
                <div className="font-medium text-gray-800 mb-2">Latest / active run</div>
                {run ? (
                  <div className="text-gray-600 space-y-1 text-xs font-mono">
                    <div>id: {run.id}</div>
                    <div>status: {run.status}</div>
                    <div>found: {run.total_found ?? 0}</div>
                    <div>pending: {run.total_pending ?? 0}</div>
                    <div>migrated: {run.total_migrated ?? 0}</div>
                    <div>failed: {run.total_failed ?? 0}</div>
                    <div>skipped: {run.total_skipped ?? 0}</div>
                    <div>undone: {run.total_undone ?? 0}</div>
                    {run.last_error ? (
                      <div className="text-red-600 whitespace-pre-wrap">{run.last_error}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No runs yet</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction('validate-env')}
                className="px-4 py-2 bg-blue-700 text-white text-sm rounded disabled:opacity-50"
              >
                Validate env
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction('scan')}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded disabled:opacity-50"
              >
                Scan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction('dry-run')}
                className="px-4 py-2 bg-gray-700 text-white text-sm rounded disabled:opacity-50"
              >
                Dry run
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Start live migration? Each document will be moved to S3 and its DB URL updated. Stop-on-first-error is enabled.',
                    )
                  ) {
                    return;
                  }
                  runAction('start', { stopOnError: true });
                }}
                className="px-4 py-2 bg-black text-white text-sm rounded disabled:opacity-50"
              >
                Start migration
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction('resume', { runId: run?.id })}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded disabled:opacity-50"
              >
                Resume
              </button>
              <button
                type="button"
                disabled={!busy && run?.status !== 'running'}
                onClick={() => runAction('stop', { runId: run?.id })}
                className="px-4 py-2 bg-amber-600 text-white text-sm rounded disabled:opacity-50"
              >
                Stop
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Undo the latest run? This restores old Vercel Blob URLs in the DB for migrated items. S3 objects are kept.',
                    )
                  ) {
                    return;
                  }
                  runAction('undo', { runId: run?.id });
                }}
                className="px-4 py-2 border border-gray-400 text-gray-800 text-sm rounded disabled:opacity-50"
              >
                Undo last run
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLogs([]);
                  refreshStatus();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded disabled:opacity-50"
              >
                Refresh / clear logs
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Live log</h2>
              <span className="text-xs text-gray-500">
                {busy ? 'Running…' : 'Idle'} · {logs.length} line(s)
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded h-[480px] overflow-y-auto p-3 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-400">No messages yet. Run Scan to begin.</div>
              ) : (
                logs.map((line) => (
                  <div key={line.id} className={levelClass(line.level)}>
                    <span className="text-gray-400">[{line.ts}]</span>{' '}
                    <span className="uppercase text-[10px] tracking-wide">{line.level}</span>{' '}
                    {line.message}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </ModuleListGuard>
  );
}
