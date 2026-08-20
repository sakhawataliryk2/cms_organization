import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function apiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

async function authHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function GET(request: NextRequest) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }
  const qs = request.nextUrl.searchParams.toString();
  const res = await fetch(`${apiBase()}/api/timesheets${qs ? `?${qs}` : ""}`, {
    headers,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
