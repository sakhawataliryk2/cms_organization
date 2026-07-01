import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type Params = { params: Promise<{ placementId: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { placementId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
    const backendRes = await fetch(
      `${API_BASE}/api/benefit-package/placements/${placementId}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
