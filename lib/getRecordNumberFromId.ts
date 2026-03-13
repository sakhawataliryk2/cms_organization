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

  try {
    const res = await fetch(urlString, { headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const recordNumber = data.recordNumber ?? data.record_number;
    if (recordNumber != null && typeof recordNumber === "number") return recordNumber;
    if (recordNumber != null && typeof recordNumber === "string") return parseInt(recordNumber, 10) || null;
    return null;
  } catch {
    return null;
  }
}
