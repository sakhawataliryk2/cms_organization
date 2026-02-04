"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to resolve a record ID to its display name.
 * @returns { name, isLoading, error }
 */
export function useRecordName(
  id: string | number | null | undefined,
  type: RecordType | string
) {
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const idStr = id != null && id !== "" ? String(id).trim() : null;

  useEffect(() => {
    if (!idStr) {
      setName(null);
      setError(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const fetchName = async () => {
      try {
        setError(false);
        const params = new URLSearchParams({
          type: type.toString().toLowerCase().replace(/\s+/g, "-"),
          id: idStr,
        });
        const response = await fetch(`/api/resolve-record?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setName(data.name || null);
        } else {
          setError(true);
          setName(null);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(true);
          setName(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchName();
    return () => controller.abort();
  }, [idStr, type]);

  return { name, isLoading, error };
}

export type RecordType =
  | "organization"
  | "organizations"
  | "hiring-manager"
  | "hiring-managers"
  | "job"
  | "jobs"
  | "job-seeker"
  | "job-seekers"
  | "lead"
  | "leads"
  | "placement"
  | "placements"
  | "task"
  | "tasks";

const VIEW_ROUTE_BY_TYPE: Record<string, string> = {
  organization: "/dashboard/organizations/view",
  organizations: "/dashboard/organizations/view",
  "hiring-manager": "/dashboard/hiring-managers/view",
  "hiring-managers": "/dashboard/hiring-managers/view",
  job: "/dashboard/jobs/view",
  jobs: "/dashboard/jobs/view",
  "job-seeker": "/dashboard/job-seekers/view",
  "job-seekers": "/dashboard/job-seekers/view",
  lead: "/dashboard/leads/view",
  leads: "/dashboard/leads/view",
  placement: "/dashboard/placements/view",
  placements: "/dashboard/placements/view",
  task: "/dashboard/tasks/view",
  tasks: "/dashboard/tasks/view",
};

interface RecordNameResolverProps {
  /** Record ID (string or number) */
  id: string | number | null | undefined;
  /** Entity type - organization, hiring-manager, job, job-seeker, lead, placement, task (plural forms accepted) */
  type: RecordType | string;
  /** If true, renders as a clickable link to the record's view page */
  clickable?: boolean;
  /** Custom class name for the wrapper/link */
  className?: string;
  /** Fallback text when id is missing or fetch fails */
  fallback?: string;
  /** Placeholder while loading */
  loadingText?: string;
}

/**
 * Resolves a record ID to its display name by fetching from the API.
 * Use for displaying human-readable names (e.g., parent organization, referenced records).
 *
 * @example
 * <RecordNameResolver id={parentOrgId} type="organization" clickable />
 * <RecordNameResolver id={123} type="job" fallback="Unknown Job" />
 */
export default function RecordNameResolver({
  id,
  type,
  clickable = false,
  className = "",
  fallback = "—",
  loadingText = "…",
}: RecordNameResolverProps) {
  const router = useRouter();
  const { name, isLoading, error } = useRecordName(id, type);
  const idStr = id != null && id !== "" ? String(id).trim() : null;

  const displayName = name ?? (error ? fallback : isLoading ? loadingText : fallback);
  const normalizedType = type.toString().toLowerCase().replace(/\s+/g, "-");
  const viewPath = VIEW_ROUTE_BY_TYPE[normalizedType];
  const canNavigate = clickable && viewPath && idStr;

  if (canNavigate) {
    return (
      <a
        href={`${viewPath}?id=${idStr}`}
        className={`text-blue-600 hover:underline ${className}`.trim()}
        onClick={(e) => {
          e.preventDefault();
          router.push(`${viewPath}?id=${idStr}`);
        }}
      >
        {displayName}
      </a>
    );
  }

  return <span className={className}>{displayName}</span>;
}
