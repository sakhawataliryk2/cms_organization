import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const JOB_REFERENCE_NUMBER_FIELD_NAME = "Field_3";

function normalizeReferenceNumber(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function parseCustomFields(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

async function fetchFieldLabelFromBackend(
  apiUrl: string,
  token: string,
  entityType: string,
  fieldName: string
): Promise<string | null> {
  const qs = new URLSearchParams({
    entity_type: entityType,
    field_name: fieldName,
  });
  const res = await fetch(`${apiUrl}/api/custom-fields/field-label?${qs.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success || typeof data.field_label !== "string") return null;
  const label = data.field_label.trim();
  return label || null;
}

async function resolveReferenceNumberLabel(
  searchParams: URLSearchParams,
  token: string,
  apiUrl: string
): Promise<string | null> {
  const referenceFromQuery =
    (searchParams.get("reference_label") ?? searchParams.get("referenceFieldLabel") ?? "").trim() ||
    null;

  if (referenceFromQuery) return referenceFromQuery;

  return fetchFieldLabelFromBackend(
    apiUrl,
    token,
    "jobs",
    JOB_REFERENCE_NUMBER_FIELD_NAME
  );
}

function jobReferenceNumberForDuplicate(
  cf: Record<string, unknown>,
  referenceLabel: string | null,
  job: Record<string, unknown>
): string {
  if (
    referenceLabel &&
    cf[referenceLabel] != null &&
    String(cf[referenceLabel]).trim() !== ""
  ) {
    const fromCf = normalizeReferenceNumber(String(cf[referenceLabel]));
    if (fromCf) return fromCf;
  }

  const fallback =
    job.reference_number ??
    job.referenceNumber ??
    job.job_reference_number ??
    job.reference_no ??
    job.ref_no ??
    "";
  return normalizeReferenceNumber(String(fallback));
}

function jobDisplayName(job: Record<string, unknown>): string {
  const title = String(job.job_title ?? job.jobTitle ?? "").trim();
  if (title) return title;
  return `Job #${String(job.id ?? "").trim() || "Unknown"}`;
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

    const { searchParams } = new URL(request.url);
    const referenceNumber = searchParams.get("reference_number") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const normReferenceNumber = normalizeReferenceNumber(referenceNumber);
    if (!normReferenceNumber) {
      return NextResponse.json({
        success: true,
        duplicates: { reference_number: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const referenceLabel = await resolveReferenceNumberLabel(
      searchParams,
      token,
      apiUrl
    );

    const response = await fetch(`${apiUrl}/api/jobs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to fetch jobs",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const jobs: Array<Record<string, unknown>> = data.jobs ?? data ?? [];

    const exclude = excludeId ? String(excludeId).trim() : null;
    const duplicateReferenceNumber: Array<{ id: string | number; name: string }> = [];

    for (const job of jobs) {
      const jobId = job.id != null ? String(job.id) : "";
      if (exclude && jobId === exclude) continue;

      const cf = parseCustomFields(job.custom_fields);
      const currentReferenceNumber = jobReferenceNumberForDuplicate(
        cf,
        referenceLabel,
        job
      );
      if (currentReferenceNumber && currentReferenceNumber.toLowerCase().includes(normReferenceNumber.toLowerCase())) {
        duplicateReferenceNumber.push({
          id: job.id as string | number,
          name: jobDisplayName(job),
        });
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: {
        reference_number: duplicateReferenceNumber,
      },
    });
  } catch (error) {
    console.error("Error checking job duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
