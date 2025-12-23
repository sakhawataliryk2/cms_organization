import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

type CategoryKey =
  | "organizations"
  | "jobs"
  | "job-seekers"
  | "hiring-managers"
  | "placements"
  | "leads";

const CATEGORY_CONFIG: Array<{
  key: CategoryKey;
  label: string;
  endpoint: string;
  responseKey: string;
}> = [
  { key: "organizations", label: "Organization", endpoint: "organizations", responseKey: "organizations" },
  { key: "jobs", label: "Jobs", endpoint: "jobs", responseKey: "jobs" },
  { key: "job-seekers", label: "Job Seekers", endpoint: "job-seekers", responseKey: "jobSeekers" },
  { key: "hiring-managers", label: "Hiring Managers", endpoint: "hiring-managers", responseKey: "hiringManagers" },
  { key: "placements", label: "Placements", endpoint: "placements", responseKey: "placements" },
  { key: "leads", label: "Leads", endpoint: "leads", responseKey: "leads" },
];

function parseRange(searchParams: URLSearchParams) {
  const start = searchParams.get("start") || searchParams.get("startDate") || "";
  const end = searchParams.get("end") || searchParams.get("endDate") || "";

  if (!start || !end) {
    return { ok: false as const, error: "start and end are required (YYYY-MM-DD)" };
  }
  if (start > end) {
    return { ok: false as const, error: "start must be <= end" };
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false as const, error: "Invalid start/end date format" };
  }

  return { ok: true as const, start, end, startDate, endDate };
}

function isDateInRange(dateString: string | undefined, start: Date, end: Date) {
  if (!dateString) return false;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as jwt.JwtPayload;
    const userId =
      (decoded.userId as string | undefined) ||
      (decoded.id as string | undefined) ||
      (decoded.user as any)?.id;
    return userId ? String(userId) : null;
  } catch (e) {
    console.error("Error verifying token in activity report:", e);
    return null;
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  const workers = Array.from({ length: Math.max(1, limit) }).map(async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await mapper(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const requestedUserId =
      request.nextUrl.searchParams.get("userId") ||
      request.nextUrl.searchParams.get("user_id");
    if (requestedUserId && String(requestedUserId) !== String(userId)) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const range = parseRange(request.nextUrl.searchParams);
    if (!range.ok) {
      return NextResponse.json(
        { success: false, message: range.error },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const categories: Record<
      CategoryKey,
      { label: string; notesCount: number; addedToSystem: number }
    > = {
      "organizations": { label: "Organization", notesCount: 0, addedToSystem: 0 },
      "jobs": { label: "Jobs", notesCount: 0, addedToSystem: 0 },
      "job-seekers": { label: "Job Seekers", notesCount: 0, addedToSystem: 0 },
      "hiring-managers": { label: "Hiring Managers", notesCount: 0, addedToSystem: 0 },
      "placements": { label: "Placements", notesCount: 0, addedToSystem: 0 },
      "leads": { label: "Leads", notesCount: 0, addedToSystem: 0 },
    };

    for (const cfg of CATEGORY_CONFIG) {
      const listRes = await fetch(`${apiUrl}/api/${cfg.endpoint}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!listRes.ok) {
        // Don’t fail the whole report; just skip this category
        console.error(
          `Activity report: failed to fetch ${cfg.endpoint}:`,
          listRes.status
        );
        continue;
      }

      const listData = await listRes.json();
      const entities: any[] = listData?.[cfg.responseKey] || [];

      // Records (Added to System): created_by within range
      const ownedEntities = entities.filter((e) => {
        const createdBy = e?.created_by ?? e?.createdBy;
        const ownerId = e?.owner_id ?? e?.ownerId ?? e?.owner;
        const ownerMatch =
          ownerId != null &&
          String(ownerId) === userId &&
          // avoid matching owner name strings
          /^[0-9]+$/.test(String(ownerId));
        const createdByMatch = createdBy != null && String(createdBy) === userId;
        const inRange = isDateInRange(e?.created_at ?? e?.createdAt, range.startDate, range.endDate);
        return (createdByMatch || ownerMatch) && inRange;
      });
      categories[cfg.key].addedToSystem = ownedEntities.length;

      // Notes count: notes created_by within range
      const entityIds = entities
        .map((e) => e?.id)
        .filter((id) => id !== undefined && id !== null)
        .map((id) => String(id));

      const noteCounts = await mapLimit(entityIds, 6, async (id) => {
        try {
          const notesRes = await fetch(`${apiUrl}/api/${cfg.endpoint}/${id}/notes`, {
            method: "GET",
            headers,
            cache: "no-store",
          });
          if (!notesRes.ok) return 0;
          const notesData = await notesRes.json();
          const notes: any[] = notesData?.notes || [];
          return notes.reduce((acc, n) => {
            const createdBy = n?.created_by ?? n?.createdBy;
            const createdByMatch = createdBy != null && String(createdBy) === userId;
            const inRange = isDateInRange(n?.created_at ?? n?.createdAt, range.startDate, range.endDate);
            return acc + (createdByMatch && inRange ? 1 : 0);
          }, 0);
        } catch (e) {
          return 0;
        }
      });

      categories[cfg.key].notesCount = noteCounts.reduce((a, b) => a + b, 0);
    }

    return NextResponse.json({
      success: true,
      userId,
      range: { start: range.start, end: range.end },
      categories,
    });
  } catch (error) {
    console.error("Error building activity report:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}


