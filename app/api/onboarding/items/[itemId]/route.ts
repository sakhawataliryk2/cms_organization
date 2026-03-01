import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ itemId: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  try {
    const { itemId } = await ctx.params;

    const token = (await cookies()).get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiBase = process.env.API_BASE_URL || "http://localhost:8080";

    // backend endpoint (confirm path on backend)
    const res = await fetch(`${apiBase}/api/onboarding/items/${itemId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return NextResponse.json(
        { success: false, message: "Backend returned non-JSON", raw: text },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}