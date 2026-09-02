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
  estimated_tokens?: number;
  estimated_cost_usd?: number | string;
  actual_tokens?: number;
  actual_cost_usd?: number | string;
  last_error?: string | null;
  started_by_name?: string | null;
  cost_breakdown?: CostBreakdown | null;
};

type EntityCost = {
  active?: number;
  alreadyEmbedded?: number;
  missing?: number;
  sampled?: number;
  eligibleToEmbed?: number;
  ineligible?: number;
  estimatedTokens?: number;
  estimatedUsd?: number;
};

type CostBreakdown = {
  mode?: string;
  model?: string;
  usdPerMillionTokens?: number;
  tokenEstimate?: string;
  seekers?: EntityCost;
  jobs?: EntityCost;
  totals?: {
    toEmbed?: number;
    ineligible?: number;
    alreadyEmbedded?: number;
    missing?: number;
    estimatedTokens?: number;
    estimatedUsd?: number;
    actualTokens?: number;
    actualUsd?: number;
  };
};

function formatUsd(n: unknown) {
  const v = Number(n) || 0;
  if (v === 0) return '$0.00';
  if (Math.abs(v) < 0.01) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(2)}`;
}

function formatN(n: unknown) {
  return Number(n || 0).toLocaleString('en-US');
}

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

export default function SmartMatchMigrationPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [status, setStatus] = useState<{
    env?: {
      ok?: boolean;
      configured?: boolean;
      canMigrate?: boolean;
      summary?: string;
      missing?: string[];
    };
    counts?: {
      seekers?: { active?: number; missing?: number; eligible?: number; ineligible?: number };
      jobs?: { active?: number; missing?: number; eligible?: number; ineligible?: number };
    };
    pricing?: { model?: string; usdPerMillionTokens?: number };
    latestRun?: RunInfo | null;
    activeRun?: RunInfo | null;
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
      const res = await fetch('/api/admin/smart-match-migration/status', {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success) {
        setStatus(data);
        const fromRun = data?.activeRun?.cost_breakdown || data?.latestRun?.cost_breakdown;
        if (fromRun && typeof fromRun === 'object') {
          setCost(fromRun as CostBreakdown);
        }
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
          '/api/admin/smart-match-migration/stop',
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
        await fetch('/api/admin/smart-match-migration/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        abortRef.current?.abort();
        appendLog('warn', 'Stop requested — finishing current batch, then pausing.');
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
      const res = await fetch(`/api/admin/smart-match-migration/${action}`, {
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
        if (evt.type === 'cost' && evt.cost && typeof evt.cost === 'object') {
          setCost(evt.cost as CostBreakdown);
        }
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
  const env = status?.env;
  const counts = status?.counts;
  const totals = cost?.totals;

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
                  Smart Match Migration
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  One-time embeddings for existing jobs and job seekers
                </p>
                <p className="text-xs text-gray-500 mt-2 max-w-2xl">
                  Same steps as Storage Migration: Validate env → Scan → Dry run (cost) →
                  Start. Runs against this environment&apos;s database. New and updated
                  records embed on save; this page only backfills what is already there.
                  Closing the browser stops after the current batch. Use Resume to continue.
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
                <div className="font-medium text-gray-800 mb-2">Environment</div>
                <div className="text-gray-600 space-y-1 font-mono text-xs">
                  <div>model: {String(status?.pricing?.model ?? '—')}</div>
                  <div>
                    price: {formatUsd(status?.pricing?.usdPerMillionTokens)} / 1M tokens
                  </div>
                  <div>env ok: {String(env?.ok ?? '—')}</div>
                  <div>can migrate: {String(env?.canMigrate ?? '—')}</div>
                  {env?.missing && env.missing.length > 0 ? (
                    <div className="text-red-600">missing: {env.missing.join(', ')}</div>
                  ) : null}
                  {env?.summary ? (
                    <div className="text-gray-700 whitespace-pre-wrap normal-case font-sans text-xs mt-1">
                      {env.summary}
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 mt-3 space-y-1">
                  <div>
                    Seekers: {formatN(counts?.seekers?.missing)} missing /{' '}
                    {formatN(counts?.seekers?.active)} active (
                    {formatN(counts?.seekers?.eligible)} indexed)
                  </div>
                  <div>
                    Jobs: {formatN(counts?.jobs?.missing)} missing /{' '}
                    {formatN(counts?.jobs?.active)} active (
                    {formatN(counts?.jobs?.eligible)} indexed)
                  </div>
                </div>
              </div>
              <div className="border border-gray-200 rounded p-3">
                <div className="font-medium text-gray-800 mb-2">Latest / active run</div>
                {run ? (
                  <div className="text-gray-600 space-y-1 text-xs font-mono">
                    <div>id: {run.id}</div>
                    <div>status: {run.status}</div>
                    <div>found: {run.total_found ?? 0}</div>
                    <div>pending: {run.total_pending ?? 0}</div>
                    <div>embedded: {run.total_migrated ?? 0}</div>
                    <div>failed: {run.total_failed ?? 0}</div>
                    <div>skipped: {run.total_skipped ?? 0}</div>
                    <div>
                      billed: {formatN(run.actual_tokens)} tokens (
                      {formatUsd(run.actual_cost_usd)})
                    </div>
                    {run.last_error ? (
                      <div className="text-red-600 whitespace-pre-wrap">{run.last_error}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No runs yet</div>
                )}
              </div>
            </div>

            {cost ? (
              <div className="border border-gray-200 rounded p-3 text-sm">
                <div className="font-medium text-gray-800 mb-2">
                  Cost breakdown
                  {cost.mode ? (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({cost.mode === 'scan'
                        ? 'scan sample'
                        : cost.mode === 'dry_run'
                          ? 'dry run'
                          : 'migration'})
                    </span>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="py-1 pr-3 font-medium">Entity</th>
                        <th className="py-1 pr-3 font-medium">To embed</th>
                        <th className="py-1 pr-3 font-medium">Ineligible</th>
                        <th className="py-1 pr-3 font-medium">Already indexed</th>
                        <th className="py-1 pr-3 font-medium">Est. tokens</th>
                        <th className="py-1 font-medium">Est. cost</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800">
                      <tr>
                        <td className="py-1 pr-3">Job seekers</td>
                        <td className="py-1 pr-3">{formatN(cost.seekers?.eligibleToEmbed)}</td>
                        <td className="py-1 pr-3">{formatN(cost.seekers?.ineligible)}</td>
                        <td className="py-1 pr-3">{formatN(cost.seekers?.alreadyEmbedded)}</td>
                        <td className="py-1 pr-3">{formatN(cost.seekers?.estimatedTokens)}</td>
                        <td className="py-1">{formatUsd(cost.seekers?.estimatedUsd)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-3">Jobs</td>
                        <td className="py-1 pr-3">{formatN(cost.jobs?.eligibleToEmbed)}</td>
                        <td className="py-1 pr-3">{formatN(cost.jobs?.ineligible)}</td>
                        <td className="py-1 pr-3">{formatN(cost.jobs?.alreadyEmbedded)}</td>
                        <td className="py-1 pr-3">{formatN(cost.jobs?.estimatedTokens)}</td>
                        <td className="py-1">{formatUsd(cost.jobs?.estimatedUsd)}</td>
                      </tr>
                      <tr className="border-t font-medium">
                        <td className="py-1 pr-3">Total</td>
                        <td className="py-1 pr-3">{formatN(totals?.toEmbed)}</td>
                        <td className="py-1 pr-3">{formatN(totals?.ineligible)}</td>
                        <td className="py-1 pr-3">{formatN(totals?.alreadyEmbedded)}</td>
                        <td className="py-1 pr-3">{formatN(totals?.estimatedTokens)}</td>
                        <td className="py-1">{formatUsd(totals?.estimatedUsd)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {totals?.actualTokens ? (
                  <p className="text-xs text-gray-600 mt-2">
                    Actual billed this run: {formatN(totals.actualTokens)} tokens (
                    {formatUsd(totals.actualUsd)})
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">
                    Estimates use chars/4. OpenRouter bills actual tokens at{' '}
                    {formatUsd(cost.usdPerMillionTokens)} / 1M. Scan samples missing rows;
                    Dry run walks all of them with no API writes.
                  </p>
                )}
              </div>
            ) : null}

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
                      'Start embedding existing jobs and job seekers? This calls OpenRouter and writes vectors. Stop-on-first-error is enabled. Use Resume if you pause.',
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
                  setLogs([]);
                  refreshStatus();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded disabled:opacity-50"
              >
                Refresh / clear logs
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => router.push('/dashboard/admin/storage-migration')}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded disabled:opacity-50"
              >
                Storage Migration
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
