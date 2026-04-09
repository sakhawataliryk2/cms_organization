import { NextResponse } from "next/server";
import { getApiBaseUrl, getPortalToken } from "@/app/api/portal/_utils";

type Ctx = { params: Promise<{ itemId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const token = await getPortalToken();
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { itemId } = await ctx.params;
  const res = await fetch(`${getApiBaseUrl()}/api/jobseeker-portal/documents/${itemId}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

