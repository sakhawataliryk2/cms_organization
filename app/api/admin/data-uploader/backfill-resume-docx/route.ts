import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Proxy Resume DOCX backfill to the Express API (NDJSON stream).
 * Used by DataUploader after job-seeker import finishes.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const upstream = await fetch(`${apiUrl}/api/job-seekers/backfill-resume-docx`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errData = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message:
            (errData as { message?: string }).message ||
            "Failed to start resume document upload",
        },
        { status: upstream.status >= 400 ? upstream.status : 500 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Accel-Buffering": "no",
        "Content-Encoding": "identity",
      },
    });
  } catch (error) {
    console.error("backfill-resume-docx proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
