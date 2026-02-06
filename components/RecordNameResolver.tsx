"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ---------------------------------------------
   Types
--------------------------------------------- */

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
  | "tasks"
  | "jobSeeker"
  | "jobSeekers"
  | "hiringManager"
  | "hiringManagers";

type CacheEntry = {
  name: string | null;
  error: boolean;
};

/* ---------------------------------------------
   Global Cache (shared across app)
--------------------------------------------- */

const recordNameCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CacheEntry>>();

/* ---------------------------------------------
   Hook: useRecordName
--------------------------------------------- */

/**
 * Resolves a record ID to its display name.
 * Uses in-memory cache + request deduplication.
 */
export function useRecordName(
  id: string | number | null | undefined,
  type: RecordType | string
) {
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const idStr = id != null && id !== "" ? String(id).trim() : null;
  const normalizedType = type.toString().toLowerCase().replace(/\s+/g, "-");
  const cacheKey = idStr ? `${normalizedType}:${idStr}` : null;

  useEffect(() => {
    if (!cacheKey) {
      setName(null);
      setError(true);
      return;
    }

    // ✅ Serve from cache instantly
    const cached = recordNameCache.get(cacheKey);
    if (cached) {
      setName(cached.name);
      setError(cached.error);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // ✅ Deduplicate concurrent requests
    const request =
      inflightRequests.get(cacheKey) ??
      (async () => {
        try {
          const params = new URLSearchParams({
            type: normalizedType,
            id: idStr!,
          });

          const res = await fetch(`/api/resolve-record?${params}`);
          const data = await res.json();

          const entry: CacheEntry =
            res.ok && data?.success
              ? { name: data.name ?? null, error: false }
              : { name: null, error: true };

          recordNameCache.set(cacheKey, entry);
          return entry;
        } catch {
          const entry = { name: null, error: true };
          recordNameCache.set(cacheKey, entry);
          return entry;
        } finally {
          inflightRequests.delete(cacheKey);
        }
      })();

    inflightRequests.set(cacheKey, request);

    request.then((entry) => {
      if (!cancelled) {
        setName(entry.name);
        setError(entry.error);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, normalizedType, idStr]);

  return { name, isLoading, error };
}

/* ---------------------------------------------
   View Routes
--------------------------------------------- */

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
  jobseeker: "/dashboard/job-seekers/view",
  jobseekers: "/dashboard/job-seekers/view",
  hiringmanager: "/dashboard/hiring-managers/view",
  hiringmanagers: "/dashboard/hiring-managers/view",
  // hiringManagers: "/dashboard/hiring-managers/view",
};

/* ---------------------------------------------
   Component: RecordNameResolver
--------------------------------------------- */

interface RecordNameResolverProps {
  id: string | number | null | undefined;
  type: RecordType | string;
  clickable?: boolean;
  className?: string;
  fallback?: string;
  loadingText?: string;
}

/**
 * Displays a resolved record name.
 * Optionally renders as a clickable link.
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
  const normalizedType = type.toString().toLowerCase().replace(/\s+/g, "-");
  const viewPath = VIEW_ROUTE_BY_TYPE[normalizedType];

  const displayName =
    name ?? (isLoading ? loadingText : error ? fallback : fallback);

  const canNavigate = clickable && viewPath && idStr;

  if (canNavigate) {
    const href = `${viewPath}?id=${idStr}`;

    return (
      <a
        href={href}
        className={`text-blue-600 hover:underline ${className}`.trim()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          router.push(href);
        }}
      >
        {displayName}
      </a>
    );
  }

  return <span className={className}>{displayName}</span>;
}