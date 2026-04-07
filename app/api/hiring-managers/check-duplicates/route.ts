import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const HM_PRIMARY_EMAIL_FIELD_NAME = "Field_7";

function normalizeEmail(value: string | null | undefined): string {
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

async function resolveEmailLabel(
  searchParams: URLSearchParams,
  token: string,
  apiUrl: string
): Promise<string | null> {
  const emailFromQuery =
    (searchParams.get("email_label") ?? searchParams.get("emailFieldLabel") ?? "").trim() ||
    null;

  if (emailFromQuery) return emailFromQuery;

  return fetchFieldLabelFromBackend(
    apiUrl,
    token,
    "hiring-managers",
    HM_PRIMARY_EMAIL_FIELD_NAME
  );
}

function hmEmailForDuplicate(
  cf: Record<string, unknown>,
  emailLabel: string | null,
  emailColumn: unknown
): string {
  if (emailLabel && cf[emailLabel] != null && String(cf[emailLabel]).trim() !== "") {
    const fromCf = normalizeEmail(String(cf[emailLabel]));
    if (fromCf) return fromCf;
  }
  return normalizeEmail(emailColumn == null ? "" : String(emailColumn));
}

function hmDisplayName(hm: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
}): string {
  const full = (hm.full_name || "").trim();
  if (full) return full;
  const combined = `${hm.first_name || ""} ${hm.last_name || ""}`.trim();
  return combined || "Unnamed";
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
    const email = searchParams.get("email") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const normEmail = normalizeEmail(email);
    if (!normEmail) {
      return NextResponse.json({
        success: true,
        duplicates: { email: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const emailLabel = await resolveEmailLabel(searchParams, token, apiUrl);

    const response = await fetch(`${apiUrl}/api/hiring-managers`, {
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
          message: data.message || "Failed to fetch hiring managers",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const hiringManagers: Array<{
      id: number | string;
      full_name?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      custom_fields?: Record<string, unknown> | string;
    }> = data.hiringManagers ?? data ?? [];

    const exclude = excludeId ? String(excludeId).trim() : null;
    const duplicateEmail: Array<{ id: string | number; name: string }> = [];

    for (const hm of hiringManagers) {
      const hmId = hm.id != null ? String(hm.id) : "";
      if (exclude && hmId === exclude) continue;

      const cf = parseCustomFields(hm.custom_fields);
      const hmEmail = hmEmailForDuplicate(cf, emailLabel, hm.email);
      if (hmEmail && hmEmail === normEmail) {
        duplicateEmail.push({ id: hm.id, name: hmDisplayName(hm) });
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: {
        email: duplicateEmail,
      },
    });
  } catch (error) {
    console.error("Error checking hiring manager duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
