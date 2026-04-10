/**
 * Fetches the business record_number for a record by its primary key id and module.
 * Uses the Next.js API route /api/record-number (which proxies to the backend).
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
  token?: string;
  baseUrl?: string;
}

type CacheEntry = {
  value: number | null;
  expires: number;
};

// Successful lookups cached for 1 hour; errors cached for only 10 seconds so they retry quickly
const SUCCESS_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 10 * 1000;

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
  if (!Number.isInteger(numericId) || numericId < 1) return null;

  // Normalize camelCase module names to kebab-case (e.g. jobSeeker → job-seeker)
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

  // Reuse an in-flight request for the same key
  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const baseUrl = options?.baseUrl;
  const urlString =
    typeof baseUrl === "string" && baseUrl.length > 0
      ? new URL(
        `/api/record-number?id=${numericId}&module=${encodeURIComponent(moduleParam)}`,
        baseUrl.replace(/\/$/, "")
      ).toString()
      : `/api/record-number?id=${numericId}&module=${encodeURIComponent(moduleParam)}`;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (options?.token) headers["Authorization"] = `Bearer ${options.token}`;

  const request = (async (): Promise<number | null> => {
    try {
      const res = await fetch(urlString, { headers, credentials: "include" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Cache errors briefly so we retry soon instead of hammering the server
        recordNumberCache.set(cacheKey, { value: null, expires: Date.now() + ERROR_TTL_MS });
        return null;
      }

      const raw = data.recordNumber ?? data.record_number ?? null;
      const parsed =
        raw == null
          ? null
          : typeof raw === "number"
            ? raw
            : parseInt(String(raw), 10) || null;

      recordNumberCache.set(cacheKey, { value: parsed, expires: Date.now() + SUCCESS_TTL_MS });
      return parsed;
    } catch {
      recordNumberCache.set(cacheKey, { value: null, expires: Date.now() + ERROR_TTL_MS });
      return null;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  // Register before awaiting so concurrent callers reuse it
  inflightRequests.set(cacheKey, request);
  return request;
}
