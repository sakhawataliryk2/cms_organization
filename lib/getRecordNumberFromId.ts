/**
 * Fetches the business record_number for a record by its primary key id and module.
 * Uses the Next.js API route /api/record-number (which proxies to the backend).
 *
 * @param id - Primary key ID of the record
 * @param module - Module/entity type (e.g. 'job', 'jobSeeker', 'organization', 'hiringManager', 'lead', 'task', 'placement')
 * @param options - Optional: token for server-side calls; baseUrl for custom API base
 * @returns The record_number, or null if not found or on error
 */
export type RecordNumberModule =
  | "job"
  | "jobSeeker"
  | "organization"
  | "hiringManager"
  | "lead"
  | "task"
  | "placement";

export interface GetRecordNumberOptions {
  /** Auth token (for server-side calls when cookies aren't available) */
  token?: string;
  /** Base URL for the API (defaults to same origin) */
  baseUrl?: string;
}

type CacheEntry = {
  value: number | null;
  expires: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const recordNumberCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<number | null>>();

function makeCacheKey(id: number, moduleParam: string) {
  return `${moduleParam}:${id}`;
}

export async function getRecordNumberFromId(
  id: number,
  module: RecordNumberModule | string,
  options?: GetRecordNumberOptions
): Promise<number | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return null;
  }

  // Normalize module for API (e.g. jobSeeker -> job-seeker)
  const moduleParam =
    typeof module === "string"
      ? module.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")
      : "job";
  const cacheKey = makeCacheKey(numericId, moduleParam);
  const now = Date.now();
  const cached = recordNumberCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.value;
  }

  const existingRequest = inflightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const baseUrl = options?.baseUrl;
  const url =
    typeof baseUrl === "string" && baseUrl.length > 0
      ? new URL(
          `/api/record-number?id=${numericId}&module=${encodeURIComponent(moduleParam)}`,
          baseUrl.replace(/\/$/, "")
        )
      : `/api/record-number?id=${numericId}&module=${encodeURIComponent(moduleParam)}`;
  const urlString = typeof url === "string" ? url : url.toString();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const request = (async (): Promise<number | null> => {
    try {
      const res = await fetch(urlString, { headers, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        recordNumberCache.set(cacheKey, {
          value: null,
          expires: Date.now() + CACHE_TTL_MS,
        });
        return null;
      }
      const recordNumber = data.recordNumber ?? data.record_number;
      const parsedValue =
        recordNumber != null && typeof recordNumber === "number"
          ? recordNumber
          : recordNumber != null && typeof recordNumber === "string"
            ? parseInt(recordNumber, 10) || null
            : null;
      recordNumberCache.set(cacheKey, {
        value: parsedValue,
        expires: Date.now() + CACHE_TTL_MS,
      });
      return parsedValue;
    } catch {
      recordNumberCache.set(cacheKey, {
        value: null,
        expires: Date.now() + CACHE_TTL_MS,
      });
      return null;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, request);
  return request;
}
