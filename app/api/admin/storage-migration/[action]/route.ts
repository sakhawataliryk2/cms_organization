import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ACTIONS = new Set([
  "scan",
  "dry-run",
  "start",
  "resume",
  "stop",
  "undo",
  "validate-env",
]);

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await context.params;
    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, message: "Unknown action" },
        { status: 404 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const upstream = await fetch(
      `${getApiBase()}/api/admin/storage-migration/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
        signal: request.signal,
      },
    );

    if (action === "stop") {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }

    if (!upstream.ok || !upstream.body) {
      const errData = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message:
            (errData as { message?: string })?.message ||
            `Upstream error (${upstream.status})`,
        },
        { status: upstream.status || 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Proxy failed",
      },
      { status: 500 },
    );
  }
}
