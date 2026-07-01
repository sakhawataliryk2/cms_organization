import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type Params = { params: Promise<{ placementId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { placementId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
    const backendRes = await fetch(`${API_BASE}/api/benefit-package/placements/${placementId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
