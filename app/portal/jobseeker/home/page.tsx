"use client";

import { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiCheckCircle, FiClock, FiAlertCircle, FiList } from "react-icons/fi";

type Task = { id: number; title?: string; name?: string; status?: string; due_date?: string; priority?: string };

function StatusPill({ value }: { value?: string }) {
  const key = String(value || "").toLowerCase();
  const cls: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
    done: "bg-green-100 text-green-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[key] || "bg-slate-100 text-slate-700"}`}>
      {value || "N/A"}
    </span>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-lg border bg-white p-4 flex items-center gap-4 ${color}`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function JobSeekerHomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const res = await fetch("/api/portal/jobseeker/tasks", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((t) => String(t.status || "").toLowerCase().includes("pending")).length,
    approved: tasks.filter((t) => String(t.status || "").toLowerCase() === "approved").length,
    rejected: tasks.filter((t) => String(t.status || "").toLowerCase() === "rejected").length,
  }), [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Welcome back! Here's an overview of your tasks.</p>
        </div>
        <button type="button" onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <FiRefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Tasks" value={counts.all} icon={<FiList className="text-slate-500" />} color="border-slate-200" />
        <KpiCard label="Pending" value={counts.pending} icon={<FiClock className="text-yellow-500" />} color="border-yellow-200" />
        <KpiCard label="Approved" value={counts.approved} icon={<FiCheckCircle className="text-green-500" />} color="border-green-200" />
        <KpiCard label="Rejected" value={counts.rejected} icon={<FiAlertCircle className="text-red-500" />} color="border-red-200" />
      </div>

      {/* Task list */}
      {!tasks.length ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No tasks assigned yet.
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Your Tasks</h2>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{task.title || task.name || `Task #${task.id}`}</p>
                    {task.due_date && (
                      <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.priority && (
                      <span className="text-xs text-slate-500 capitalize">{task.priority}</span>
                    )}
                    <StatusPill value={task.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
