import { NextResponse } from "next/server";
import { getApiBaseUrl, getPortalToken } from "@/app/api/portal/_utils";

export async function GET(req: Request) {
  const token = await getPortalToken();
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { search } = new URL(req.url);
  const res = await fetch(`${getApiBaseUrl()}/api/hiring-manager-portal/timecards${search}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

