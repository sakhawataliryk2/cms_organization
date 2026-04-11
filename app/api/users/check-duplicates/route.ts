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
    const zoomExtensionNumber = searchParams.get("zoomExtensionNumber") ?? "";
    const excludeId = searchParams.get("excludeId") ?? "";

    const normZoomExt = zoomExtensionNumber.replace(/\D/g, "").trim();
    const hasAny =
      normalizePhone(phone) || normalizeEmail(email) || normZoomExt.length > 0;
    if (!hasAny) {
      return NextResponse.json({
        success: true,
        duplicates: { phone: [], email: [], zoomExtensionNumber: [] },
      });
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const url = new URL(`${apiUrl}/api/users/check-duplicates`);
    if (phone) url.searchParams.set("phone", phone);
    if (email) url.searchParams.set("email", email);
    if (normZoomExt) url.searchParams.set("zoomExtensionNumber", normZoomExt);
    if (excludeId) url.searchParams.set("excludeId", excludeId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to check duplicates",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error checking user duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

