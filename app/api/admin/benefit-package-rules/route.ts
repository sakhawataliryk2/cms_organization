import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function authHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function GET() {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
  }
  const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
  const res = await fetch(`${API_BASE}/api/admin/benefit-package-rules`, { headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
  }
  const body = await req.json();
  const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
  const res = await fetch(`${API_BASE}/api/admin/benefit-package-rules`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
