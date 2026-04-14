"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type ActiveImportJob = {
  id: string;
  entity_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
};

type ImportQueueContextValue = {
  activeJobs: ActiveImportJob[];
  pendingCount: number;
  isLoading: boolean;
  hasActiveEntityQueue: (entityType: string) => boolean;
  entityLabelByType: (entityType: string) => string;
  refreshNow: () => Promise<void>;
};

const ImportQueueContext = createContext<ImportQueueContextValue | null>(null);
const FALLBACK_QUEUE_CONTEXT: ImportQueueContextValue = {
  activeJobs: [],
  pendingCount: 0,
  isLoading: false,
  hasActiveEntityQueue: () => false,
  entityLabelByType: (entityType: string) => ENTITY_LABEL_BY_TYPE[entityType] || entityType,
  refreshNow: async () => undefined,
};

const ENTITY_LABEL_BY_TYPE: Record<string, string> = {
  organizations: "Organization",
  "job-seekers": "Job Seeker",
  jobs: "Job",
  "hiring-managers": "Hiring Manager",
  placements: "Placement",
  leads: "Lead",
};

export function ImportQueueProvider({ children }: { children: React.ReactNode }) {
  const [activeJobs, setActiveJobs] = useState<ActiveImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const completedNotifiedRef = useRef<Set<string>>(new Set());

  const refreshNow = async () => {
    setIsLoading(true);
    try {
      const prev = activeJobs;
      // Advance one queue chunk globally so imports continue even if user leaves uploader page.
      await fetch("/api/admin/data-uploader/import/drain", {
        method: "POST",
        cache: "no-store",
      }).catch(() => undefined);
      const res = await fetch("/api/admin/data-uploader/import/jobs?limit=100", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const jobs = (data?.jobs || []) as ActiveImportJob[];
      const nextById = new Set(jobs.map((j) => j.id));
      for (const oldJob of prev) {
        if (!nextById.has(oldJob.id) && !completedNotifiedRef.current.has(oldJob.id)) {
          completedNotifiedRef.current.add(oldJob.id);
          const label = ENTITY_LABEL_BY_TYPE[oldJob.entity_type] || oldJob.entity_type;
          toast.success(`${label} queue completed`);
        }
      }
      setActiveJobs(jobs);
    } catch {
      // keep existing values to avoid noisy UX
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshNow();
    const id = setInterval(refreshNow, 2500);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<ImportQueueContextValue>(
    () => ({
      activeJobs,
      pendingCount: activeJobs.length,
      isLoading,
      hasActiveEntityQueue: (entityType: string) =>
        activeJobs.some((j) => j.entity_type === entityType && (j.status === "pending" || j.status === "processing")),
      entityLabelByType: (entityType: string) => ENTITY_LABEL_BY_TYPE[entityType] || entityType,
      refreshNow,
    }),
    [activeJobs, isLoading]
  );

  return <ImportQueueContext.Provider value={value}>{children}</ImportQueueContext.Provider>;
}

export function useImportQueue() {
  const ctx = useContext(ImportQueueContext);
  return ctx || FALLBACK_QUEUE_CONTEXT;
}
