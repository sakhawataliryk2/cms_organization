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
  FiClock,
  FiCalendar,
  FiStopCircle,
  FiPlay,
  FiTrash2,
  FiLoader,
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
  stopped_at: string | null;
  resume_at: string | null;
  stop_reason: string | null;
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
  stopped: number;
  nextScheduledAt: string | null;
  sendingEnabled: boolean;
  delayEnabled: boolean;
  delaySeconds: number;
};

type SourceControl = {
  source: string;
  paused: boolean;
  paused_until: string | null;
};

function getMaxPauseDatetimeLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toDatetimeLocal(d);
}

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

const PENDING_STATUSES = ["queued", "delayed", "processing", "blocked", "stopped"];
const HISTORY_STATUSES = ["sent", "failed", "cancelled"];

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Queued", value: "queued" },
  { label: "Delayed", value: "delayed" },
  { label: "Processing", value: "processing" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Blocked", value: "blocked" },
  { label: "Stopped", value: "stopped" },
];

type QueueTab = "pending" | "history" | "sources";
type DatePreset = "today" | "yesterday" | "7d" | "30d" | "custom";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoLocal(d: Date) {
  return d.toISOString();
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getNowDatetimeLocal() {
  return toDatetimeLocal(new Date());
}

function getMaxDatetimeLocal() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return toDatetimeLocal(d);
}

function addHours(d: Date, h: number) {
  const r = new Date(d);
  r.setHours(r.getHours() + h);
  return r;
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

function formatStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Queued",
    delayed: "Delayed",
    processing: "Sending",
    sent: "Sent",
    failed: "Failed",
    cancelled: "Cancelled",
    blocked: "Blocked",
    stopped: "Stopped",
  };
  const key = String(status || "").toLowerCase();
  if (labels[key]) return labels[key];
  if (!key) return "—";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function wrapPreviewHtml(html: string) {
  const fontCss = `
    html, body { margin: 0; padding: 16px; background: #fff; }
    body, table, td, th, p, div, span, li, a, strong, em, b, i, u, h1, h2, h3, h4, h5, h6 {
      font-family: Arial, Helvetica, sans-serif !important;
    }
    body { font-size: 14px; line-height: 1.5; color: #111827; }
  `;
  const raw = String(html || "");
  if (/<html[\s>]/i.test(raw)) {
    if (/<head[\s>]/i.test(raw)) {
      return raw.replace(/<head([^>]*)>/i, `<head$1><style>${fontCss}</style>`);
    }
    return raw.replace(/<html([^>]*)>/i, `<html$1><head><style>${fontCss}</style></head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fontCss}</style></head><body>${raw}</body></html>`;
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
    case "stopped":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-sky-50 text-sky-800 border-sky-200";
  }
}

function ModalSpinner() {
  return <FiLoader className="animate-spin shrink-0" size={16} aria-hidden />;
}

function formatSourceLabel(source: string | null | undefined) {
  const raw = String(source || "").trim();
  if (!raw) return "—";
  const labels: Record<string, string> = {
    "benefit-package": "Benefit Package",
    "credit-check": "Credit Check",
    "duplicate-check-report": "Duplicate Check Report",
    "hm-portal-sync": "Hiring Manager Portal Sync",
    "hm-portal-auth": "Hiring Manager Portal Auth",
    "js-portal-auth": "Job Seeker Portal Auth",
    "insurance-request": "Insurance Request",
    "onboarding": "Onboarding",
    "onboarding-missing-report": "Onboarding Missing Report",
    "onboarding-reminder": "Onboarding Reminder",
    "task-reminder": "Task Reminder",
    "job-distribution": "Job Distribution",
    "public-job-apply": "Public Job Apply",
    "client-submission": "Client Submission",
    "delete-request": "Delete Request",
    "hiring-manager": "Hiring Manager",
    "job-seeker": "Job Seeker",
    "hm-transfer": "Hiring Manager Transfer",
    "js-transfer": "Job Seeker Transfer",
    "auth-2fa": "Auth 2FA",
    "auth-reset": "Auth Reset",
  };
  if (labels[raw]) return labels[raw];
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cellValue(row: EmailRow, key: string) {
  if (key === "attachments") {
    const n = Array.isArray(row.attachments) ? row.attachments.length : 0;
    if (!n) return "—";
    const names = row.attachments?.map((a) => a.filename).filter(Boolean).join(", ");
    return names ? `${n}: ${names}` : String(n);
  }
  if (key === "created_at" || key === "scheduled_at" || key === "sent_at") {
    return formatTs(row[key]);
  }
  if (key === "template_name") return row.template_name || "Unknown Template";
  if (key === "source") return formatSourceLabel(row.source);
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
  const [sourceFilter, setSourceFilter] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("pending");
  const range = useMemo(
    () => dateRangeForPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const extraQueryParams = useMemo(() => {
    const q: Record<string, string> = {};
    if (range.dateFrom) q.dateFrom = range.dateFrom;
    if (range.dateTo) q.dateTo = range.dateTo;
    if (statusFilter) q.status = statusFilter;
    if (sourceFilter) q.source = sourceFilter;
    q.bucket = queueTab === "history" ? "history" : "pending";
    return q;
  }, [range, statusFilter, sourceFilter, queueTab]);

  const tabStatusOptions = useMemo(() => {
    const allowed = queueTab === "history" ? HISTORY_STATUSES : PENDING_STATUSES;
    return STATUS_OPTIONS.filter((o) => !o.value || allowed.includes(o.value));
  }, [queueTab]);

  const list = useServerEntityList<EmailRow>({
    apiPath: "/api/admin/email-queue",
    responseKey: "emails",
    extraQueryParams,
    enabled: queueTab !== "sources",
  });

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "stop" | "resume" | "delay-on" | "delay-off" | "clear-history">(null);
  const [saving, setSaving] = useState(false);
  const [customDelayValue, setCustomDelayValue] = useState("");
  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    emailId: number | null;
    subject: string;
  }>({ open: false, emailId: null, subject: "" });
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [sourceControls, setSourceControls] = useState<SourceControl[]>([]);
  const [sourceSaving, setSourceSaving] = useState<string | null>(null);
  const [sourceUntil, setSourceUntil] = useState<Record<string, string>>({});
  const [stopModal, setStopModal] = useState<{ open: boolean; ids: number[]; until: string }>({
    open: false,
    ids: [],
    until: "",
  });
  const [batchSaving, setBatchSaving] = useState(false);
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
        stopped: data.stopped ?? 0,
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

  useEffect(() => {
    fetch("/api/admin/email-queue/sources", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setAvailableSources(d.sources || []); })
      .catch(() => {});
  }, []);

  const loadSourceControls = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-queue/source-controls", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success) setSourceControls(data.sources || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadSourceControls();
  }, [loadSourceControls]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [list.currentPage]);

  const refreshAll = async () => {
    list.clearCache();
    await Promise.all([loadStats(), loadSourceControls(), list.fetchPage(list.currentPage)]);
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

  const clearHistory = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-queue/clear-history", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to clear history");
      }
      toast.success(`${data.deleted || 0} history email(s) removed`);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear history");
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

  const openReschedule = (id: number, subject: string) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    setRescheduleValue(toDatetimeLocal(now));
    setRescheduleModal({ open: true, emailId: id, subject });
  };

  const rescheduleEmail = async () => {
    if (!rescheduleModal.emailId || !rescheduleValue) return;
    setRescheduleSaving(true);
    try {
      const scheduledAt = new Date(rescheduleValue).toISOString();
      const res = await fetch(`/api/admin/email-queue/${rescheduleModal.emailId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not reschedule");
      }
      toast.success("Email rescheduled");
      setRescheduleModal({ open: false, emailId: null, subject: "" });
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      setRescheduleSaving(false);
    }
  };

  const sendingEnabled = stats?.sendingEnabled !== false;
  const delayEnabled = Boolean(stats?.delayEnabled);
  const delaySeconds = stats?.delaySeconds || 30;

  const openStopModal = (ids: number[]) => {
    if (!ids.length) return;
    setStopModal({ open: true, ids, until: "" });
  };

  const confirmStop = async () => {
    const ids = stopModal.ids;
    if (!ids.length) return;
    const resumeAt = stopModal.until ? new Date(stopModal.until).toISOString() : undefined;
    setBatchSaving(true);
    try {
      if (ids.length === 1) {
        const res = await fetch(`/api/admin/email-queue/${ids[0]}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeAt }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || "Could not stop");
        toast.success(resumeAt ? "Email stopped until the selected time" : "Email stopped");
      } else {
        const res = await fetch("/api/admin/email-queue/batch-stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, resumeAt }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || "Batch stop failed");
        toast.success(`${data.stopped || 0} email(s) stopped`);
        setSelectedIds(new Set());
      }
      setStopModal({ open: false, ids: [], until: "" });
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop");
    } finally {
      setBatchSaving(false);
    }
  };

  const stopEmail = (id: number) => openStopModal([id]);

  const resumeEmail = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/email-queue/${id}/resume`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Could not resume");
      toast.success("Email resumed");
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resume email");
    }
  };

  const batchStop = () => openStopModal(Array.from(selectedIds));

  const batchResume = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBatchSaving(true);
    try {
      const res = await fetch("/api/admin/email-queue/batch-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Batch resume failed");
      toast.success(`${data.resumed || 0} email(s) resumed`);
      setSelectedIds(new Set());
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch resume failed");
    } finally {
      setBatchSaving(false);
    }
  };

  const delayEmail = async (id: number, minutes: number) => {
    try {
      const scheduledAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const res = await fetch(`/api/admin/email-queue/${id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Could not delay");
      toast.success(`Delayed ${minutes} minutes`);
      list.clearCache();
      await Promise.all([loadStats(), list.fetchPage(list.currentPage)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delay email");
    }
  };

  const pauseSource = async (source: string, until?: string) => {
    setSourceSaving(source);
    try {
      const res = await fetch("/api/admin/email-queue/source-controls/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          until: until ? new Date(until).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Could not pause source");
      toast.success(
        until
          ? `Paused ${source} until the selected time (${data.stopped || 0} queued email(s) stopped)`
          : `Paused ${source} permanently (${data.stopped || 0} queued email(s) stopped)`,
      );
      await Promise.all([loadSourceControls(), refreshAll()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not pause source");
    } finally {
      setSourceSaving(null);
    }
  };

  const resumeSource = async (source: string) => {
    setSourceSaving(source);
    try {
      const res = await fetch("/api/admin/email-queue/source-controls/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Could not resume source");
      toast.success(`Resumed ${source} (${data.resumed || 0} email(s) queued)`);
      await Promise.all([loadSourceControls(), refreshAll()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resume source");
    } finally {
      setSourceSaving(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === list.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.items.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const switchQueueTab = (tab: QueueTab) => {
    if (tab === queueTab) return;
    setQueueTab(tab);
    setSelectedIds(new Set());
    if (tab === "sources") return;
    const allowed = tab === "pending" ? PENDING_STATUSES : HISTORY_STATUSES;
    if (statusFilter && !allowed.includes(statusFilter)) setStatusFilter("");
    const colStatus = String(list.columnFilters.status || "").trim();
    if (colStatus && !allowed.includes(colStatus)) {
      list.handleColumnFilter("status", "");
    }
  };

  const cards = [
    { label: "Queue", value: stats?.queued ?? "—", hint: "Waiting to send" },
    { label: "Sending", value: stats?.processing ?? "—", hint: "In progress now" },
    { label: "Delayed", value: stats?.delayed ?? "—", hint: "Will send after delay" },
    { label: "Sent today", value: stats?.sentToday ?? "—", hint: "Graph accepted" },
    { label: "Failed", value: stats?.failed ?? "—", hint: "Not accepted" },
    { label: "Blocked", value: stats?.blocked ?? "—", hint: "Held during stop" },
    { label: "Stopped", value: stats?.stopped ?? "—", hint: "Manually stopped" },
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
                <>
                <label className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={delayEnabled}
                    disabled={saving}
                    onChange={() => setConfirm(delayEnabled ? "delay-off" : "delay-on")}
                  />
                  Email Delay {delayEnabled ? "ON" : "OFF"}
                </label>
                {delayEnabled && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                      <FiClock size={14} />
                      Send at:
                    </label>
                    <input
                      type="datetime-local"
                      value={customDelayValue}
                      min={getNowDatetimeLocal()}
                      max={getMaxDatetimeLocal()}
                      disabled={saving}
                      onChange={(e) => setCustomDelayValue(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={saving || !customDelayValue}
                      onClick={() => {
                        if (!customDelayValue) return;
                        const now = new Date();
                        const target = new Date(customDelayValue);
                        const secs = Math.max(5, Math.round((target.getTime() - now.getTime()) / 1000));
                        void patchSettings({
                          delaySeconds: secs,
                          delayEnabled: true,
                        });
                      }}
                      className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                )}
                </>
              </PermissionGate>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate permission="admin.email_queue.control">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirm("clear-history")}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 rounded-md text-sm bg-white hover:bg-red-50 disabled:opacity-50"
                >
                  <FiTrash2 size={16} />
                  Clear history
                </button>
              </PermissionGate>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
              >
                <FiRefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {statsError && (
            <p className="text-sm text-red-600 mb-3">{statsError}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
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
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => switchQueueTab("pending")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                  queueTab === "pending"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                To be sent
              </button>
              <button
                type="button"
                onClick={() => switchQueueTab("history")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                  queueTab === "history"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Sent
              </button>
              <button
                type="button"
                onClick={() => switchQueueTab("sources")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                  queueTab === "sources"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Source pause
              </button>
              <p className="ml-auto px-4 py-3 text-xs text-gray-500 hidden sm:block">
                {queueTab === "pending"
                  ? "Queued, delayed, processing, blocked, and stopped"
                  : queueTab === "history"
                    ? "Delivered, failed, and cancelled"
                    : "Pause crons and modules by source"}
              </p>
            </div>
            {queueTab === "sources" ? (
            <div className="p-4">
            <p className="text-xs text-gray-500 mb-3">
              Pause a source to stop that type only — including future cron runs. Leave the time empty for a permanent pause, or pick a time (up to 7 days) to auto-resume.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Resume at</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceControls.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                        No sources found yet.
                      </td>
                    </tr>
                  ) : sourceControls.map((row) => (
                    <tr key={row.source} className="border-t border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">{formatSourceLabel(row.source)}</td>
                      <td className="py-2 pr-3">
                        {row.paused ? (
                          <span className="text-red-700">Paused</span>
                        ) : (
                          <span className="text-green-700">Active</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {row.paused_until ? formatTs(row.paused_until) : row.paused ? "Until resume" : "—"}
                      </td>
                      <td className="py-2">
                        <PermissionGate permission="admin.email_queue.control">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.paused ? (
                              <button
                                type="button"
                                disabled={sourceSaving === row.source}
                                onClick={() => void resumeSource(row.source)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-green-600 text-white disabled:opacity-50"
                              >
                                {sourceSaving === row.source ? (
                                  <>
                                    <ModalSpinner />
                                    Resuming…
                                  </>
                                ) : (
                                  "Resume source"
                                )}
                              </button>
                            ) : (
                              <>
                                <input
                                  type="datetime-local"
                                  value={sourceUntil[row.source] || ""}
                                  min={getNowDatetimeLocal()}
                                  max={getMaxPauseDatetimeLocal()}
                                  disabled={sourceSaving === row.source}
                                  onChange={(e) =>
                                    setSourceUntil((prev) => ({ ...prev, [row.source]: e.target.value }))
                                  }
                                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50"
                                />
                                <button
                                  type="button"
                                  disabled={sourceSaving === row.source}
                                  onClick={() => void pauseSource(row.source, sourceUntil[row.source])}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-red-600 text-white disabled:opacity-50"
                                >
                                  {sourceSaving === row.source ? (
                                    <>
                                      <ModalSpinner />
                                      Pausing…
                                    </>
                                  ) : sourceUntil[row.source] ? (
                                    "Pause until"
                                  ) : (
                                    "Pause permanently"
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            ) : (
            <>
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
                  {tabStatusOptions.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    list.clearCache();
                  }}
                  className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All sources</option>
                  {availableSources.map((s) => (
                    <option key={s} value={s}>{formatSourceLabel(s)}</option>
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
              {queueTab === "pending" && selectedIds.size > 0 && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
                  <span className="text-sm text-blue-800 font-medium">
                    {selectedIds.size} email(s) selected
                  </span>
                  <PermissionGate permission="admin.email_queue.control">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={batchSaving}
                        onClick={() => void batchStop()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50"
                      >
                        <FiStopCircle size={13} />
                        Stop Selected
                      </button>
                      <button
                        type="button"
                        disabled={batchSaving}
                        onClick={() => void batchResume()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 disabled:opacity-50"
                      >
                        <FiPlay size={13} />
                        Resume Selected
                      </button>
                    </div>
                  </PermissionGate>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                  >
                    Clear selection
                  </button>
                </div>
              )}
              <DndContext collisionDetection={closestCenter} onDragEnd={() => {}}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {queueTab === "pending" && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                        <input
                          type="checkbox"
                          checked={list.items.length > 0 && selectedIds.size === list.items.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      )}
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
                              col.key === "status" ? tabStatusOptions.filter((o) => o.value) : undefined
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
                          colSpan={COLUMNS.length + (queueTab === "pending" ? 3 : 2)}
                          className="px-6 py-10 text-center text-sm text-gray-500"
                        >
                          {list.searchTerm || statusFilter
                            ? "No emails match this search or filter."
                            : queueTab === "pending"
                              ? "No emails waiting to send."
                              : "No sent, failed, or cancelled emails in this date range."}
                        </td>
                      </tr>
                    ) : (
                      list.items.map((row) => (
                        <tr key={row.id} className={`hover:bg-gray-50 ${selectedIds.has(row.id) ? "bg-blue-50" : ""}`}>
                          {queueTab === "pending" && (
                          <td className="px-4 py-3 whitespace-nowrap w-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          )}
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
                                          label: "Stop",
                                          action: () => void stopEmail(row.id),
                                        },
                                        {
                                          label: "Delay 15 min",
                                          action: () => void delayEmail(row.id, 15),
                                        },
                                        {
                                          label: "Delay 1 hour",
                                          action: () => void delayEmail(row.id, 60),
                                        },
                                      ]
                                    : []),
                                  ...(row.status === "stopped"
                                    ? [
                                        {
                                          label: "Resume",
                                          action: () => void resumeEmail(row.id),
                                        },
                                      ]
                                    : []),
                                  ...(["queued", "delayed", "cancelled", "stopped"].includes(row.status)
                                    ? [
                                        {
                                          label: "Reschedule",
                                          action: () => void openReschedule(row.id, row.subject || ""),
                                        },
                                      ]
                                    : []),
                                  ...(["queued", "delayed", "blocked", "stopped"].includes(row.status)
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
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass(row.status)}`}
                                  title={
                                    row.status === "stopped" && row.resume_at
                                      ? `Resumes ${formatTs(row.resume_at)}`
                                      : undefined
                                  }
                                >
                                  {formatStatusLabel(row.status)}
                                  {row.status === "stopped" && row.resume_at ? " until time" : ""}
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
            </>
            )}
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
                {confirm === "clear-history" && "Clear email queue history?"}
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                {confirm === "stop" &&
                  "New emails will be saved as blocked and will not send automatically when you resume. In-flight Graph requests will finish. Queued and delayed emails will wait until resume."}
                {confirm === "resume" &&
                  "Queued and delayed emails will send according to schedule. Blocked emails stay blocked."}
                {confirm === "delay-on" &&
                  "Outgoing emails will be delayed. Use the time picker to set exactly when delayed emails should send (up to 24 hours ahead)."}
                {confirm === "delay-off" &&
                  "New emails will send immediately when the system is running."}
                {confirm === "clear-history" &&
                  "This deletes sent, failed, and cancelled emails from the queue log. Queued, delayed, stopped, and blocked emails are kept."}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                  onClick={() => {
                    if (!saving) setConfirm(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  aria-busy={saving}
                  className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] px-3 py-2 text-sm rounded-md bg-gray-900 text-white disabled:opacity-70"
                  onClick={() => {
                    if (saving) return;
                    if (confirm === "stop") void patchSettings({ sendingEnabled: false });
                    if (confirm === "resume") void patchSettings({ sendingEnabled: true });
                    if (confirm === "delay-on")
                      void patchSettings({ delayEnabled: true, delaySeconds });
                    if (confirm === "delay-off") void patchSettings({ delayEnabled: false });
                    if (confirm === "clear-history") void clearHistory();
                  }}
                >
                  {saving ? (
                    <>
                      <ModalSpinner />
                      {confirm === "clear-history"
                        ? "Clearing…"
                        : confirm === "stop"
                          ? "Stopping…"
                          : confirm === "resume"
                            ? "Resuming…"
                            : "Saving…"}
                    </>
                  ) : (
                    "Confirm"
                  )}
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
                    srcDoc={wrapPreviewHtml(preview.html)}
                    className="w-full min-h-[480px] border border-gray-200 rounded bg-white"
                  />
                )}
                {!preview.loading && !preview.error && !preview.html && (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                    {preview.text || "No email body stored."}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {rescheduleModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Reschedule Email</h2>
                <button
                  type="button"
                  disabled={rescheduleSaving}
                  onClick={() => {
                    if (!rescheduleSaving) {
                      setRescheduleModal({ open: false, emailId: null, subject: "" });
                    }
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
                >
                  <FiX size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-1 truncate">
                {rescheduleModal.subject || "(no subject)"}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Pick a new send time within the next 24 hours.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <FiCalendar size={16} className="text-gray-400 shrink-0" />
                <input
                  type="datetime-local"
                  value={rescheduleValue}
                  min={getNowDatetimeLocal()}
                  max={getMaxDatetimeLocal()}
                  disabled={rescheduleSaving}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={rescheduleSaving}
                  onClick={() => {
                    if (!rescheduleSaving) {
                      setRescheduleModal({ open: false, emailId: null, subject: "" });
                    }
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rescheduleSaving || !rescheduleValue}
                  aria-busy={rescheduleSaving}
                  onClick={() => {
                    if (!rescheduleSaving) void rescheduleEmail();
                  }}
                  className="inline-flex items-center justify-center gap-2 min-w-[8.5rem] px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-70"
                >
                  {rescheduleSaving ? (
                    <>
                      <ModalSpinner />
                      Saving…
                    </>
                  ) : (
                    "Reschedule"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {stopModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Stop {stopModal.ids.length} email{stopModal.ids.length === 1 ? "" : "s"}?
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Leave the time empty to stop until you resume. Or pick a time (up to 7 days) to auto-resume.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <FiClock size={16} className="text-gray-400 shrink-0" />
                <input
                  type="datetime-local"
                  value={stopModal.until}
                  min={getNowDatetimeLocal()}
                  max={getMaxPauseDatetimeLocal()}
                  disabled={batchSaving}
                  onChange={(e) => setStopModal((prev) => ({ ...prev, until: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={batchSaving}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                  onClick={() => {
                    if (!batchSaving) setStopModal({ open: false, ids: [], until: "" });
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={batchSaving}
                  aria-busy={batchSaving}
                  className="inline-flex items-center justify-center gap-2 min-w-[9.5rem] px-3 py-2 text-sm rounded-md bg-red-600 text-white disabled:opacity-70"
                  onClick={() => {
                    if (!batchSaving) void confirmStop();
                  }}
                >
                  {batchSaving ? (
                    <>
                      <ModalSpinner />
                      Stopping…
                    </>
                  ) : stopModal.until ? (
                    "Stop until time"
                  ) : (
                    "Stop permanently"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleListGuard>
  );
}
