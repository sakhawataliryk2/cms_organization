"use client";

import { useEffect, useMemo, useState } from "react";
import KpiCard from "@/components/portal/KpiCard";
import LoadingState from "@/components/portal/LoadingState";
import EmptyState from "@/components/portal/EmptyState";
import StatusPill from "@/components/portal/StatusPill";

export default function JobSeekerHomePage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/jobseeker/tasks", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const all = tasks.length;
    const pending = tasks.filter((t) => String(t?.status || "").toLowerCase().includes("pending")).length;
    const approved = tasks.filter((t) => String(t?.status || "").toLowerCase() === "approved").length;
    const rejected = tasks.filter((t) => String(t?.status || "").toLowerCase() === "rejected").length;
    return { all, pending, approved, rejected };
  }, [tasks]);

  if (loading) return <LoadingState text="Loading tasks..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard label="Total" value={counts.all} />
        <KpiCard label="Pending" value={counts.pending} />
        <KpiCard label="Approved" value={counts.approved} />
        <KpiCard label="Rejected" value={counts.rejected} />
      </div>
      {!tasks.length ? (
        <EmptyState text="No tasks found." />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{task.title || task.name || `Task #${task.id}`}</p>
                <StatusPill value={task.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

