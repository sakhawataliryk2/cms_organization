import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ itemId: string }> };

export async function POST(_: Request, ctx: Ctx) {
  try {
    const { itemId } = await ctx.params;

    const token = (await cookies()).get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

    const backendRes = await fetch(
      `${API_BASE}/api/onboarding/items/${itemId}/admin-approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}