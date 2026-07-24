import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
    const backendRes = await fetch(
      `${API_BASE}/api/onboarding/job-seekers/${encodeURIComponent(id)}/packet-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
