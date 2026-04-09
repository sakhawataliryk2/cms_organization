import { NextResponse } from "next/server";
import { getApiBaseUrl, getPortalToken } from "@/app/api/portal/_utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const token = await getPortalToken();
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const res = await fetch(`${getApiBaseUrl()}/api/jobseeker-portal/tasks/${id}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

