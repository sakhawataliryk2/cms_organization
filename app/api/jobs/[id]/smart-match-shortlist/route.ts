import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

async function authHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  return token;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const token = await authHeaders();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    const upstream = await fetch(
      `${getApiBase()}/api/jobs/${id}/smart-match-shortlist`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const token = await authHeaders();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const upstream = await fetch(
      `${getApiBase()}/api/jobs/${id}/smart-match-shortlist`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      },
    );
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 },
    );
  }
}
