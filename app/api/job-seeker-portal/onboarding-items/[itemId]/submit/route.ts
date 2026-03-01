import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ itemId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const body = await req.json().catch(() => ({}));

  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const { itemId } = await ctx.params;

  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

  const r = await fetch(`${apiUrl}/api/onboarding/items/${itemId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}