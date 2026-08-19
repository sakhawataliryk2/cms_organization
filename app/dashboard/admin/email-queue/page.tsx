"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "sonner";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  FiX,
  FiRefreshCw,
  FiAlertTriangle,
} from "react-icons/fi";
import ModuleListGuard from "@/components/ModuleListGuard";
import PermissionGate from "@/components/PermissionGate";
import ActionDropdown from "@/components/ActionDropdown";
import SortableColumnHeader, {
  type ColumnFilterState,
  type ColumnSortState,
} from "@/components/SortableColumnHeader";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import {
  PAGE_SIZE_OPTIONS,
  useServerEntityList,
} from "@/hooks/useServerEntityList";

type EmailRow = {
  id: number;
  status: string;
  template_name: string | null;
  subject: string | null;
  to_emails: string | null;
  from_address: string | null;
  created_at: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  attachments?: Array<{ filename?: string; contentType?: string; size?: number }>;
  source: string | null;
  last_error?: string | null;
};

type QueueStats = {
  queued: number;
  processing: number;
  delayed: number;
  sentToday: number;
  failed: number;
  blocked: number;
  cancelled: number;
  nextScheduledAt: string | null;
  sendingEnabled: boolean;
  delayEnabled: boolean;
  delaySeconds: number;
};

type DatePreset = "today" | "yesterday" | "7d" | "30d" | "custom";

const COLUMNS = [
  { key: "status", label: "Status", filterType: "select" as const },
  { key: "template_name", label: "Template", filterType: "text" as const },
  { key: "subject", label: "Subject", filterType: "text" as const },
  { key: "to_emails", label: "To", filterType: "text" as const },
  { key: "from_address", label: "From", filterType: "text" as const },
  { key: "created_at", label: "Created", filterType: "text" as const },
  { key: "scheduled_at", label: "Scheduled", filterType: "text" as const },
  { key: "sent_at", label: "Sent", filterType: "text" as const },
  { key: "attachments", label: "Attachments", filterType: "text" as const },
  { key: "source", label: "Source", filterType: "text" as const },
];

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Queued", value: "queued" },
  { label: "Delayed", value: "delayed" },
  { label: "Processing", value: "processing" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Blocked", value: "blocked" },
];

const DELAY_PRESETS = [
  { label: "5 seconds", value: 5 },
  { label: "10 seconds", value: 10 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoLocal(d: Date) {
  return d.toISOString();
}

function dateRangeForPreset(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "today") {
    return { dateFrom: toIsoLocal(startOfDay(now)), dateTo: "" };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const from = startOfDay(y);
    const to = startOfDay(now);
    return { dateFrom: toIsoLocal(from), dateTo: toIsoLocal(to) };
  }
  if (preset === "7d") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 7);
    return { dateFrom: toIsoLocal(from), dateTo: "" };
  }
  if (preset === "30d") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 30);
    return { dateFrom: toIsoLocal(from), dateTo: "" };
  }
  return {
    dateFrom: customFrom ? new Date(customFrom).toISOString() : "",
    dateTo: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : "",
  };
}

function formatTs(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString();
}

function statusClass(status: string) {
  switch (status) {
    case "sent":
      return "bg-green-100 text-green-800 border-green-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "blocked":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "delayed":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "cancelled":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-sky-50 text-sky-800 border-sky-200";
  }
}

function cellValue(row: EmailRow, key: string) {
  if (key === "attachments") {
    const n = Array.isArray(row.attachments) ? row.attachments.length : 0;
    if (!n) return "—";
    const names = row.attachments?.map((a) => a.filename).filter(Boolean).join(", ");
    return names ? `${n}: ${names}` : String(n);
  }
  if (key === "created_at" || key === "scheduled_at" || key === "sent_at") {
    return formatTs((row as Record<string, string | null>)[key]);
  }
  if (key === "template_name") return row.template_name || "Unknown Template";
  const v = (row as Record<string, unknown>)[key];
  if (v == null || v === "") return "—";
  return String(v);
}

export default function EmailQueuePage() {
  const router = useRouter();
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const range = useMemo(
    () => dateRangeForPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const extraQueryParams = useMemo(() => {
    const q: Record<string, string> = {};
    if (range.dateFrom) q.dateFrom = range.dateFrom;
    if (range.dateTo) q.dateTo = range.dateTo;
    if (statusFilter) q.status = statusFilter;
    return q;
  }, [range, statusFilter]);

  const list = useServerEntityList<EmailRow>({
    apiPath: "/api/admin/email-queue",
    responseKey: "emails",
    extraQueryParams,
  });

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "stop" | "resume" | "delay-on" | "delay-off">(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    html: string;
    text: string;
    subject: string;
  }>({ open: false, loading: false, error: null, html: "", text: "", subject: "" });

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-queue/stats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load stats");
      }
      setStats({
        queued: data.queued ?? 0,
        processing: data.processing ?? 0,
        delayed: data.delayed ?? 0,
        sentToday: data.sentToday ?? 0,
        failed: data.failed ?? 0,
        blocked: data.blocked ?? 0,
        cancelled: data.cancelled ?? 0,
        nextScheduledAt: data.nextScheduledAt ?? null,
        sendingEnabled: Boolean(data.sendingEnabled),
        delayEnabled: Boolean(data.delayEnabled),
        delaySeconds: Number(data.delaySeconds) || 30,
      });
      setStatsError(null);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "Failed to load stats");
    }
  }, []);

  useEffect(() => {
    void loadStats();
    const t = setInterval(() => void loadStats(), 12_000);
    return () => clearInterval(t);
  }, [loadStats]);

  const refreshAll = async () => {
    list.clearCache();
    await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
  };

  const patchSettings = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-queue/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update settings");
      }
      toast.success("Email queue settings updated");
      await loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const openPreview = async (id: number) => {
    setPreview({
      open: true,
      loading: true,
      error: null,
      html: "",
      text: "",
      subject: "",
    });
    try {
      const res = await fetch(`/api/admin/email-queue/${id}/preview`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load preview");
      }
      setPreview({
        open: true,
        loading: false,
        error: null,
        html: data.email?.html_body || "",
        text: data.email?.text_body || "",
        subject: data.email?.subject || "",
      });
    } catch (e) {
      setPreview({
        open: true,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load preview",
        html: "",
        text: "",
        subject: "",
      });
    }
  };

  const cancelEmail = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/email-queue/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not cancel");
      }
      toast.success("Email cancelled");
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    }
  };

  const sendingEnabled = stats?.sendingEnabled !== false;
  const delayEnabled = Boolean(stats?.delayEnabled);
  const delaySeconds = stats?.delaySeconds || 30;

  const cards = [
    { label: "Queue", value: stats?.queued ?? "—", hint: "Waiting to send" },
    { label: "Sending", value: stats?.processing ?? "—", hint: "In progress now" },
    { label: "Delayed", value: stats?.delayed ?? "—", hint: "Will send after delay" },
    { label: "Sent today", value: stats?.sentToday ?? "—", hint: "Graph accepted" },
    { label: "Failed", value: stats?.failed ?? "—", hint: "Not accepted" },
    { label: "Blocked", value: stats?.blocked ?? "—", hint: "Held during stop" },
  ];

  return (
    <ModuleListGuard module="admin">
      <div className="bg-gray-200 min-h-screen p-4 sm:p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Email Queue</h1>
              <p className="text-sm text-gray-600 mt-1 max-w-3xl">
                Monitor system emails before and after Microsoft Graph accepts them.
                Sent means Graph returned 202 Accepted — not that the recipient inbox confirmed delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin")}
              className="p-2 hover:bg-gray-300 rounded-full"
              aria-label="Close"
            >
              <FiX size={22} />
            </button>
          </div>

          {!sendingEnabled && (
            <div className="mb-4 rounded-md border-2 border-red-500 bg-red-50 px-4 py-3 flex items-start gap-3">
              <FiAlertTriangle className="text-red-600 mt-0.5 shrink-0" size={22} />
              <div>
                <p className="font-semibold text-red-800">Emails Stopped</p>
                <p className="text-sm text-red-700">
                  New system emails are recorded as blocked and will not send when you resume.
                  Queued and delayed emails already waiting will send after resume.
                </p>
              </div>
            </div>
          )}

          {sendingEnabled && (
            <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
              Emails Running — new system mail is accepted by Microsoft Graph (or delayed if delay is on).
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGate permission="admin.email_queue.control">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirm(sendingEnabled ? "stop" : "resume")}
                  className={`px-4 py-2 rounded-md text-sm font-semibold ${
                    sendingEnabled
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  } disabled:opacity-50`}
                >
                  {sendingEnabled ? "Stop Emails" : "Resume Emails"}
                </button>
              </PermissionGate>
              <PermissionGate permission="admin.email_queue.control">
                <label className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={delayEnabled}
                    disabled={saving}
                    onChange={() => setConfirm(delayEnabled ? "delay-off" : "delay-on")}
                  />
                  Email Delay {delayEnabled ? "ON" : "OFF"}
                </label>
                <select
                  value={
                    DELAY_PRESETS.some((p) => p.value === delaySeconds)
                      ? delaySeconds
                      : "custom"
                  }
                  disabled={saving || !delayEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") return;
                    void patchSettings({ delaySeconds: Number(v), delayEnabled: true });
                  }}
                  className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {DELAY_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </PermissionGate>
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          </div>

          {statsError && (
            <p className="text-sm text-red-600 mb-3">{statsError}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 mb-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow-sm p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">{c.label}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{c.value}</p>
                <p className="text-xs text-gray-500 mt-1">{c.hint}</p>
              </div>
            ))}
            <div className="bg-white rounded-lg shadow-sm p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Next email</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {formatTime(stats?.nextScheduledAt)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Next scheduled send</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-gray-200">
              <input
                type="search"
                value={list.searchInput}
                onChange={(e) => list.setSearchInput(e.target.value)}
                placeholder="Search recipient, sender, subject, template"
                className="w-full lg:max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                  className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {datePreset === "custom" && (
                  <>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </>
                )}
              </div>
            </div>

            {list.error && (
              <p className="px-4 py-3 text-sm text-red-600">{list.error}</p>
            )}

            <div className="overflow-x-auto">
              <DndContext collisionDetection={closestCenter} onDragEnd={() => {}}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                      <SortableContext
                        items={COLUMNS.map((c) => c.key)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {COLUMNS.map((col) => (
                          <SortableColumnHeader
                            key={col.key}
                            id={col.key}
                            columnKey={col.key}
                            label={col.label}
                            sortState={(list.columnSorts[col.key] as ColumnSortState) || null}
                            filterValue={(list.columnFilters[col.key] as ColumnFilterState) || null}
                            onSort={() => list.handleColumnSort(col.key)}
                            onFilterChange={(v) => list.handleColumnFilter(col.key, v)}
                            filterType={col.filterType}
                            filterOptions={
                              col.key === "status" ? STATUS_OPTIONS.filter((o) => o.value) : undefined
                            }
                          />
                        ))}
                      </SortableContext>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {list.showTableSkeleton ? (
                      <TableSkeletonRows rowCount={8} columnCount={COLUMNS.length} />
                    ) : list.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={COLUMNS.length + 2}
                          className="px-6 py-10 text-center text-sm text-gray-500"
                        >
                          {list.searchTerm || statusFilter
                            ? "No emails match this search or filter."
                            : "No emails in the last 30 days."}
                        </td>
                      </tr>
                    ) : (
                      list.items.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <ActionDropdown
                              options={[
                                {
                                  label: "Preview",
                                  action: () => void openPreview(row.id),
                                },
                                ...(["queued", "delayed", "blocked"].includes(row.status)
                                  ? [
                                      {
                                        label: "Cancel",
                                        action: () => void cancelEmail(row.id),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </td>
                          {COLUMNS.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-sm text-gray-700 max-w-[220px] truncate"
                              title={cellValue(row, col.key)}
                            >
                              {col.key === "status" ? (
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusClass(row.status)}`}
                                >
                                  {row.status}
                                </span>
                              ) : (
                                cellValue(row, col.key)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DndContext>
            </div>

            <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200">
              <p className="text-sm text-gray-700">
                {list.showTableSkeleton
                  ? "Loading results…"
                  : `Showing ${
                      list.totalCount === 0
                        ? 0
                        : (list.currentPage - 1) * list.pageSize + 1
                    } to ${
                      (list.currentPage - 1) * list.pageSize + list.items.length
                    } of ${list.totalCount ?? list.items.length} emails`}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows per page</label>
                <select
                  value={list.pageSize}
                  onChange={(e) => {
                    list.setPageSize(Number(e.target.value));
                    list.setCurrentPage(1);
                    list.clearCache();
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!list.canGoPrev}
                  onClick={() => list.setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                {list.paginationItems.map((item, idx) =>
                  item === "..." ? (
                    <span key={`e-${idx}`} className="px-1 text-gray-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => list.setCurrentPage(item)}
                      className={`px-3 py-1.5 border rounded text-sm ${
                        list.currentPage === item
                          ? "bg-gray-800 text-white border-gray-800"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={!list.canGoNext}
                  onClick={() => list.setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {confirm === "stop" && "Stop all system emails?"}
                {confirm === "resume" && "Resume system emails?"}
                {confirm === "delay-on" && "Turn email delay on?"}
                {confirm === "delay-off" && "Turn email delay off?"}
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                {confirm === "stop" &&
                  "New emails will be saved as blocked and will not send automatically when you resume. In-flight Graph requests will finish. Queued and delayed emails will wait until resume."}
                {confirm === "resume" &&
                  "Queued and delayed emails will send according to schedule. Blocked emails stay blocked."}
                {confirm === "delay-on" &&
                  `Outgoing emails will wait ${delaySeconds} seconds before Graph send.`}
                {confirm === "delay-off" &&
                  "New emails will send immediately when the system is running."}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md"
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md bg-gray-900 text-white"
                  onClick={() => {
                    if (confirm === "stop") void patchSettings({ sendingEnabled: false });
                    if (confirm === "resume") void patchSettings({ sendingEnabled: true });
                    if (confirm === "delay-on")
                      void patchSettings({ delayEnabled: true, delaySeconds });
                    if (confirm === "delay-off") void patchSettings({ delayEnabled: false });
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {preview.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Email preview</h2>
                  <p className="text-sm text-gray-500 truncate max-w-xl">
                    {preview.subject || "(no subject)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview((p) => ({ ...p, open: false }))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <FiX size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {preview.loading && (
                  <p className="text-sm text-gray-500">Loading preview…</p>
                )}
                {preview.error && (
                  <p className="text-sm text-red-600">{preview.error}</p>
                )}
                {!preview.loading && !preview.error && preview.html && (
                  <iframe
                    title="Email HTML preview"
                    sandbox=""
                    srcDoc={preview.html}
                    className="w-full min-h-[480px] border border-gray-200 rounded bg-white"
                  />
                )}
                {!preview.loading && !preview.error && !preview.html && (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">
                    {preview.text || "No email body stored."}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleListGuard>
  );
}
