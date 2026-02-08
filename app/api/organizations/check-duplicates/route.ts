import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

function normalizeEmail(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.trim().toLowerCase();
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
    const email = searchParams.get("email") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const hasAny = normalizePhone(phone) || normalizeWebsite(website) || normalizeEmail(email);
    if (!hasAny) {
      return NextResponse.json({
        success: true,
        duplicates: { phone: [], website: [], email: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
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
    const normEmail = normalizeEmail(email);

    const duplicatePhone: Array<{ id: string | number; name: string }> = [];
    const duplicateWebsite: Array<{ id: string | number; name: string }> = [];
    const duplicateEmail: Array<{ id: string | number; name: string }> = [];

    for (const org of organizations) {
      const orgId = org.id != null ? String(org.id) : "";
      if (exclude && orgId === exclude) continue;

      const orgName = org.name ?? "Unnamed";

      if (normPhone) {
        const orgPhone = normalizePhone(org.contact_phone);
        if (orgPhone && orgPhone === normPhone) {
          duplicatePhone.push({ id: org.id, name: orgName });
        }
      }

      if (normWebsite) {
        const orgWeb = normalizeWebsite(org.website);
        if (orgWeb && orgWeb === normWebsite) {
          duplicateWebsite.push({ id: org.id, name: orgName });
        }
      }

      if (normEmail) {
        let orgEmail = "";
        if (org.custom_fields) {
          const cf =
            typeof org.custom_fields === "string"
              ? (() => {
                  try {
                    return JSON.parse(org.custom_fields) as Record<string, unknown>;
                  } catch {
                    return {};
                  }
                })()
              : (org.custom_fields as Record<string, unknown>);
          const raw =
            cf["Email"] ?? cf["Organization Email"] ?? cf["email"] ?? "";
          orgEmail = normalizeEmail(String(raw ?? ""));
        }
        if (orgEmail && orgEmail === normEmail) {
          duplicateEmail.push({ id: org.id, name: orgName });
        }
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: {
        phone: duplicatePhone,
        website: duplicateWebsite,
        email: duplicateEmail,
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
