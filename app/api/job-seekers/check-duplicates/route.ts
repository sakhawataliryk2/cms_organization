import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/** Stable internal names — labels resolved via backend field-label or query params. */
const JS_PRIMARY_EMAIL_FIELD_NAME = "Field_8";
const JS_PRIMARY_PHONE_FIELD_NAME = "Field_11";

function normalizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim();
}

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

async function resolveEmailPhoneLabels(
  searchParams: URLSearchParams,
  token: string,
  apiUrl: string
): Promise<{ emailLabel: string | null; phoneLabel: string | null }> {
  const emailFromQuery =
    (searchParams.get("email_label") ?? searchParams.get("emailFieldLabel") ?? "").trim() ||
    null;
  const phoneFromQuery =
    (searchParams.get("phone_label") ?? searchParams.get("phoneFieldLabel") ?? "").trim() ||
    null;

  let emailLabel = emailFromQuery;
  let phoneLabel = phoneFromQuery;

  if (!emailLabel) {
    emailLabel = await fetchFieldLabelFromBackend(
      apiUrl,
      token,
      "job-seekers",
      JS_PRIMARY_EMAIL_FIELD_NAME
    );
  }
  if (!phoneLabel) {
    phoneLabel = await fetchFieldLabelFromBackend(
      apiUrl,
      token,
      "job-seekers",
      JS_PRIMARY_PHONE_FIELD_NAME
    );
  }

  return { emailLabel, phoneLabel };
}

function jsEmailForDuplicate(
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

function jsPhoneForDuplicate(
  cf: Record<string, unknown>,
  phoneLabel: string | null,
  phoneColumn: unknown
): string {
  if (phoneLabel && cf[phoneLabel] != null && String(cf[phoneLabel]).trim() !== "") {
    const fromCf = normalizePhone(String(cf[phoneLabel]));
    if (fromCf) return fromCf;
  }
  return normalizePhone(phoneColumn == null ? "" : String(phoneColumn));
}

function jsDisplayName(js: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
}): string {
  const fn = (js.full_name || "").trim();
  if (fn) return fn;
  const n = `${js.first_name || ""} ${js.last_name || ""}`.trim();
  return n || "Unnamed";
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
    const phone = searchParams.get("phone") ?? "";
    const email = searchParams.get("email") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const normPhone = normalizePhone(phone);
    const normEmail = normalizeEmail(email);
    const hasAny = normPhone || normEmail;
    if (!hasAny) {
      return NextResponse.json({
        success: true,
        duplicates: { phone: [], email: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const { emailLabel, phoneLabel } = await resolveEmailPhoneLabels(
      searchParams,
      token,
      apiUrl
    );

    const response = await fetch(`${apiUrl}/api/job-seekers`, {
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
          message: data.message || "Failed to fetch job seekers",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const jobSeekers: Array<{
      id: string | number;
      full_name?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      custom_fields?: Record<string, unknown> | string;
    }> = data.jobSeekers ?? data ?? [];

    const exclude = excludeId ? String(excludeId).trim() : null;

    const duplicatePhone: Array<{ id: string | number; name: string }> = [];
    const duplicateEmail: Array<{ id: string | number; name: string }> = [];

    for (const js of jobSeekers) {
      const jsId = js.id != null ? String(js.id) : "";
      if (exclude && jsId === exclude) continue;

      const jsName = jsDisplayName(js);
      const cf = parseCustomFields(js.custom_fields);

      if (normPhone) {
        const jsPhone = jsPhoneForDuplicate(cf, phoneLabel, js.phone);
        if (jsPhone && jsPhone === normPhone) {
          duplicatePhone.push({ id: js.id, name: jsName });
        }
      }

      if (normEmail) {
        const jsEm = jsEmailForDuplicate(cf, emailLabel, js.email);
        if (jsEm && jsEm === normEmail) {
          duplicateEmail.push({ id: js.id, name: jsName });
        }
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: {
        phone: duplicatePhone,
        email: duplicateEmail,
      },
    });
  } catch (error) {
    console.error("Error checking job seeker duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
