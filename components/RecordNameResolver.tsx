"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  | "jobseeker"
  | "jobseekers"
  | "lead"
  | "leads"
  | "placement"
  | "placements"
  | "task"
  | "tasks"
  | "jobSeeker"
  | "jobSeekers"
  | "hiringManager"
  | "hiringManagers"
  | "owner";

type CacheEntry = {
  name: string | null;
  error: boolean;
};

/* ---------------------------------------------
   Global Cache
--------------------------------------------- */

const recordNameCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CacheEntry>>();

/* ---------------------------------------------
   Hook: useRecordName
--------------------------------------------- */

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

    const cached = recordNameCache.get(cacheKey);
    if (cached) {
      setName(cached.name);
      setError(cached.error);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

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
};

/* ---------------------------------------------
   Portal Modal
--------------------------------------------- */

function RecordListModal({
  ids,
  type,
  onClose,
  clickable,
}: {
  ids: string[];
  type: RecordType | string;
  clickable: boolean;
  onClose: () => void;
}) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">Records</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        <div className="space-y-2 max-h-80 overflow-auto">
          {ids.map((id) => (
            <div key={id} className="p-2 border rounded">
              <RecordNameResolver
                id={id}
                type={type}
                clickable={clickable}
              />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

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

export default function RecordNameResolver({
  id,
  type,
  clickable = false,
  className = "",
  fallback = "—",
  loadingText = "…",
}: RecordNameResolverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const ids = id
    ? id
      .toString()
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    : [];

  /* ---------- MULTIPLE IDS ---------- */
  if (ids.length > 1) {
    return (
      <>
        <span
          className={`text-blue-600 cursor-pointer hover:underline ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {ids.length} records
        </span>

        {open && (
          <RecordListModal
            ids={ids}
            type={type}
            clickable={clickable}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  /* ---------- SINGLE ID ---------- */
  const singleId = ids[0];
  const { name, isLoading, error } = useRecordName(singleId, type);

  const normalizedType = type.toString().toLowerCase().replace(/\s+/g, "-");
  const viewPath = VIEW_ROUTE_BY_TYPE[normalizedType];
  const displayName =
    name ?? (isLoading ? loadingText : error ? fallback : fallback);

  // Owner type should never be clickable
  const isOwnerType = normalizedType === "owner";
  const shouldBeClickable = clickable && !isOwnerType && viewPath && singleId;

  if (shouldBeClickable) {
    const href = `${viewPath}?id=${singleId}`;
    return (
      <a
        href={href}
        className={`text-blue-600 hover:underline ${className}`.trim()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(href);
        }}
      >
        {displayName}
      </a>
    );
  }

  return <span className={className}>{displayName}</span>;
}
