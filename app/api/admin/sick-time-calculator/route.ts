import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function authHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function apiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

export async function GET() {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }
  const res = await fetch(`${apiBase()}/api/admin/sick-time-calculator`, {
    headers,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: Request) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${apiBase()}/api/admin/sick-time-calculator`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
