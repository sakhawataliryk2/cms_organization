import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const maxDuration = 120;

/**
 * POST /api/job-seekers/[id]/ai-match
 * Proxies to Node backend. Returns ranked jobs for this job seeker.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Job seeker ID is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${apiUrl}/api/job-seekers/${id}/ai-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
    });

    const text = await response.text();
    let data: { matches?: unknown[]; matchedIds?: string[]; message?: string };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid response from backend" },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "AI match request failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in job-seeker ai-match proxy:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
