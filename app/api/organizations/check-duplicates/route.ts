import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ORG_WEBSITE_FIELD_NAME = "Field_5";
const ORG_MAIN_PHONE_FIELD_NAME = "Field_6";

function normalizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim();
}

function normalizeWebsite(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    return host || trimmed;
  } catch {
    return trimmed;
  }
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

/**
 * Prefer labels from query (client already resolved via /api/custom-fields/field-label),
 * otherwise resolve Field_5 / Field_6 via backend GET /api/custom-fields/field-label.
 */
async function resolvePhoneWebsiteLabels(
  searchParams: URLSearchParams,
  token: string,
  apiUrl: string
): Promise<{ phoneLabel: string | null; websiteLabel: string | null }> {
  const phoneFromQuery =
    (searchParams.get("phone_label") ?? searchParams.get("phoneFieldLabel") ?? "").trim() ||
    null;
  const websiteFromQuery =
    (searchParams.get("website_label") ?? searchParams.get("websiteFieldLabel") ?? "").trim() ||
    null;

  let phoneLabel = phoneFromQuery;
  let websiteLabel = websiteFromQuery;

  if (!phoneLabel) {
    phoneLabel = await fetchFieldLabelFromBackend(
      apiUrl,
      token,
      "organizations",
      ORG_MAIN_PHONE_FIELD_NAME
    );
  }
  if (!websiteLabel) {
    websiteLabel = await fetchFieldLabelFromBackend(
      apiUrl,
      token,
      "organizations",
      ORG_WEBSITE_FIELD_NAME
    );
  }

  return { phoneLabel, websiteLabel };
}

function orgPhoneForDuplicate(
  cf: Record<string, unknown>,
  phoneLabel: string | null,
  contactPhoneColumn: unknown
): string {
  if (phoneLabel && cf[phoneLabel] != null && String(cf[phoneLabel]).trim() !== "") {
    const fromCf = normalizePhone(String(cf[phoneLabel]));
    if (fromCf) return fromCf;
  }
  return normalizePhone(
    contactPhoneColumn == null ? "" : String(contactPhoneColumn)
  );
}

function orgWebsiteForDuplicate(
  cf: Record<string, unknown>,
  websiteLabel: string | null,
  websiteColumn: unknown
): string {
  if (websiteLabel && cf[websiteLabel] != null && String(cf[websiteLabel]).trim() !== "") {
    const fromCf = normalizeWebsite(String(cf[websiteLabel]));
    if (fromCf) return fromCf;
  }
  return normalizeWebsite(websiteColumn == null ? "" : String(websiteColumn));
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
    const website = searchParams.get("website") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const hasAny = normalizePhone(phone) || normalizeWebsite(website);
    if (!hasAny) {
      return NextResponse.json({
        success: true,
        duplicates: { phone: [], website: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const { phoneLabel, websiteLabel } = await resolvePhoneWebsiteLabels(
      searchParams,
      token,
      apiUrl
    );

    const response = await fetch(`${apiUrl}/api/organizations`, {
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
          message: data.message || "Failed to fetch organizations",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const organizations: Array<{
      id: number | string;
      name?: string;
      contact_phone?: string;
      website?: string;
      custom_fields?: Record<string, unknown> | string;
    }> = data.organizations ?? data ?? [];

    const exclude = excludeId ? String(excludeId).trim() : null;
    const normPhone = normalizePhone(phone);
    const normWebsite = normalizeWebsite(website);

    const duplicatePhone: Array<{ id: string | number; name: string }> = [];
    const duplicateWebsite: Array<{ id: string | number; name: string }> = [];

    for (const org of organizations) {
      const orgId = org.id != null ? String(org.id) : "";
      if (exclude && orgId === exclude) continue;

      const orgName = org.name ?? "Unnamed";
      const cf = parseCustomFields(org.custom_fields);

      if (normPhone) {
        const orgPhone = orgPhoneForDuplicate(cf, phoneLabel, org.contact_phone);
        if (orgPhone && orgPhone === normPhone) {
          duplicatePhone.push({ id: org.id, name: orgName });
        }
      }

      if (normWebsite) {
        const orgWeb = orgWebsiteForDuplicate(cf, websiteLabel, org.website);
        if (orgWeb && orgWeb === normWebsite) {
          duplicateWebsite.push({ id: org.id, name: orgName });
        }
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: {
        phone: duplicatePhone,
        website: duplicateWebsite,
      },
    });
  } catch (error) {
    console.error("Error checking organization duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
