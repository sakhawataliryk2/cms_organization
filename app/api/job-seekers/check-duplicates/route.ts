import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function normalizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim();
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
    const email = searchParams.get("email") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const hasAny = normalizePhone(phone) || normalizeEmail(email);
    if (!hasAny) {
      return NextResponse.json({
        success: true,
        duplicates: { phone: [], email: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
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
      email?: string;
      phone?: string;
    }> = data.jobSeekers ?? data ?? [];

    const exclude = excludeId ? String(excludeId).trim() : null;
    const normPhone = normalizePhone(phone);
    const normEmail = normalizeEmail(email);

    const duplicatePhone: Array<{ id: string | number; name: string }> = [];
    const duplicateEmail: Array<{ id: string | number; name: string }> = [];

    for (const js of jobSeekers) {
      const jsId = js.id != null ? String(js.id) : "";
      if (exclude && jsId === exclude) continue;

      const jsName = js.full_name || "Unnamed";

      if (normPhone) {
        const jsPhone = normalizePhone(js.phone);
        if (jsPhone && jsPhone === normPhone) {
          duplicatePhone.push({ id: js.id, name: jsName });
        }
      }

      if (normEmail) {
        const jsEmail = normalizeEmail(js.email);
        if (jsEmail && jsEmail === normEmail) {
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

