import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Proxies to Express: GET /api/organizations/check-duplicates
 * (targeted SQL on the server — does not load all organizations).
 */
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

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const incoming = request.nextUrl.searchParams;
    const qs = incoming.toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/organizations/check-duplicates${qs ? `?${qs}` : ""}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: (data as { message?: string }).message || "Failed to check duplicates",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { success: false, message: "Duplicate check request timed out." },
        { status: 504 }
      );
    }
    console.error("Error checking organization duplicates:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
